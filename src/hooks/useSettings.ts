// HealthVault — useSettings hook

import { useAppContext } from '../context/AppContext';

export function useSettings() {
  const { settings, updateSettings, selectProvider, providers, provider } =
    useAppContext();

  const setProviderConfig = async (
    providerId: string,
    config: Record<string, string>,
  ) => {
    if (!settings) return;
    await updateSettings({
      providerConfigs: {
        ...settings.providerConfigs,
        [providerId]: config,
      },
    });
  };

  const togglePromptPreview = async () => {
    if (!settings) return;
    await updateSettings({
      showPromptBeforeSending: !settings.showPromptBeforeSending,
    });
  };

  const completeOnboarding = async () => {
    await updateSettings({ onboardingComplete: true });
  };

  return {
    settings,
    updateSettings,
    provider,
    providers,
    selectProvider,
    setProviderConfig,
    togglePromptPreview,
    completeOnboarding,
  };
}
