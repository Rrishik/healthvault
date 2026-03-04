// HealthVault — Provider setup (shared between Onboarding & Settings)

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIProvider } from '../adapters/types';
import ConfigFieldRenderer from './ConfigFieldRenderer';
import CommunityWarning from './CommunityWarning';

interface ProviderSetupProps {
  providers: AIProvider[];
  selectedProviderId: string;
  onProviderChange: (id: string) => void;
  config: Record<string, string>;
  onConfigChange: (key: string, value: string) => void;
  /** Called after the user clicks "Save Config" */
  onSaveConfig?: () => void;
  /** Show saved confirmation label (controlled externally) */
  configSaved?: boolean;
  /** Called with true/false after test connection completes. May return a Promise to keep the button loading. */
  onConnectionResult?: (ok: boolean) => void | Promise<void>;
  /** Optional override for the test connection logic (replaces validateConfig call) */
  onTestConnection?: () => Promise<void>;
  /** Hide the provider dropdown (used when provider is already chosen via radio cards) */
  hideProviderSelect?: boolean;
}

export default function ProviderSetup({
  providers,
  selectedProviderId,
  onProviderChange,
  config,
  onConfigChange,
  onSaveConfig,
  configSaved,
  onConnectionResult,
  onTestConnection,
  hideProviderSelect,
}: ProviderSetupProps) {
  const { t } = useTranslation();
  const [validating, setValidating] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  const provider = providers.find((p) => p.id === selectedProviderId);

  const handleTestConnection = useCallback(async () => {
    if (!provider) return;
    setValidating(true);
    setConnectionOk(null);
    try {
      if (onTestConnection) {
        // Use custom test (e.g. onboarding combines test + suggestions)
        await onTestConnection();
        setConnectionOk(true);
      } else {
        const ok = await provider.validateConfig(config);
        await onConnectionResult?.(ok);
        setConnectionOk(ok);
      }
    } catch {
      await onConnectionResult?.(false);
      setConnectionOk(false);
    } finally {
      setValidating(false);
    }
  }, [provider, config, onConnectionResult, onTestConnection]);

  const handleProviderSwitch = (id: string) => {
    setConnectionOk(null);
    onProviderChange(id);
  };

  return (
    <div className="space-y-4">
      {/* Provider select */}
      {!hideProviderSelect && (
        <div>
          <label className="text-sm text-surface-300 block mb-1">
            {t('provider.label')}
          </label>
          <select
            value={selectedProviderId}
            onChange={(e) => handleProviderSwitch(e.target.value)}
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
          >
            <option value="">{t('provider.select')}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedProviderId && (
        <>
          {/* Community warning */}
          {!hideProviderSelect && selectedProviderId === 'community' && <CommunityWarning />}

          {/* Config fields */}
          <ConfigFieldRenderer
            fields={provider?.configSchema ?? []}
            values={config}
            onChange={onConfigChange}
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            {onSaveConfig && (
              <button
                onClick={onSaveConfig}
                className="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-sm py-2.5 rounded-lg transition-colors"
              >
                {configSaved ? t('provider.saved') : t('provider.saveConfig')}
              </button>
            )}
            <button
              onClick={handleTestConnection}
              disabled={validating}
              className={`${onSaveConfig ? 'px-4' : 'w-full'} bg-surface-700 hover:bg-surface-600 disabled:opacity-50 text-surface-100 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2`}
            >
              {validating ? (
                <>
                  <span className="w-4 h-4 border-2 border-surface-400 border-t-transparent rounded-full animate-spin" />
                  {t('provider.establishing')}
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  {t('provider.establishConnection')}
                </>
              )}
            </button>
          </div>

          {/* Result banner */}
          {connectionOk === true && (
            <div className="bg-green-900/30 border border-green-700/40 rounded-lg p-3 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-sm text-green-300">
                {t('provider.connectionSuccess')}
              </p>
            </div>
          )}
          {connectionOk === false && (
            <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-red-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <p className="text-sm text-red-300">
                {t('provider.connectionFailed')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
