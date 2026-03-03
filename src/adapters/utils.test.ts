import { describe, it, expect } from 'vitest';
import { safeParseJSON } from './utils';

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    const result = safeParseJSON<{ a: number }>('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  it('handles whitespace around JSON', () => {
    const result = safeParseJSON<{ b: string }>('  {"b": "hello"}  ');
    expect(result).toEqual({ b: 'hello' });
  });

  it('strips markdown code fences (json)', () => {
    const input = '```json\n{"overall": "safe", "summary": "ok"}\n```';
    const result = safeParseJSON<{ overall: string; summary: string }>(input);
    expect(result).toEqual({ overall: 'safe', summary: 'ok' });
  });

  it('strips markdown code fences (plain)', () => {
    const input = '```\n{"x": 42}\n```';
    const result = safeParseJSON<{ x: number }>(input);
    expect(result).toEqual({ x: 42 });
  });

  it('strips code fence with trailing whitespace', () => {
    const input = '```json  \n{"a":1}\n```  ';
    expect(safeParseJSON(input)).toEqual({ a: 1 });
  });

  it('throws descriptive error for invalid JSON', () => {
    expect(() => safeParseJSON('not json')).toThrow(
      /Failed to parse AI response as JSON/,
    );
  });

  it('throws on empty response', () => {
    expect(() => safeParseJSON('')).toThrow(/empty response/);
    expect(() => safeParseJSON('  ')).toThrow(/empty response/);
  });

  it('repairs truncated JSON by closing braces', () => {
    const truncated =
      '{"overall":"safe","summary":"ok","details":[{"ingredient":"sugar","status":"safe","reason":"fine"';
    const result = safeParseJSON<{ overall: string }>(truncated);
    expect(result.overall).toBe('safe');
  });

  it('includes raw response snippet in error', () => {
    const longBadResponse = 'a'.repeat(400);
    try {
      safeParseJSON(longBadResponse);
      expect.fail('should throw');
    } catch (e) {
      expect((e as Error).message).toContain('Raw response (first 300 chars)');
    }
  });

  it('parses complex nested objects', () => {
    const input = JSON.stringify({
      overall: 'caution',
      summary: 'Some concerns found',
      details: [
        { ingredient: 'sugar', status: 'caution', reason: 'High sugar' },
      ],
      alternatives: ['stevia'],
    });
    const result = safeParseJSON<{ overall: string; details: unknown[] }>(
      input,
    );
    expect(result.overall).toBe('caution');
    expect(result.details).toHaveLength(1);
  });

  it('handles empty object', () => {
    expect(safeParseJSON('{}')).toEqual({});
  });

  it('handles arrays', () => {
    expect(safeParseJSON('[1,2,3]')).toEqual([1, 2, 3]);
  });
});
