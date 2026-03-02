// HealthVault — Onboarding suggestion engine
// Phase 1: On Test Connection → locale-aware health conditions only.
// Phase 2: After user selects conditions → contextual suggestions for
//          allergies, medications, dietary preferences, and health goals.
// Falls back to hardcoded defaults if the AI call fails or times out.

import type { AIProvider } from '../adapters/types';

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
  allergies: string[];
  medications: string[];
  dietaryPreferences: string[];
  healthGoals: string[];
}

// ---------- Hardcoded fallbacks (always available offline) ----------

const FALLBACK_CONDITIONS: string[] = [
  'Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Celiac Disease',
  'IBS', 'GERD', 'Thyroid Disorder', 'Kidney Disease', 'Liver Disease',
];

const FALLBACK_CONTEXTUAL: ContextualSuggestions = {
  allergies: [
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish',
    'Shellfish', 'Sesame', 'Gluten',
  ],
  medications: [],
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
  return { conditions: FALLBACK_CONDITIONS, ...FALLBACK_CONTEXTUAL };
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

// Phase 1: conditions only
const CONDITIONS_PROMPT = `Based on my locale and region, suggest common chronic or long-term health conditions that people regularly manage and track.

USER LOCALE: {locale}
USER TIMEZONE: {timezone}

Only include ongoing lifestyle or chronic conditions (e.g. diabetes, hypertension, asthma, PCOS).
Do NOT include acute, one-time, or short-term illnesses (e.g. dengue, flu, food poisoning).

Put your entire response in the "answer" field as a JSON string containing this structure:
{"conditions":["..."]}

Provide 8-12 short items (1-4 words each).`;

// Phase 2: contextual downstream suggestions based on selected conditions
const CONTEXTUAL_PROMPT = `I have the following health conditions: {conditions}

USER LOCALE: {locale}
USER TIMEZONE: {timezone}

Based on these conditions and my locale/region, suggest relevant items for each category:
- Allergies & sensitivities commonly associated with these conditions
- Common medications (use regional brand names where possible)
- Dietary preferences that help manage these conditions
- Health goals appropriate for someone with these conditions

Put your entire response in the "answer" field as a JSON string containing this structure:
{"allergies":["..."],"medications":["..."],"dietaryPreferences":["..."],"healthGoals":["..."]}

Each category should have 8-12 short items (1-4 words each).`;

// ---------- Shared helpers ----------

/** Sanitise: trim, remove empties, deduplicate, cap at 12 each */
const sanitise = (arr: string[]) =>
  [...new Set(arr.map((s) => s.trim()).filter(Boolean))].slice(0, 12);

/** Extract JSON object from AI answer text (may have trailing disclaimers). */
function extractJSON(answerText: string): unknown | null {
  const jsonStart = answerText.indexOf('{');
  const jsonEnd = answerText.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    console.warn('[HealthVault] No JSON object found in answer:', answerText);
    return null;
  }
  try {
    return JSON.parse(answerText.slice(jsonStart, jsonEnd + 1));
  } catch {
    console.warn('[HealthVault] Failed to parse JSON:', answerText.slice(jsonStart, jsonStart + 300));
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

// ---------- Phase 1: Conditions ----------

/**
 * Call the AI provider to generate locale-aware health condition suggestions.
 * Returns null on failure (caller should use hardcoded fallback conditions).
 * Enforces a 15-second timeout.
 */
export async function generateConditionSuggestions(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<string[] | null> {
  try {
    const { locale, timezone } = getLocaleInfo();
    const prompt = CONDITIONS_PROMPT
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
      15_000,
    );

    if (!result) {
      console.warn('[HealthVault] Condition suggestions timed out');
      return null;
    }

    console.log('[HealthVault] Phase 1 raw response:', result);

    const parsed = extractJSON(result.answer) as { conditions?: string[] } | null;
    if (!parsed || !Array.isArray(parsed.conditions)) return null;

    console.log('[HealthVault] Phase 1 parsed conditions:', parsed.conditions);
    return sanitise(parsed.conditions);
  } catch (err) {
    console.warn('[HealthVault] Failed to generate condition suggestions', err);
    return null;
  }
}

// ---------- Phase 2: Contextual suggestions ----------

/**
 * Call the AI provider to generate condition-aware suggestions for downstream
 * onboarding steps (allergies, medications, dietary preferences, health goals).
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
      15_000,
    );

    if (!result) {
      console.warn('[HealthVault] Contextual suggestions timed out');
      return null;
    }

    console.log('[HealthVault] Phase 2 raw response:', result);

    const parsed = extractJSON(result.answer) as ContextualSuggestions | null;
    if (
      !parsed ||
      !Array.isArray(parsed.allergies) ||
      !Array.isArray(parsed.medications) ||
      !Array.isArray(parsed.dietaryPreferences) ||
      !Array.isArray(parsed.healthGoals)
    ) {
      console.warn('[HealthVault] Invalid contextual suggestions shape');
      return null;
    }

    console.log('[HealthVault] Phase 2 parsed suggestions:', parsed);

    return {
      allergies: sanitise(parsed.allergies),
      medications: sanitise(parsed.medications),
      dietaryPreferences: sanitise(parsed.dietaryPreferences),
      healthGoals: sanitise(parsed.healthGoals),
    };
  } catch (err) {
    console.warn('[HealthVault] Failed to generate contextual suggestions', err);
    return null;
  }
}

// ---------- Legacy wrapper (kept for backward compat if needed) ----------

/** @deprecated Use generateConditionSuggestions + generateContextualSuggestions */
export async function generateOnboardingSuggestions(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<OnboardingSuggestions | null> {
  const conditions = await generateConditionSuggestions(provider, config);
  if (!conditions) return null;
  return { conditions, ...getFallbackContextual() };
}
