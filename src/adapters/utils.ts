// HealthVault — Shared adapter utilities

/**
 * Safely parse a JSON string from an AI response.
 * Strips markdown code fences if present and provides descriptive errors.
 */
export function safeParseJSON<T>(raw: string): T {
  let cleaned = raw.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(
      `Failed to parse AI response as JSON: ${e instanceof Error ? e.message : String(e)}\n` +
        `Raw response (first 300 chars): ${raw.slice(0, 300)}`,
    );
  }
}
