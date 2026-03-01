// HealthVault — ContextAssembler
// Pulls profile + recent interactions from IndexedDB
// and returns a provider-agnostic HealthContext object.

import type { HealthContext } from '../types';
import { getProfile, getRecentInteractions } from './db';

export interface ContextAssemblerOptions {
  /** Maximum number of past interactions to include (default 10) */
  maxInteractions?: number;
}

/**
 * Assemble a HealthContext object from the local database.
 * The returned object is safe to serialize and pass to any AI adapter.
 */
export async function assembleContext(
  options: ContextAssemblerOptions = {},
): Promise<HealthContext> {
  const { maxInteractions = 10 } = options;

  const [profile, interactions] = await Promise.all([
    getProfile(),
    getRecentInteractions(maxInteractions),
  ]);

  return {
    profile: profile
      ? {
          ageRange: profile.ageRange,
          sex: profile.sex,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          conditions: profile.conditions,
          allergies: profile.allergies,
          medications: profile.medications,
          dietaryPreferences: profile.dietaryPreferences,
          healthGoals: profile.healthGoals,
        }
      : {},
    recentInteractions: interactions.map((i) => ({
      type: i.type,
      query: i.query,
      response: i.response,
      timestamp: i.timestamp,
    })),
  };
}
