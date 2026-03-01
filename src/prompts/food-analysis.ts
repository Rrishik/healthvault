// HealthVault — Food analysis prompt template

import type { FoodAnalysisRequest } from '../types';
import { formatProfile } from './utils';

export function buildFoodAnalysisPrompt(request: FoodAnalysisRequest): string {
  return `Analyze the following food ingredients for safety given the user's health profile.

USER PROFILE:
${formatProfile(request.context)}

INGREDIENTS:
${request.ingredients.join(', ')}

Respond with a JSON object matching this exact schema:
{
  "overall": "safe" | "caution" | "avoid",
  "summary": "Brief one-sentence summary of the verdict",
  "details": [
    {
      "ingredient": "ingredient name",
      "status": "safe" | "caution" | "avoid",
      "reason": "Why this ingredient is flagged or safe"
    }
  ],
  "alternatives": ["optional array of safer alternative suggestions"]
}

Rules:
- "avoid" if any ingredient is a known allergen for this user, or has dangerous interactions with their medications.
- "caution" if an ingredient may worsen a condition or conflict with dietary preferences.
- "safe" if no concerns found.
- Include ALL ingredients in the details array.
- Keep reasons concise (1-2 sentences).`;
}
