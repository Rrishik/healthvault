// HealthVault — Example AI Provider Adapter
// ============================================================
// Copy this file to `src/adapters/<your-provider>/index.ts`
// and follow the steps below to add a new AI provider.
//
// Steps:
// 1. Copy this folder and rename it to your provider name
// 2. Implement all methods in the AIProvider interface
// 3. Import your adapter in `src/adapters/registry.ts`
// 4. That's it — the UI will pick it up automatically!
// ============================================================

import type {
  AIProvider,
  FoodAnalysisRequest,
  HealthQueryRequest,
  HealthQueryResponse,
  ImageAnalysisRequest,
} from '../types';
import type { FoodVerdict } from '../../types';

const exampleProvider: AIProvider = {
  // A unique short identifier (lowercase, no spaces)
  id: '_example',

  // Human-readable name shown in the provider picker
  name: 'Example Provider',

  // Declare which capabilities your provider supports
  capabilities: {
    foodAnalysis: true,
    healthQuery: true,
    imageAnalysis: false, // Set to false if your provider doesn't support vision
  },

  // Define the form fields the user needs to fill in.
  // The settings page will render these automatically.
  configSchema: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'your-api-key',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      required: true,
      options: [
        { label: 'Model A', value: 'model-a' },
        { label: 'Model B', value: 'model-b' },
      ],
      defaultValue: 'model-a',
    },
  ],

  async validateConfig(_config: Record<string, string>): Promise<boolean> {
    // Try a lightweight API call to check if the config is valid.
    // Return true if the API key / credentials work.
    throw new Error('Example provider: validateConfig not implemented');
  },

  async analyzeFood(
    _request: FoodAnalysisRequest,
    _config: Record<string, string>,
  ): Promise<FoodVerdict> {
    // 1. Use buildFoodAnalysisPrompt(request) to get the prompt
    // 2. Send it to your provider's API
    // 3. Parse the JSON response into a FoodVerdict
    throw new Error('Example provider: analyzeFood not implemented');
  },

  async answerHealthQuery(
    _request: HealthQueryRequest,
    _config: Record<string, string>,
  ): Promise<HealthQueryResponse> {
    // 1. Use buildHealthQueryPrompt(request) to get the prompt
    // 2. Include request.conversationHistory for context
    // 3. Send to API
    // 4. Parse into HealthQueryResponse
    throw new Error('Example provider: answerHealthQuery not implemented');
  },

  async analyzeImage(
    _request: ImageAnalysisRequest,
    _config: Record<string, string>,
  ): Promise<FoodVerdict> {
    // 1. Use buildImageAnalysisPrompt(request) to get the text prompt
    // 2. Send text + request.imageBase64 to your vision API
    // 3. Parse into FoodVerdict
    throw new Error('Example provider: analyzeImage not implemented');
  },
};

// NOTE: Do NOT register this example provider — it's just a template.
// For real providers, uncomment the next line:
// registerProvider(exampleProvider);

export default exampleProvider;
