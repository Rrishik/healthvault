// HealthVault — Onboarding suggestion engine
// Generates locale-aware suggestions for each onboarding category.
// Falls back to hardcoded defaults if the AI call fails or times out.

import type { AIProvider } from '../adapters/types';
import { safeParseJSON } from '../adapters/utils';

// ---------- Types ----------

export interface OnboardingSuggestions {
  conditions: string[];
  allergies: string[];
  medications: string[];
  dietaryPreferences: string[];
  healthGoals: string[];
}

// ---------- Hardcoded fallbacks (always available offline) ----------

const FALLBACK_SUGGESTIONS: OnboardingSuggestions = {
  conditions: [
    'Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Celiac Disease',
    'IBS', 'GERD', 'Thyroid Disorder', 'Kidney Disease', 'Liver Disease',
  ],
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
  return FALLBACK_SUGGESTIONS;
}

// ---------- Locale helpers ----------

function getLocaleInfo(): { locale: string; timezone: string } {
  return {
    locale: navigator.language || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

// ---------- AI-powered generation ----------

const SUGGESTIONS_PROMPT = `You are helping a new user set up their health profile in a health-tracking app.

USER LOCALE: {locale}
USER TIMEZONE: {timezone}

Based on the user's region and locale, generate personalised suggestions for each category.
For the locale/region, consider:
- Regionally prevalent health conditions
- Common food allergens in that region
- Common medications using regional brand names where possible
- Popular dietary patterns and food cultures
- Health goals typical for that population

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "conditions": ["condition1", "condition2", ...],
  "allergies": ["allergen1", "allergen2", ...],
  "medications": ["med1", "med2", ...],
  "dietaryPreferences": ["diet1", "diet2", ...],
  "healthGoals": ["goal1", "goal2", ...]
}

Each category should have 8-12 items. Keep each item short (1-4 words).`;

/**
 * Call the AI provider to generate locale-aware onboarding suggestions.
 * Returns null on failure (caller should use fallbacks).
 * Enforces a 15-second timeout.
 */
export async function generateOnboardingSuggestions(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<OnboardingSuggestions | null> {
  try {
    const { locale, timezone } = getLocaleInfo();
    const prompt = SUGGESTIONS_PROMPT
      .replace('{locale}', locale)
      .replace('{timezone}', timezone);

    // Race against a 15s timeout
    const responsePromise = provider.answerHealthQuery(
      {
        query: prompt,
        conversationHistory: [],
        context: { profile: {}, recentInteractions: [] },
      },
      config,
    );

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 15_000),
    );

    const result = await Promise.race([responsePromise, timeoutPromise]);
    if (!result) return null;

    // Parse the AI's answer — it should be a JSON object
    const parsed = safeParseJSON<OnboardingSuggestions>(result.answer);
    if (!parsed) return null;

    // Validate shape
    const isValid =
      Array.isArray(parsed.conditions) &&
      Array.isArray(parsed.allergies) &&
      Array.isArray(parsed.medications) &&
      Array.isArray(parsed.dietaryPreferences) &&
      Array.isArray(parsed.healthGoals);

    if (!isValid) return null;

    // Sanitise: trim, remove empties, deduplicate, cap at 12 each
    const sanitise = (arr: string[]) =>
      [...new Set(arr.map((s) => s.trim()).filter(Boolean))].slice(0, 12);

    return {
      conditions: sanitise(parsed.conditions),
      allergies: sanitise(parsed.allergies),
      medications: sanitise(parsed.medications),
      dietaryPreferences: sanitise(parsed.dietaryPreferences),
      healthGoals: sanitise(parsed.healthGoals),
    };
  } catch {
    console.warn('[HealthVault] Failed to generate onboarding suggestions');
    return null;
  }
}
