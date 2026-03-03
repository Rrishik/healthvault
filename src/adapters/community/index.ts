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
import { LOG_PREFIX } from '../../constants';
import { buildFoodAnalysisPrompt } from '../../prompts/food-analysis';
import { buildHealthQueryPrompt } from '../../prompts/health-query';
import { buildImageAnalysisPrompt } from '../../prompts/image-analysis';
import { getSystemPrompt } from '../../prompts/system';

const PROXY_URL =
  'https://healthvault-proxy-e0gxb5a4adh9hean.eastus-01.azurewebsites.net/api/chat';

async function chatCompletion(
  messages: { role: string; content: unknown }[],
  config?: Record<string, string>,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config?.accessCode) {
    headers['x-access-code'] = config.accessCode;
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Community API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const finish = data.choices?.[0]?.finish_reason;
  const content = data.choices?.[0]?.message?.content;
  const usage = data.usage;
  console.log(LOG_PREFIX, 'Community response', {
    finish,
    contentLength: content?.length ?? 0,
    usage,
    raw: content?.slice(0, 300),
  });
  if (!content) {
    console.error(
      LOG_PREFIX,
      'Empty content from Community API. Full response:',
      JSON.stringify(data),
    );
    // Detect reasoning model consuming entire token budget
    const reasoning = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    const completion = usage?.completion_tokens ?? 0;
    if (finish === 'length' && reasoning > 0 && reasoning >= completion) {
      throw new Error(
        "The AI used all available tokens for internal reasoning and couldn't generate a response. Please try again — if the issue persists, try with fewer ingredients or a simpler query.",
      );
    }
    throw new Error(
      finish === 'length'
        ? 'The AI response was cut off before it could finish. Please try again with fewer ingredients.'
        : 'AI returned an empty response. Please try again.',
    );
  }
  return content;
}

const communityProvider: AIProvider = {
  id: 'community',
  name: 'HealthVault Community (Free)',
  capabilities: {
    foodAnalysis: true,
    healthQuery: true,
    imageAnalysis: true,
  },
  configSchema: [
    {
      key: 'accessCode',
      label: 'Access Code',
      type: 'password',
      required: false,
      placeholder: 'Enter invite code (if you have one)',
    },
  ],

  async validateConfig(config?: Record<string, string>) {
    try {
      await chatCompletion([{ role: 'user', content: 'Hi' }], config);
      return true;
    } catch {
      return false;
    }
  },

  async analyzeFood(
    request: FoodAnalysisRequest,
    config?: Record<string, string>,
  ) {
    const prompt = buildFoodAnalysisPrompt(request);
    const raw = await chatCompletion(
      [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      config,
    );
    return safeParseJSON<FoodVerdict>(raw);
  },

  async answerHealthQuery(
    request: HealthQueryRequest,
    config?: Record<string, string>,
  ) {
    const prompt = buildHealthQueryPrompt(request);
    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: getSystemPrompt() },
      ...request.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];
    const raw = await chatCompletion(messages, config);
    return safeParseJSON<HealthQueryResponse>(raw);
  },

  async analyzeImage(
    request: ImageAnalysisRequest,
    config?: Record<string, string>,
  ) {
    const prompt = buildImageAnalysisPrompt(request);
    const messages = [
      { role: 'system', content: getSystemPrompt() },
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
    const raw = await chatCompletion(messages, config);
    return safeParseJSON<FoodVerdict>(raw);
  },
};

registerProvider(communityProvider);
