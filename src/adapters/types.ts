// HealthVault — AI Adapter types
// Every AI provider implements the AIProvider interface.

import type {
  FoodVerdict,
  FoodAnalysisRequest,
  HealthQueryRequest,
  ImageAnalysisRequest,
  HealthQueryResponse,
} from '../types';

// Re-export request/response types so existing adapter imports keep working
export type {
  FoodAnalysisRequest,
  HealthQueryRequest,
  ImageAnalysisRequest,
  HealthQueryResponse,
};

// ---------- Provider config schema ----------

export type ConfigFieldType = 'text' | 'password' | 'select' | 'url' | 'info';

export interface ProviderConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string;
}

// ---------- Provider capabilities ----------

export interface ProviderCapabilities {
  foodAnalysis: boolean;
  healthQuery: boolean;
  imageAnalysis: boolean;
}

// ---------- Main interface ----------

export interface AIProvider {
  /** Unique identifier, e.g. "openai" */
  id: string;
  /** Human-readable name, e.g. "OpenAI" */
  name: string;
  /** What this provider can do */
  capabilities: ProviderCapabilities;
  /** Describes the config form the UI should render */
  configSchema: ProviderConfigField[];

  /** Validate the user-supplied config (API key, model, etc.) */
  validateConfig(config: Record<string, string>): Promise<boolean>;

  /** Analyze food ingredients and return a safety verdict */
  analyzeFood(
    request: FoodAnalysisRequest,
    config: Record<string, string>,
  ): Promise<FoodVerdict>;

  /** Answer a health-related question */
  answerHealthQuery(
    request: HealthQueryRequest,
    config: Record<string, string>,
  ): Promise<HealthQueryResponse>;

  /** Analyze an image (e.g. food label photo) */
  analyzeImage(
    request: ImageAnalysisRequest,
    config: Record<string, string>,
  ): Promise<FoodVerdict>;
}
