import { describe, it, expect } from 'vitest';
import { formatProfile } from './utils';
import type { HealthContext } from '../types';

function makeContext(
  profile: Partial<HealthContext['profile']> = {},
): HealthContext {
  return {
    profile: {
      conditions: [],
      allergies: [],
      medications: [],
      dietaryPreferences: [],
      healthGoals: [],
      ...profile,
    },
    recentInteractions: [],
  };
}

describe('formatProfile', () => {
  it('returns fallback for empty profile', () => {
    const result = formatProfile(makeContext());
    expect(result).toBe('No profile information available.');
  });

  it('includes conditions', () => {
    const result = formatProfile(
      makeContext({ conditions: ['Diabetes', 'Hypertension'] }),
    );
    expect(result).toContain('Conditions: Diabetes, Hypertension');
  });

  it('includes allergies', () => {
    const result = formatProfile(makeContext({ allergies: ['Peanuts'] }));
    expect(result).toContain('Allergies: Peanuts');
  });

  it('includes medications', () => {
    const result = formatProfile(
      makeContext({ medications: ['Metformin', 'Lisinopril'] }),
    );
    expect(result).toContain('Medications: Metformin, Lisinopril');
  });

  it('includes dietary preferences', () => {
    const result = formatProfile(
      makeContext({ dietaryPreferences: ['Vegan'] }),
    );
    expect(result).toContain('Diet: Vegan');
  });

  it('includes health goals', () => {
    const result = formatProfile(
      makeContext({ healthGoals: ['Lose Weight'] }),
    );
    expect(result).toContain('Goals: Lose Weight');
  });

  it('includes age, sex, height, weight when present', () => {
    const result = formatProfile(
      makeContext({
        ageRange: '25-34',
        sex: 'Male',
        heightCm: 175,
        weightKg: 70,
      }),
    );
    expect(result).toContain('Age range: 25-34');
    expect(result).toContain('Sex: Male');
    expect(result).toContain('Height: 175 cm');
    expect(result).toContain('Weight: 70 kg');
  });

  it('joins multiple fields with newlines', () => {
    const result = formatProfile(
      makeContext({
        conditions: ['Diabetes'],
        allergies: ['Gluten'],
      }),
    );
    expect(result).toBe('Conditions: Diabetes\nAllergies: Gluten');
  });

  it('skips empty arrays', () => {
    const result = formatProfile(
      makeContext({
        conditions: [],
        allergies: ['Peanuts'],
        medications: [],
      }),
    );
    expect(result).toBe('Allergies: Peanuts');
    expect(result).not.toContain('Conditions');
    expect(result).not.toContain('Medications');
  });

  it('includes all fields in a full profile', () => {
    const result = formatProfile(
      makeContext({
        ageRange: '35-44',
        sex: 'Female',
        heightCm: 165,
        weightKg: 60,
        conditions: ['IBS'],
        allergies: ['Eggs'],
        medications: ['Omeprazole'],
        dietaryPreferences: ['Gluten-Free'],
        healthGoals: ['Improve Gut Health'],
      }),
    );
    const lines = result.split('\n');
    expect(lines).toHaveLength(9);
  });
});
