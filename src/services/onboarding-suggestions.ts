// HealthVault — Onboarding suggestion engine
// Phase 1: On Test Connection → locale-aware health conditions + allergies.
// Phase 2: After user selects conditions → contextual suggestions for
//          medications, dietary preferences, and health goals.
// Falls back to hardcoded defaults if the AI call fails or times out.

import type { AIProvider } from '../adapters/types';
import {
  AI_REQUEST_TIMEOUT_MS,
  MAX_SUGGESTION_ITEMS,
  DEBUG_TRUNCATE_LENGTH,
  LOG_PREFIX,
} from '../constants';

// ---------- Types ----------

export interface OnboardingSuggestions {
  conditions: string[];
  allergies: string[];
  medications: string[];
  dietaryPreferences: string[];
  healthGoals: string[];
}

/** Downstream-only subset returned by Phase 2 */
export interface ContextualSuggestions {
  medications: string[];
  dietaryPreferences: string[];
  healthGoals: string[];
}

/** Phase 1 result: locale-aware conditions + allergies */
export interface Phase1Suggestions {
  conditions: string[];
  allergies: string[];
}

// ---------- Hardcoded fallbacks (always available offline) ----------

const FALLBACK_CONDITIONS: string[] = [
  'Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Celiac Disease',
  'IBS', 'GERD', 'Thyroid Disorder', 'Kidney Disease', 'Liver Disease',
];

const FALLBACK_ALLERGIES: string[] = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish',
  'Shellfish', 'Sesame', 'Gluten',
];

const FALLBACK_CONTEXTUAL: ContextualSuggestions = {
  medications: [
    'Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole', 'Levothyroxine',
    'Aspirin', 'Ibuprofen', 'Paracetamol', 'Cetirizine', 'Montelukast',
  ],
  dietaryPreferences: [
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Halal', 'Kosher',
    'Gluten-Free', 'Dairy-Free', 'Low-Sodium', 'Low-Sugar',
  ],
  healthGoals: [
    'Lose Weight', 'Gain Muscle', 'Improve Heart Health', 'Manage Blood Sugar',
    'Reduce Inflammation', 'Improve Gut Health', 'Better Sleep', 'More Energy',
  ],
};

export function getFallbackSuggestions(): OnboardingSuggestions {
  return { conditions: FALLBACK_CONDITIONS, allergies: FALLBACK_ALLERGIES, ...FALLBACK_CONTEXTUAL };
}

export function getFallbackContextual(): ContextualSuggestions {
  return FALLBACK_CONTEXTUAL;
}

// ---------- Locale helpers ----------

function getLocaleInfo(): { locale: string; timezone: string } {
  return {
    locale: navigator.language || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

// ---------- AI-powered generation ----------

// Phase 1: conditions + allergies (both locale-based)
const PHASE1_PROMPT = `Based on my locale and region, suggest:
1. Common chronic or long-term health conditions that people regularly manage and track
2. Common food allergens and sensitivities in this region

USER LOCALE: {locale}
USER TIMEZONE: {timezone}

For conditions: only include ongoing lifestyle or chronic conditions (e.g. diabetes, hypertension, asthma, PCOS).
Do NOT include acute, one-time, or short-term illnesses (e.g. dengue, flu, food poisoning).

For allergies: include common food allergens and environmental sensitivities typical in this region.

Put your entire response in the "answer" field as a JSON string containing this structure:
{"conditions":["..."],"allergies":["..."]}

Each category should have 8-12 short items (1-4 words each).`;

// Phase 2: contextual downstream suggestions based on selected conditions
const CONTEXTUAL_PROMPT = `I have the following health conditions: {conditions}

USER LOCALE: {locale}
USER TIMEZONE: {timezone}

Based on these conditions and my locale/region, suggest relevant items for each category:
- Common medications (use regional brand names where possible)
- Dietary preferences: actual diet types or lifestyle choices (e.g. Vegetarian, Vegan, Non-Vegetarian, Eggitarian, Keto, Low-Sodium, Gluten-Free, Halal, Kosher). Do NOT list specific nutrients or foods.
- Health goals appropriate for someone with these conditions

Put your entire response in the "answer" field as a JSON string containing this structure:
{"medications":["..."],"dietaryPreferences":["..."],"healthGoals":["..."]}

Each category should have 8-12 short items (1-4 words each).`;

// ---------- Shared helpers ----------

/** Sanitise: trim, remove empties, deduplicate, cap at MAX_SUGGESTION_ITEMS each */
const sanitise = (arr: string[]) =>
  [...new Set(arr.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_SUGGESTION_ITEMS);

/** Extract JSON object from AI answer text (may have trailing disclaimers). */
function extractJSON(answerText: string): unknown | null {
  const jsonStart = answerText.indexOf('{');
  const jsonEnd = answerText.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    console.warn(`${LOG_PREFIX} No JSON object found in answer:`, answerText);
    return null;
  }
  try {
    return JSON.parse(answerText.slice(jsonStart, jsonEnd + 1));
  } catch {
    console.warn(`${LOG_PREFIX} Failed to parse JSON:`, answerText.slice(jsonStart, jsonStart + DEBUG_TRUNCATE_LENGTH));
    return null;
  }
}

/** Race a promise against a timeout (returns null on timeout). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// ---------- Phase 1: Conditions + Allergies ----------

/** In-flight Phase 1 promise — prevents duplicate concurrent calls (e.g. React StrictMode). */
let phase1InFlight: Promise<Phase1Suggestions | null> | null = null;

/**
 * Call the AI provider to generate locale-aware condition and allergy suggestions.
 * Returns null on failure (caller should use hardcoded fallbacks).
 * Enforces a 15-second timeout. Deduplicates concurrent calls.
 */
export async function generatePhase1Suggestions(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<Phase1Suggestions | null> {
  // Return existing in-flight promise if one is active
  if (phase1InFlight) return phase1InFlight;

  phase1InFlight = _generatePhase1(provider, config);
  try {
    return await phase1InFlight;
  } finally {
    phase1InFlight = null;
  }
}

async function _generatePhase1(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<Phase1Suggestions | null> {
  try {
    const { locale, timezone } = getLocaleInfo();
    const prompt = PHASE1_PROMPT
      .replace('{locale}', locale)
      .replace('{timezone}', timezone);

    const result = await withTimeout(
      provider.answerHealthQuery(
        {
          query: prompt,
          conversationHistory: [],
          context: { profile: {}, recentInteractions: [] },
        },
        config,
      ),
      AI_REQUEST_TIMEOUT_MS,
    );

    if (!result) {
      console.warn(`${LOG_PREFIX} Phase 1 suggestions timed out`);
      return null;
    }

    console.log(`${LOG_PREFIX} Phase 1 raw response:`, result);

    const parsed = extractJSON(result.answer) as { conditions?: string[]; allergies?: string[] } | null;
    if (!parsed || !Array.isArray(parsed.conditions) || !Array.isArray(parsed.allergies)) return null;

    console.log(`${LOG_PREFIX} Phase 1 parsed:`, parsed);
    return {
      conditions: sanitise(parsed.conditions),
      allergies: sanitise(parsed.allergies),
    };
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to generate Phase 1 suggestions`, err);
    return null;
  }
}

// ---------- Phase 2: Contextual suggestions ----------

/**
 * Call the AI provider to generate condition-aware suggestions for downstream
 * onboarding steps (medications, dietary preferences, health goals).
 * Returns null on failure (caller keeps existing suggestions/fallbacks).
 * Enforces a 15-second timeout.
 */
export async function generateContextualSuggestions(
  provider: AIProvider,
  config: Record<string, string>,
  conditions: string[],
): Promise<ContextualSuggestions | null> {
  try {
    const { locale, timezone } = getLocaleInfo();
    const prompt = CONTEXTUAL_PROMPT
      .replace('{conditions}', conditions.join(', '))
      .replace('{locale}', locale)
      .replace('{timezone}', timezone);

    const result = await withTimeout(
      provider.answerHealthQuery(
        {
          query: prompt,
          conversationHistory: [],
          context: { profile: {}, recentInteractions: [] },
        },
        config,
      ),
      AI_REQUEST_TIMEOUT_MS,
    );

    if (!result) {
      console.warn(`${LOG_PREFIX} Contextual suggestions timed out`);
      return null;
    }

    console.log(`${LOG_PREFIX} Phase 2 raw response:`, result);

    const parsed = extractJSON(result.answer) as ContextualSuggestions | null;
    if (
      !parsed ||
      !Array.isArray(parsed.medications) ||
      !Array.isArray(parsed.dietaryPreferences) ||
      !Array.isArray(parsed.healthGoals)
    ) {
      console.warn(`${LOG_PREFIX} Invalid contextual suggestions shape`);
      return null;
    }

    console.log(`${LOG_PREFIX} Phase 2 parsed suggestions:`, parsed);

    return {
      medications: sanitise(parsed.medications),
      dietaryPreferences: sanitise(parsed.dietaryPreferences),
      healthGoals: sanitise(parsed.healthGoals),
    };
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to generate contextual suggestions`, err);
    return null;
  }
}

// ---------- Legacy wrapper (kept for backward compat if needed) ----------

/** @deprecated Use generatePhase1Suggestions + generateContextualSuggestions */
export async function generateOnboardingSuggestions(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<OnboardingSuggestions | null> {
  const phase1 = await generatePhase1Suggestions(provider, config);
  if (!phase1) return null;
  return { ...phase1, ...getFallbackContextual() };
}
