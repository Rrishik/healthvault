// HealthVault — AI-generated daily health tip
// Generates one personalized health tip per day based on the user's profile.
// Caches in localStorage with a date key so the AI is called at most once/day.

import type { AIProvider } from '../adapters/types';
import { assembleContext } from './context-assembler';
import { AI_REQUEST_TIMEOUT_MS, LOG_PREFIX } from '../constants';

const LS_KEY = 'hv_daily_tip';

interface CachedTip {
  date: string; // YYYY-MM-DD
  tip: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Read the cached tip if it's from today. */
function getCachedTip(): string | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cached: CachedTip = JSON.parse(raw);
    if (cached.date === todayKey() && cached.tip) return cached.tip;
    return null;
  } catch {
    return null;
  }
}

/** Store today's tip. */
function cacheTip(tip: string): void {
  const entry: CachedTip = { date: todayKey(), tip };
  localStorage.setItem(LS_KEY, JSON.stringify(entry));
}

const TIP_PROMPT = `Based on my health profile, give me one short, actionable health tip for today.
Keep it to 1-2 sentences (max 120 characters).
Make it practical and specific to my conditions, medications, allergies, or dietary preferences.
Vary the topic each time — could be about food, exercise, sleep, hydration, medication timing, etc.
Return ONLY the tip text, nothing else.`;

/**
 * Get the daily health tip — returns cached if available, otherwise generates a new one.
 * Returns null on failure (caller should hide the tip section).
 */
export async function getDailyTip(
  provider: AIProvider,
  config: Record<string, string>,
): Promise<string | null> {
  // Return cached tip if still valid for today
  const cached = getCachedTip();
  if (cached) return cached;

  try {
    const context = await assembleContext({ maxInteractions: 0 });

    // Skip if profile is essentially empty
    const p = context.profile;
    const hasData =
      (p.conditions?.length ?? 0) > 0 ||
      (p.allergies?.length ?? 0) > 0 ||
      (p.medications?.length ?? 0) > 0 ||
      (p.dietaryPreferences?.length ?? 0) > 0 ||
      (p.healthGoals?.length ?? 0) > 0;
    if (!hasData) return null;

    const result = await Promise.race([
      provider.answerHealthQuery(
        {
          query: TIP_PROMPT,
          conversationHistory: [],
          context,
        },
        config,
      ),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), AI_REQUEST_TIMEOUT_MS),
      ),
    ]);

    if (!result) {
      console.warn(`${LOG_PREFIX} Daily tip timed out`);
      return null;
    }

    // Clean up the tip — remove quotes, trim
    const tip = result.answer
      .replace(/^["']|["']$/g, '')
      .trim()
      .split('\n')[0]; // Take only the first line

    if (tip && tip.length > 0) {
      cacheTip(tip);
      return tip;
    }
    return null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to generate daily tip`, err);
    return null;
  }
}
