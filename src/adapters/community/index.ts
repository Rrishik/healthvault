// HealthVault — Community adapter (free, no API key needed)
// Uses the HealthVault Azure Function proxy

import type {
  AIProvider,
  FoodAnalysisRequest,
  HealthQueryRequest,
  HealthQueryResponse,
  ImageAnalysisRequest,
} from '../types';
import type { FoodVerdict } from '../../types';
import { registerProvider } from '../registry';
import { safeParseJSON } from '../utils';
import { buildFoodAnalysisPrompt } from '../../prompts/food-analysis';
import { buildHealthQueryPrompt } from '../../prompts/health-query';
import { buildImageAnalysisPrompt } from '../../prompts/image-analysis';
import { SYSTEM_PROMPT } from '../../prompts/system';

const PROXY_URL =
  'https://healthvault-proxy-e0gxb5a4adh9hean.eastus-01.azurewebsites.net/api/chat';

async function chatCompletion(
  messages: { role: string; content: unknown }[],
): Promise<string> {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Community API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

const communityProvider: AIProvider = {
  id: 'community',
  name: 'HealthVault Community (Free)',
  capabilities: {
    foodAnalysis: true,
    healthQuery: true,
    imageAnalysis: true,
  },
  configSchema: [], // No config needed!

  async validateConfig() {
    try {
      await chatCompletion([{ role: 'user', content: 'Hi' }]);
      return true;
    } catch {
      return false;
    }
  },

  async analyzeFood(request: FoodAnalysisRequest) {
    const prompt = buildFoodAnalysisPrompt(request);
    const raw = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    );
    return safeParseJSON<FoodVerdict>(raw);
  },

  async answerHealthQuery(request: HealthQueryRequest) {
    const prompt = buildHealthQueryPrompt(request);
    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...request.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];
    const raw = await chatCompletion(messages);
    return safeParseJSON<HealthQueryResponse>(raw);
  },

  async analyzeImage(request: ImageAnalysisRequest) {
    const prompt = buildImageAnalysisPrompt(request);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${request.mimeType};base64,${request.imageBase64}`,
            },
          },
        ],
      },
    ];
    const raw = await chatCompletion(messages);
    return safeParseJSON<FoodVerdict>(raw);
  },
};

registerProvider(communityProvider);
