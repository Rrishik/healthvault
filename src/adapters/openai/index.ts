// HealthVault — OpenAI adapter

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
import { DEFAULT_TEMPERATURE } from '../../constants';
import { buildFoodAnalysisPrompt } from '../../prompts/food-analysis';
import { buildHealthQueryPrompt } from '../../prompts/health-query';
import { buildImageAnalysisPrompt } from '../../prompts/image-analysis';
import { SYSTEM_PROMPT } from '../../prompts/system';

const OPENAI_MODELS = [
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
];

async function chatCompletion(
  messages: { role: string; content: unknown }[],
  config: Record<string, string>,
): Promise<string> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://api.openai.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: DEFAULT_TEMPERATURE,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

const openaiProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI',
  capabilities: {
    foodAnalysis: true,
    healthQuery: true,
    imageAnalysis: true,
  },
  configSchema: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'sk-...',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      required: true,
      options: OPENAI_MODELS,
      defaultValue: 'gpt-4o-mini',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      placeholder: 'https://api.openai.com/v1',
    },
  ],

  async validateConfig(config) {
    try {
      const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://api.openai.com/v1';
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async analyzeFood(request: FoodAnalysisRequest, config) {
    const prompt = buildFoodAnalysisPrompt(request);
    const raw = await chatCompletion(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      config,
    );
    return safeParseJSON<FoodVerdict>(raw);
  },

  async answerHealthQuery(request: HealthQueryRequest, config) {
    const prompt = buildHealthQueryPrompt(request);
    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...request.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];
    const raw = await chatCompletion(messages, config);
    return safeParseJSON<HealthQueryResponse>(raw);
  },

  async analyzeImage(request: ImageAnalysisRequest, config) {
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
    const raw = await chatCompletion(messages, config);
    return safeParseJSON<FoodVerdict>(raw);
  },
};

registerProvider(openaiProvider);
