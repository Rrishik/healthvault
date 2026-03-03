// HealthVault — Shared adapter utilities

import { DEBUG_TRUNCATE_LENGTH, LOG_PREFIX } from '../constants';

/**
 * Safely parse a JSON string from an AI response.
 * Strips markdown code fences if present and provides descriptive errors.
 */
export function safeParseJSON<T>(raw: string): T {
  let cleaned = raw.trim();

  if (!cleaned) {
    console.error(LOG_PREFIX, 'AI returned empty response body');
    throw new Error('AI returned an empty response. Please try again.');
  }

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn(LOG_PREFIX, 'JSON parse failed, attempting repair. Raw:', raw.slice(0, DEBUG_TRUNCATE_LENGTH));
    // Attempt to repair truncated JSON by closing open brackets/braces
    const repaired = tryRepairJSON(cleaned);
    if (repaired !== null) {
      console.info(LOG_PREFIX, 'Successfully repaired truncated JSON');
      return repaired as T;
    }
    throw new Error(
      `Failed to parse AI response as JSON. The response may have been cut off.\n` +
        `Raw response (first ${DEBUG_TRUNCATE_LENGTH} chars): ${raw.slice(0, DEBUG_TRUNCATE_LENGTH)}`,
    );
  }
}

/**
 * Attempt to repair truncated JSON by closing unclosed brackets, braces,
 * and strings. Uses a stack to close in the correct order.
 * Returns the parsed result or null if repair fails.
 */
function tryRepairJSON(text: string): unknown | null {
  let attempt = text;

  // Remove trailing comma or partial key/value
  attempt = attempt.replace(/,\s*$/, '');
  // Remove trailing partial string (unmatched quote)
  const quoteCount = (attempt.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    attempt += '"';
  }

  // Use a stack to track open structures in order
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < attempt.length; i++) {
    const ch = attempt[i];
    if (ch === '"' && (i === 0 || attempt[i - 1] !== '\\')) {
      inString = !inString;
    } else if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
  }

  // Close unclosed structures in reverse order
  while (stack.length > 0) {
    attempt += stack.pop();
  }

  try {
    return JSON.parse(attempt);
  } catch {
    return null;
  }
}
