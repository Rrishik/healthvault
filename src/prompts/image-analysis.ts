// HealthVault — Image analysis prompt template

import type { ImageAnalysisRequest } from '../types';
import { formatProfile } from './utils';

export function buildImageAnalysisPrompt(
  request: ImageAnalysisRequest,
): string {
  return `Analyze the food label or ingredient list in the attached image. Identify every ingredient and assess safety for the user.

USER PROFILE:
${formatProfile(request.context)}

Instructions:
1. Read all text visible in the image (focus on ingredient lists, nutrition facts, allergen warnings).
2. Identify each ingredient.
3. Assess each ingredient against the user's profile.

Respond with a JSON object matching this exact schema:
{
  "overall": "safe" | "caution" | "avoid",
  "summary": "Brief one-sentence summary",
  "details": [
    {
      "ingredient": "ingredient name",
      "status": "safe" | "caution" | "avoid",
      "reason": "Explanation"
    }
  ],
  "alternatives": ["optional safer alternatives"]
}

Rules:
- If the image is unreadable or not a food label, set overall to "caution" and explain in the summary.
- "avoid" if any ingredient is a known allergen or has dangerous drug interactions.
- Include ALL identified ingredients in the details array.`;
}
