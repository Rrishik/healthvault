// HealthVault — Health query prompt template

import type { HealthQueryRequest } from '../types';
import { formatProfile, formatHistory } from './utils';

export function buildHealthQueryPrompt(request: HealthQueryRequest): string {
  return `Answer the user's health question using their profile and history for context.

USER PROFILE:
${formatProfile(request.context)}

RECENT HISTORY (for context, not to repeat):
${formatHistory(request.context)}

USER QUESTION:
${request.query}

Respond with a JSON object matching this exact schema:
{
  "answer": "Your helpful, empathetic response to the user's question. Include a medical disclaimer if relevant.",
  "suggestedProfileUpdates": {
    "conditions": ["any new conditions mentioned by the user"],
    "allergies": ["any new allergies mentioned"],
    "medications": ["any new medications mentioned"]
  }
}

Rules:
- "answer" is required and should be comprehensive but concise. Keep it under 800 tokens.
- "suggestedProfileUpdates" is optional. Only include it if the user's question EXPLICITLY mentions a condition, allergy, or medication not already in their profile.
- Do NOT diagnose. Suggest consulting a healthcare provider when appropriate.
- Personalize your answer based on the user's profile.`;
}
