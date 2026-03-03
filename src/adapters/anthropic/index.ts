// HealthVault — Anthropic (Claude) adapter

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
import { getSystemPrompt } from '../../prompts/system';

const ANTHROPIC_MODELS = [
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
  { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
];

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

async function createMessage(
  messages: AnthropicMessage[],
  config: Record<string, string>,
  system?: string,
): Promise<string> {
  const baseUrl =
    config.baseUrl?.replace(/\/+$/, '') || 'https://api.anthropic.com';
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system,
      messages,
      temperature: DEFAULT_TEMPERATURE,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const textBlock = data.content.find(
    (b: { type: string }) => b.type === 'text',
  );
  return textBlock?.text ?? '';
}

const anthropicProvider: AIProvider = {
  id: 'anthropic',
  name: 'Anthropic (Claude)',
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
      placeholder: 'sk-ant-...',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      required: true,
      options: ANTHROPIC_MODELS,
      defaultValue: 'claude-3-5-sonnet-20241022',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      placeholder: 'https://api.anthropic.com',
    },
  ],

  async validateConfig(config) {
    // Anthropic doesn't have a lightweight "list models" endpoint.
    // Send a minimal message to check the key works.
    try {
      await createMessage(
        [{ role: 'user', content: 'Hi' }],
        config,
        'Respond with "ok".',
      );
      return true;
    } catch {
      return false;
    }
  },

  async analyzeFood(request: FoodAnalysisRequest, config) {
    const prompt = buildFoodAnalysisPrompt(request);
    const raw = await createMessage(
      [{ role: 'user', content: prompt }],
      config,
      getSystemPrompt() +
        '\n\nIMPORTANT: Respond ONLY with valid JSON matching the FoodVerdict schema.',
    );
    return safeParseJSON<FoodVerdict>(raw);
  },

  async answerHealthQuery(request: HealthQueryRequest, config) {
    const prompt = buildHealthQueryPrompt(request);
    const messages: AnthropicMessage[] = [
      ...request.conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: prompt },
    ];
    const raw = await createMessage(
      messages,
      config,
      getSystemPrompt() +
        '\n\nIMPORTANT: Respond ONLY with valid JSON matching the HealthQueryResponse schema.',
    );
    return safeParseJSON<HealthQueryResponse>(raw);
  },

  async analyzeImage(request: ImageAnalysisRequest, config) {
    const prompt = buildImageAnalysisPrompt(request);
    const raw = await createMessage(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: request.mimeType,
                data: request.imageBase64,
              },
            },
          ],
        },
      ],
      config,
      getSystemPrompt() +
        '\n\nIMPORTANT: Respond ONLY with valid JSON matching the FoodVerdict schema.',
    );
    return safeParseJSON<FoodVerdict>(raw);
  },
};

registerProvider(anthropicProvider);
