// HealthVault — AI-generated conversation starters
// Generates personalised chat starters based on the user's health profile,
// caches them in AppSettings, and randomly picks a subset for display.

import type { AIProvider } from '../adapters/types';
import type { HealthProfile } from '../types';
import { assembleContext } from './context-assembler';
import { safeParseJSON } from '../adapters/utils';

const STARTERS_QUERY = `Based on my health profile, generate exactly 12 short, personalised conversation-starter questions I might want to ask you. Each should be a single sentence (max 60 chars) and cover a mix of:
- food/ingredient interactions with my medications or conditions
- dietary tips aligned with my preferences and goals
- practical health management for my conditions
- things to watch out for given my allergies

Return ONLY a JSON object: { "answer": ["starter1", "starter2", ...], "suggestedProfileUpdates": null }
Do NOT include markdown, code fences, or text outside the JSON.`;

/**
 * Call the configured AI provider to generate personalised starters.
 * Returns 10–15 short question strings, or null on failure.
 */
export async function generateChatStarters(
  provider: AIProvider,
  config: Record<string, string>,
  _profile?: HealthProfile | null, // kept for future direct-profile mode
): Promise<string[] | null> {
  try {
    const context = await assembleContext({ maxInteractions: 3 });

    // If the profile is essentially empty there's nothing to personalise
    const p = context.profile;
    const hasData =
      (p.conditions?.length ?? 0) > 0 ||
      (p.allergies?.length ?? 0) > 0 ||
      (p.medications?.length ?? 0) > 0 ||
      (p.dietaryPreferences?.length ?? 0) > 0 ||
      (p.healthGoals?.length ?? 0) > 0;
    if (!hasData) return null;

    const response = await provider.answerHealthQuery(
      {
        query: STARTERS_QUERY,
        conversationHistory: [],
        context,
      },
      config,
    );

    // The provider returns { answer, suggestedProfileUpdates }.
    // We asked the AI to put a JSON array in the answer field.
    // Try parsing the answer as JSON array first; fall back to line splitting.
    let starters: string[] | null = null;

    // Attempt 1: answer is already a JSON array string
    const parsed = safeParseJSON<string[] | { answer: string[] }>(response.answer);
    if (Array.isArray(parsed)) {
      starters = parsed;
    } else if (parsed && Array.isArray((parsed as { answer: string[] }).answer)) {
      starters = (parsed as { answer: string[] }).answer;
    }

    // Attempt 2: answer is plain text with numbered lines
    if (!starters) {
      starters = response.answer
        .split('\n')
        .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter((l) => l.length > 5 && l.length <= 80 && l.endsWith('?'));
    }

    if (!starters || starters.length === 0) return null;

    // Sanitise: trim, enforce max length, remove duplicates
    return [...new Set(starters.map((s) => s.trim()).filter((s) => s.length > 0))].slice(0, 15);
  } catch {
    // Swallow errors — starters are a nice-to-have, not critical
    console.warn('[HealthVault] Failed to generate chat starters');
    return null;
  }
}

/**
 * Randomly pick `count` items from the cached starters array.
 */
export function pickRandomStarters(starters: string[], count = 3): string[] {
  if (starters.length <= count) return starters;
  const shuffled = [...starters].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
