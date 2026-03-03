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
  "alternatives": ["optional array of safer alternative suggestions"],
  "nutrition": {
    "servingSize": "estimated serving size, e.g. '1 cup (240g)' or '100g'",
    "nutrients": [
      { "nutrient": "Calories", "amount": 0, "unit": "kcal" },
      { "nutrient": "Total Fat", "amount": 0, "unit": "g" },
      { "nutrient": "Saturated Fat", "amount": 0, "unit": "g" },
      { "nutrient": "Trans Fat", "amount": 0, "unit": "g" },
      { "nutrient": "Cholesterol", "amount": 0, "unit": "mg" },
      { "nutrient": "Sodium", "amount": 0, "unit": "mg" },
      { "nutrient": "Total Carbohydrate", "amount": 0, "unit": "g" },
      { "nutrient": "Dietary Fiber", "amount": 0, "unit": "g" },
      { "nutrient": "Total Sugars", "amount": 0, "unit": "g" },
      { "nutrient": "Added Sugars", "amount": 0, "unit": "g" },
      { "nutrient": "Protein", "amount": 0, "unit": "g" },
      { "nutrient": "Vitamin D", "amount": 0, "unit": "mcg" },
      { "nutrient": "Calcium", "amount": 0, "unit": "mg" },
      { "nutrient": "Iron", "amount": 0, "unit": "mg" },
      { "nutrient": "Potassium", "amount": 0, "unit": "mg" }
    ]
  }
}

Rules:
- "avoid" if any ingredient is a known allergen for this user, or has dangerous interactions with their medications.
- "caution" if an ingredient may worsen a condition or conflict with dietary preferences.
- "safe" if no concerns found.
- Include ALL ingredients in the details array.
- Keep reasons concise (1-2 sentences).
- In the "nutrition" object, estimate the nutrient amounts per serving based on the ingredients. Use your best knowledge of typical nutritional content. Replace the 0 placeholders with your estimates. You may add additional nutrients (e.g. Vitamin A, Vitamin C, Zinc) if relevant.`;
}
