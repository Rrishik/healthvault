// HealthVault — Shared prompt utilities

import type { HealthContext } from '../types';
import type { HealthQueryRequest } from '../adapters/types';

/**
 * Format a user's health profile into a human-readable string for AI prompts.
 * Includes all available profile fields.
 */
export function formatProfile(ctx: HealthContext): string {
  const p = ctx.profile;
  const parts: string[] = [];
  if (p.ageRange) parts.push(`Age range: ${p.ageRange}`);
  if (p.sex) parts.push(`Sex: ${p.sex}`);
  if (p.heightCm) parts.push(`Height: ${p.heightCm} cm`);
  if (p.weightKg) parts.push(`Weight: ${p.weightKg} kg`);
  if (p.conditions?.length) parts.push(`Conditions: ${p.conditions.join(', ')}`);
  if (p.allergies?.length) parts.push(`Allergies: ${p.allergies.join(', ')}`);
  if (p.medications?.length) parts.push(`Medications: ${p.medications.join(', ')}`);
  if (p.dietaryPreferences?.length)
    parts.push(`Diet: ${p.dietaryPreferences.join(', ')}`);
  if (p.healthGoals?.length) parts.push(`Goals: ${p.healthGoals.join(', ')}`);
  return parts.length > 0 ? parts.join('\n') : 'No profile information available.';
}

/**
 * Format recent interaction history into a readable string for AI prompts.
 */
export function formatHistory(ctx: HealthQueryRequest['context']): string {
  if (!ctx.recentInteractions.length) return 'No previous interactions.';
  return ctx.recentInteractions
    .slice(0, 5)
    .map(
      (i) =>
        `[${new Date(i.timestamp).toLocaleDateString()}] ${i.type}: "${i.query}" → "${i.response.slice(0, 120)}..."`,
    )
    .join('\n');
}
