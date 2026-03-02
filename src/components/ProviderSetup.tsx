// HealthVault — Provider setup (shared between Onboarding & Settings)

import { useState, useCallback } from 'react';
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
  /** Called with true/false after test connection completes */
  onConnectionResult?: (ok: boolean) => void;
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
}: ProviderSetupProps) {
  const [validating, setValidating] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  const provider = providers.find((p) => p.id === selectedProviderId);

  const handleTestConnection = useCallback(async () => {
    if (!provider) return;
    setValidating(true);
    setConnectionOk(null);
    try {
      const ok = await provider.validateConfig(config);
      setConnectionOk(ok);
      onConnectionResult?.(ok);
    } catch {
      setConnectionOk(false);
      onConnectionResult?.(false);
    } finally {
      setValidating(false);
    }
  }, [provider, config, onConnectionResult]);

  const handleProviderSwitch = (id: string) => {
    setConnectionOk(null);
    onProviderChange(id);
  };

  return (
    <div className="space-y-4">
      {/* Provider select */}
      <div>
        <label className="text-sm text-surface-300 block mb-1">Provider</label>
        <select
          value={selectedProviderId}
          onChange={(e) => handleProviderSwitch(e.target.value)}
          className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
        >
          <option value="">Select a provider…</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProviderId && (
        <>
          {/* Community warning */}
          {selectedProviderId === 'community' && <CommunityWarning />}

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
                {configSaved ? '✓ Saved' : 'Save Config'}
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
                  Testing…
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
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Test Connection
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
              <p className="text-sm text-green-300">Connection successful!</p>
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
                Connection failed. Check your credentials and try again.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
