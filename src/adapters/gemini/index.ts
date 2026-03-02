// HealthVault — Google Gemini adapter

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

const GEMINI_MODELS = [
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
];

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function generateContent(
  parts: GeminiPart[],
  config: Record<string, string>,
  systemInstruction?: string,
): Promise<string> {
  const model = config.model || 'gemini-2.0-flash';
  const baseUrl =
    config.baseUrl?.replace(/\/+$/, '') ||
    'https://generativelanguage.googleapis.com/v1beta';
  const url = `${baseUrl}/models/${model}:generateContent?key=${config.apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: DEFAULT_TEMPERATURE,
      responseMimeType: 'application/json',
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

const geminiProvider: AIProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  capabilities: {
    foodAnalysis: true,
    healthQuery: true,
    imageAnalysis: true,
  },
  configSchema: [
    {
      key: '_securityNote',
      label: '⚠️ Security Notice',
      type: 'info',
      required: false,
      placeholder:
        'The Gemini API transmits your API key as a URL query parameter. This is Google\'s required format. Your key may appear in browser history and network logs.',
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'AIza...',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      required: true,
      options: GEMINI_MODELS,
      defaultValue: 'gemini-2.0-flash',
    },
    {
      key: 'baseUrl',
      label: 'Base URL',
      type: 'url',
      required: false,
      placeholder: 'https://generativelanguage.googleapis.com/v1beta',
    },
  ],

  async validateConfig(config) {
    try {
      const baseUrl =
        config.baseUrl?.replace(/\/+$/, '') ||
        'https://generativelanguage.googleapis.com/v1beta';
      const res = await fetch(
        `${baseUrl}/models?key=${config.apiKey}`,
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  async analyzeFood(request: FoodAnalysisRequest, config) {
    const prompt = buildFoodAnalysisPrompt(request);
    const raw = await generateContent(
      [{ text: prompt }],
      config,
      SYSTEM_PROMPT,
    );
    return safeParseJSON<FoodVerdict>(raw);
  },

  async answerHealthQuery(request: HealthQueryRequest, config) {
    const prompt = buildHealthQueryPrompt(request);
    const fullPrompt = [
      ...request.conversationHistory.map(
        (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`,
      ),
      `User: ${prompt}`,
    ].join('\n\n');
    const raw = await generateContent(
      [{ text: fullPrompt }],
      config,
      SYSTEM_PROMPT,
    );
    return safeParseJSON<HealthQueryResponse>(raw);
  },

  async analyzeImage(request: ImageAnalysisRequest, config) {
    const prompt = buildImageAnalysisPrompt(request);
    const raw = await generateContent(
      [
        { text: prompt },
        { inlineData: { mimeType: request.mimeType, data: request.imageBase64 } },
      ],
      config,
      SYSTEM_PROMPT,
    );
    return safeParseJSON<FoodVerdict>(raw);
  },
};

registerProvider(geminiProvider);
