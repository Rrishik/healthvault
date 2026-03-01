// HealthVault — useAIProvider hook
// Wraps adapter calls with context assembly and interaction logging.

import { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { assembleContext } from '../services/context-assembler';
import { addInteraction, addFoodScan } from '../services/db';
import type {
  FoodAnalysisRequest,
  HealthQueryRequest,
  HealthQueryResponse,
  ImageAnalysisRequest,
} from '../adapters/types';
import type { FoodVerdict } from '../types';

export function useAIProvider() {
  const { provider, settings } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConfig = useCallback((): Record<string, string> => {
    if (!provider || !settings) return {};
    return settings.providerConfigs[provider.id] ?? {};
  }, [provider, settings]);

  const analyzeFood = useCallback(
    async (ingredients: string[]): Promise<FoodVerdict | null> => {
      if (!provider) {
        setError('No AI provider selected');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const context = await assembleContext();
        const request: FoodAnalysisRequest = { ingredients, context };
        const config = getConfig();
        const verdict = await provider.analyzeFood(request, config);

        // Log interaction
        await addInteraction({
          type: 'food-analysis',
          query: ingredients.join(', '),
          response: JSON.stringify(verdict),
          context: JSON.stringify(context),
          providerId: provider.id,
          model: config.model || '',
          timestamp: Date.now(),
        });

        // Save scan
        await addFoodScan({
          ingredients,
          verdict,
          source: 'manual',
          providerId: provider.id,
          timestamp: Date.now(),
        });

        return verdict;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [provider, getConfig],
  );

  const askHealthQuery = useCallback(
    async (
      query: string,
      conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    ): Promise<HealthQueryResponse | null> => {
      if (!provider) {
        setError('No AI provider selected');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const context = await assembleContext();
        const request: HealthQueryRequest = {
          query,
          conversationHistory,
          context,
        };
        const config = getConfig();
        const response = await provider.answerHealthQuery(request, config);

        await addInteraction({
          type: 'health-query',
          query,
          response: JSON.stringify(response),
          context: JSON.stringify(context),
          providerId: provider.id,
          model: config.model || '',
          timestamp: Date.now(),
        });

        return response;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [provider, getConfig],
  );

  const analyzeImage = useCallback(
    async (imageBase64: string, mimeType: string): Promise<FoodVerdict | null> => {
      if (!provider) {
        setError('No AI provider selected');
        return null;
      }
      if (!provider.capabilities.imageAnalysis) {
        setError(`${provider.name} does not support image analysis`);
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const context = await assembleContext();
        const request: ImageAnalysisRequest = {
          imageBase64,
          mimeType,
          context,
        };
        const config = getConfig();
        const verdict = await provider.analyzeImage(request, config);

        await addInteraction({
          type: 'image-analysis',
          query: '[image]',
          response: JSON.stringify(verdict),
          context: JSON.stringify(context),
          providerId: provider.id,
          model: config.model || '',
          timestamp: Date.now(),
        });

        await addFoodScan({
          ingredients: verdict.details.map((d) => d.ingredient),
          verdict,
          source: 'upload',
          providerId: provider.id,
          timestamp: Date.now(),
        });

        return verdict;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [provider, getConfig],
  );

  return {
    provider,
    loading,
    error,
    analyzeFood,
    askHealthQuery,
    analyzeImage,
  };
}
