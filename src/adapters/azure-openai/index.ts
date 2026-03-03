// HealthVault — Azure OpenAI adapter
// Uses Azure's OpenAI Service which has a different URL structure:
// https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=...

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
import { SYSTEM_PROMPT } from '../../prompts/system';

const API_VERSION = '2024-10-21';

async function chatCompletion(
  messages: { role: string; content: unknown }[],
  config: Record<string, string>,
): Promise<string> {
  const endpoint = config.endpoint?.replace(/\/+$/, '');
  const deployment = config.deployment;
  const apiVersion = config.apiVersion || API_VERSION;

  if (!endpoint || !deployment) {
    throw new Error('Azure OpenAI requires an endpoint and deployment name');
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      messages,
      ...(config.temperature ? { temperature: parseFloat(config.temperature) } : {}),
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure OpenAI API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const finish = data.choices?.[0]?.finish_reason;
  const content = data.choices?.[0]?.message?.content;
  console.log(LOG_PREFIX, 'Azure OpenAI response', { finish, contentLength: content?.length ?? 0, raw: content?.slice(0, 300) });
  if (!content) {
    console.error(LOG_PREFIX, 'Empty content from Azure OpenAI API. Full response:', JSON.stringify(data));
    throw new Error(
      finish === 'length'
        ? 'The AI response was cut off before it could finish. Please try again with fewer ingredients.'
        : 'AI returned an empty response. Please try again.',
    );
  }
  return content;
}

const azureOpenaiProvider: AIProvider = {
  id: 'azure-openai',
  name: 'Azure OpenAI',
  capabilities: {
    foodAnalysis: true,
    healthQuery: true,
    imageAnalysis: true,
  },
  configSchema: [
    {
      key: 'endpoint',
      label: 'Endpoint',
      type: 'url',
      required: true,
      placeholder: 'https://your-resource.openai.azure.com',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your Azure OpenAI key',
    },
    {
      key: 'deployment',
      label: 'Deployment Name',
      type: 'text',
      required: true,
      placeholder: 'gpt-4o',
    },
    {
      key: 'apiVersion',
      label: 'API Version',
      type: 'text',
      required: false,
      placeholder: API_VERSION,
      defaultValue: API_VERSION,
    },
  ],

  async validateConfig(config) {
    try {
      const endpoint = config.endpoint?.replace(/\/+$/, '');
      const deployment = config.deployment;
      const apiVersion = config.apiVersion || API_VERSION;
      if (!endpoint || !deployment) return false;

      const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
          max_completion_tokens: 5,
        }),
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

registerProvider(azureOpenaiProvider);
