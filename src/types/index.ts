// HealthVault — Core application types

export interface HealthProfile {
  id?: number;
  ageRange?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  conditions: string[];
  allergies: string[];
  medications: string[];
  dietaryPreferences: string[];
  healthGoals: string[];
  createdAt: number;
  updatedAt: number;
}

export interface InteractionLog {
  id?: number;
  type: 'food-analysis' | 'health-query' | 'image-analysis';
  query: string;
  response: string;
  context: string; // serialized HealthContext sent
  providerId: string;
  model: string;
  timestamp: number;
}

export interface FoodScanRecord {
  id?: number;
  ingredients: string[];
  verdict: FoodVerdict;
  imageDataUrl?: string;
  source: 'camera' | 'upload' | 'manual' | 'ocr';
  providerId: string;
  timestamp: number;
}

export interface AppSettings {
  id?: number;
  selectedProviderId: string;
  providerConfigs: Record<string, Record<string, string>>;
  /**
   * Encrypted version of providerConfigs for at-rest storage in IndexedDB.
   * At rest, `providerConfigs` is always `{}` in IDB — the real data lives
   * in `encryptedProviderConfigs`. The plaintext `providerConfigs` is only
   * populated in memory after decryption by AppContext.
   */
  encryptedProviderConfigs?: string;
  showPromptBeforeSending: boolean;
  onboardingComplete: boolean;
  /** AI-generated personalised conversation starters, cached on profile save */
  chatStarters?: string[];
}

export interface FoodVerdict {
  overall: 'safe' | 'caution' | 'avoid';
  summary: string;
  details: VerdictDetail[];
  alternatives?: string[];
}

export interface VerdictDetail {
  ingredient: string;
  status: 'safe' | 'caution' | 'avoid';
  reason: string;
}

export interface HealthContext {
  profile: Partial<HealthProfile>;
  recentInteractions: Pick<InteractionLog, 'type' | 'query' | 'response' | 'timestamp'>[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id?: number;
  title: string;
  messages: Message[];
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Lightweight conversation metadata (without messages) for listings */
export type ConversationSummary = Omit<Conversation, 'messages'>;

// ---------- AI request / response types ----------

export interface FoodAnalysisRequest {
  ingredients: string[];
  context: HealthContext;
}

export interface HealthQueryRequest {
  query: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  context: HealthContext;
}

export interface ImageAnalysisRequest {
  imageBase64: string;
  mimeType: string;
  context: HealthContext;
}

export interface HealthQueryResponse {
  answer: string;
  /** If the AI mentions new health info the user didn't previously share */
  suggestedProfileUpdates?: Partial<{
    conditions: string[];
    allergies: string[];
    medications: string[];
  }>;
}
