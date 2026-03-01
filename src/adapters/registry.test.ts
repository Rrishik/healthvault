import { describe, it, expect } from 'vitest';
import { registerProvider, getProvider, listProviders } from './registry';
import type { AIProvider } from './types';

function makeMockProvider(id: string, name?: string): AIProvider {
  return {
    id,
    name: name ?? `Mock ${id}`,
    capabilities: {
      foodAnalysis: true,
      healthQuery: true,
      imageAnalysis: false,
    },
    configSchema: [],
    validateConfig: async () => true,
    analyzeFood: async () => ({
      overall: 'safe' as const,
      summary: 'All good',
      details: [],
    }),
    answerHealthQuery: async () => ({
      answer: 'Test answer',
    }),
    analyzeImage: async () => ({
      overall: 'safe' as const,
      summary: 'All good',
      details: [],
    }),
  };
}

describe('adapter registry', () => {
  // Note: registry is a module-level Map, so adapters registered in
  // earlier tests persist. We test additive behavior.

  it('registers and retrieves a provider', () => {
    const provider = makeMockProvider('test-provider-1');
    registerProvider(provider);
    expect(getProvider('test-provider-1')).toBe(provider);
  });

  it('returns undefined for unknown provider', () => {
    expect(getProvider('nonexistent')).toBeUndefined();
  });

  it('lists all registered providers', () => {
    const before = listProviders().length;
    const p = makeMockProvider('test-provider-2');
    registerProvider(p);
    expect(listProviders().length).toBe(before + 1);
    expect(listProviders().some((x) => x.id === 'test-provider-2')).toBe(true);
  });

  it('overwrites existing provider with same id', () => {
    const p1 = makeMockProvider('overwrite-test', 'First');
    const p2 = makeMockProvider('overwrite-test', 'Second');
    registerProvider(p1);
    registerProvider(p2);
    expect(getProvider('overwrite-test')?.name).toBe('Second');
  });
});
