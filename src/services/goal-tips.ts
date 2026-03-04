// HealthVault — Goal-specific tips service
// Generates one actionable tip per health goal, personalized to the user's profile.
// Caches tips in localStorage with a date key (one AI call per day).
// Tracks which tips have been "seen" so the badge can show on unseen ones.

import type { AIProvider } from '../adapters/types';
import { assembleContext } from './context-assembler';
import { AI_REQUEST_TIMEOUT_MS, LOG_PREFIX } from '../constants';

const LS_KEY = 'hv_goal_tips';
const LS_SEEN_KEY = 'hv_goal_tips_seen';

export interface GoalTip {
  goal: string;
  tip: string;
}

interface CachedGoalTips {
  date: string; // YYYY-MM-DD
  tips: GoalTip[];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Read cached goal tips if they're from today. */
function getCachedTips(): GoalTip[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cached: CachedGoalTips = JSON.parse(raw);
    if (cached.date === todayKey() && cached.tips?.length > 0)
      return cached.tips;
    return null;
  } catch {
    return null;
  }
}

/** Cache today's goal tips. */
function cacheTips(tips: GoalTip[]): void {
  const entry: CachedGoalTips = { date: todayKey(), tips };
  localStorage.setItem(LS_KEY, JSON.stringify(entry));
}

/** Get the set of goal names the user has already seen today. */
export function getSeenGoals(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_SEEN_KEY);
    if (!raw) return new Set();
    const parsed: { date: string; goals: string[] } = JSON.parse(raw);
    if (parsed.date === todayKey()) return new Set(parsed.goals);
    return new Set();
  } catch {
    return new Set();
  }
}

/** Mark a goal's tip as seen. */
export function markGoalSeen(goal: string): void {
  const seen = getSeenGoals();
  seen.add(goal);
  localStorage.setItem(
    LS_SEEN_KEY,
    JSON.stringify({ date: todayKey(), goals: [...seen] }),
  );
}

/** Clear cached goal tips (e.g. when profile changes). */
export function clearGoalTipsCache(): void {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_SEEN_KEY);
}

const TIPS_PROMPT = `Based on my health profile, give me one short, actionable tip for EACH of these health goals:
{goals}

For each goal, the tip should be:
- Practical and specific to my conditions, medications, allergies, or dietary preferences
- 1-2 sentences (max 120 characters per tip)
- Varied in topic (food, exercise, sleep, hydration, habits, etc.)

Return ONLY a JSON array of objects: [{"goal":"...","tip":"..."},...]
No markdown, no code fences, no extra text.`;

/**
 * Get tips for each health goal — cached per day, AI-generated otherwise.
 * Returns null on failure.
 */
export async function getGoalTips(
  provider: AIProvider,
  config: Record<string, string>,
  goals: string[],
): Promise<GoalTip[] | null> {
  if (goals.length === 0) return null;

  // Return cached tips if still valid for today and goals match
  const cached = getCachedTips();
  if (cached) {
    const cachedGoals = new Set(cached.map((t) => t.goal));
    const allMatch = goals.every((g) => cachedGoals.has(g));
    if (allMatch) return cached;
  }

  try {
    const context = await assembleContext({ maxInteractions: 0 });

    const prompt = TIPS_PROMPT.replace(
      '{goals}',
      goals.map((g) => `- ${g}`).join('\n'),
    );

    const result = await Promise.race([
      provider.answerHealthQuery(
        {
          query: prompt,
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
      console.warn(`${LOG_PREFIX} Goal tips timed out`);
      return null;
    }

    // Parse JSON array from the response
    const text = result.answer;
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) return null;

    const parsed: GoalTip[] = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Validate and clean
    const tips = parsed
      .filter((t) => t.goal && t.tip)
      .map((t) => ({ goal: t.goal.trim(), tip: t.tip.trim() }));

    if (tips.length > 0) {
      cacheTips(tips);
      return tips;
    }
    return null;
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to generate goal tips`, err);
    return null;
  }
}
