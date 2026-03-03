// HealthVault — Image analysis prompt template

import type { ImageAnalysisRequest } from '../types';
import { formatProfile } from './utils';

export function buildImageAnalysisPrompt(
  request: ImageAnalysisRequest,
): string {
  return `Analyze the attached image. Determine what it shows and respond accordingly.

USER PROFILE:
${formatProfile(request.context)}

STEP 1 — Classify the image into one of three categories:

A) INGREDIENTS LABEL — The image shows a food label, ingredients list, or nutrition facts panel.
   → Read all text, identify every ingredient, assess each against the user's profile.
   → Set "imageType" to "label".

B) FOOD ITEM — The image shows a recognizable food product, dish, snack, or beverage (e.g. a burger, a bag of chips, a bowl of rice, a can of soda).
   → Identify the food item.
   → List the typical/common ingredients for that food based on your general knowledge.
   → Assess each ingredient against the user's profile.
   → Set "imageType" to "food_item".
   → Set "ingredientSource" to a brief attribution, e.g. "Common ingredients for [food name] (based on general knowledge — actual ingredients may vary by brand/recipe)".

C) NOT FOOD — The image does not appear to be a food item or food label.
   → Set "imageType" to "not_food".
   → Set "overall" to "caution".
   → Set "summary" to a message explaining this doesn't appear to be a food item or ingredients label.
   → Return an empty "details" array.

STEP 2 — Respond with a JSON object matching this exact schema:
{
  "imageType": "label" | "food_item" | "not_food",
  "overall": "safe" | "caution" | "avoid",
  "summary": "Brief one-sentence summary",
  "details": [
    {
      "ingredient": "ingredient name",
      "status": "safe" | "caution" | "avoid",
      "reason": "Explanation"
    }
  ],
  "alternatives": ["optional safer alternatives"],
  "ingredientSource": "Only for food_item — brief attribution of where the ingredients list came from"
}

Rules:
- "avoid" if any ingredient is a known allergen or has dangerous drug interactions for this user.
- "caution" if an ingredient may worsen a condition or conflict with dietary preferences.
- "safe" if no concerns found.
- Include ALL identified ingredients in the details array.
- Keep reasons concise (1-2 sentences).
- For food_item images, always include the "ingredientSource" field.
- For label images, omit the "ingredientSource" field.`;
}
