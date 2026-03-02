// HealthVault — App-wide React context
// Provides settings, health profile, and AI provider state to all components.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { HealthProfile, AppSettings } from '../types';
import {
  getSettings,
  updateSettings as dbUpdateSettings,
  getProfile,
  saveProfile as dbSaveProfile,
} from '../services/db';
import { encryptConfigData, decryptConfigData } from '../services/crypto';
import { generateChatStarters } from '../services/starters';
// Import adapters so they self-register before we use the registry
import '../adapters/openai';
import '../adapters/gemini';
import '../adapters/anthropic';
import '../adapters/azure-openai';
import '../adapters/community';
import { getProvider, listProviders } from '../adapters/registry';
import type { AIProvider } from '../adapters/types';

interface AppContextValue {
  // Settings
  settings: AppSettings | null;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;

  // Profile
  profile: HealthProfile | null;
  saveProfile: (patch: Partial<HealthProfile>) => Promise<void>;

  // AI provider
  provider: AIProvider | null;
  providers: AIProvider[];
  selectProvider: (id: string) => Promise<void>;

  // Loading state
  loading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const providers = listProviders();
  const provider = settings?.selectedProviderId
    ? getProvider(settings.selectedProviderId) ?? null
    : null;

  // Initial load
  useEffect(() => {
    Promise.all([getSettings(), getProfile()]).then(async ([s, p]) => {
      // Decrypt provider configs if encrypted
      if (s.encryptedProviderConfigs) {
        try {
          s.providerConfigs = await decryptConfigData(s.encryptedProviderConfigs);
        } catch {
          s.providerConfigs = {};
        }
      } else if (Object.keys(s.providerConfigs).length > 0) {
        // Migrate existing plaintext configs to encrypted storage
        const encrypted = await encryptConfigData(s.providerConfigs);
        await dbUpdateSettings({ encryptedProviderConfigs: encrypted, providerConfigs: {} });
        // s.providerConfigs is still the original plaintext for in-memory use
      }
      setSettings(s);
      setProfile(p ?? null);
      setLoading(false);
    });
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      // Encrypt providerConfigs before persisting
      if (patch.providerConfigs) {
        const encrypted = await encryptConfigData(patch.providerConfigs);
        await dbUpdateSettings({
          ...patch,
          providerConfigs: {}, // Clear plaintext in IDB
          encryptedProviderConfigs: encrypted,
        });
      } else {
        await dbUpdateSettings(patch);
      }
      // Re-read and decrypt for in-memory state
      const fresh = await getSettings();
      if (fresh.encryptedProviderConfigs) {
        try {
          fresh.providerConfigs = await decryptConfigData(fresh.encryptedProviderConfigs);
        } catch {
          fresh.providerConfigs = {};
        }
      }
      setSettings(fresh);
    },
    [],
  );

  const saveProfile = useCallback(async (patch: Partial<HealthProfile>) => {
    await dbSaveProfile(patch);
    const fresh = await getProfile();
    setProfile(fresh ?? null);

    // Fire-and-forget: regenerate AI chat starters in the background
    if (provider && settings) {
      const config = settings.providerConfigs[provider.id] ?? {};
      generateChatStarters(provider, config, fresh ?? null).then(async (starters) => {
        if (starters && starters.length > 0) {
          await dbUpdateSettings({ chatStarters: starters });
          const s = await getSettings();
          if (s.encryptedProviderConfigs) {
            try {
              s.providerConfigs = await decryptConfigData(s.encryptedProviderConfigs);
            } catch {
              s.providerConfigs = {};
            }
          }
          setSettings(s);
        }
      });
    }
  }, [provider, settings]);

  const selectProvider = useCallback(
    async (id: string) => {
      await updateSettings({ selectedProviderId: id });
    },
    [updateSettings],
  );

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        profile,
        saveProfile,
        provider,
        providers,
        selectProvider,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within <AppProvider>');
  }
  return ctx;
}
