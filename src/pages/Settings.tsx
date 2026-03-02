// HealthVault — Settings page

import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { exportData, importData } from '../services/export';
import ConfigFieldRenderer from '../components/ConfigFieldRenderer';

export default function Settings() {
  const {
    settings,
    providers,
    provider,
    selectProvider,
    setProviderConfig,
    togglePromptPreview,
  } = useSettings();

  const { profile, saveProfile } = useHealthProfile();

  // Provider config form state
  const [configDraft, setConfigDraft] = useState<Record<string, string>>(
    settings?.providerConfigs[provider?.id ?? ''] ?? {},
  );

  // Sync configDraft when settings or provider changes externally
  useEffect(() => {
    if (settings && provider) {
      setConfigDraft(settings.providerConfigs[provider.id] ?? {});
    }
  }, [settings, provider]);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<boolean | null>(null);
  const [configSaved, setConfigSaved] = useState(false);

  // Export/import state
  const [exportPass, setExportPass] = useState('');
  const [importPass, setImportPass] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // Profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    ageRange: profile?.ageRange ?? '',
    sex: profile?.sex ?? '',
    heightCm: profile?.heightCm?.toString() ?? '',
    weightKg: profile?.weightKg?.toString() ?? '',
    conditions: profile?.conditions.join(', ') ?? '',
    allergies: profile?.allergies.join(', ') ?? '',
    medications: profile?.medications.join(', ') ?? '',
    dietaryPreferences: profile?.dietaryPreferences.join(', ') ?? '',
    healthGoals: profile?.healthGoals.join(', ') ?? '',
  });

  const handleProviderChange = async (id: string) => {
    await selectProvider(id);
    // configDraft sync is handled by useEffect above
    setValidationResult(null);
    setConfigSaved(false);
  };

  const handleSaveConfig = async () => {
    if (!provider) return;
    await setProviderConfig(provider.id, configDraft);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const handleValidate = async () => {
    if (!provider) return;
    setValidating(true);
    try {
      const ok = await provider.validateConfig(configDraft);
      setValidationResult(ok);
    } catch {
      setValidationResult(false);
    } finally {
      setValidating(false);
    }
  };

  const handleExport = async () => {
    if (!exportPass) return;
    try {
      await exportData(exportPass);
      setExportStatus('Export downloaded!');
      setExportPass('');
    } catch (e) {
      setExportStatus(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
    setTimeout(() => setExportStatus(''), 3000);
  };

  const handleImport = async (file: File) => {
    if (!importPass) {
      setImportStatus('Please enter a passphrase first.');
      return;
    }
    try {
      const { imported, skipped } = await importData(file, importPass);
      setImportStatus(`Imported ${imported} records, skipped ${skipped}.`);
    } catch (e) {
      setImportStatus(
        `Error: ${e instanceof Error ? e.message : 'Decryption failed'}`,
      );
    }
    setTimeout(() => setImportStatus(''), 4000);
  };

  const handleSaveProfile = async () => {
    const split = (s: string) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    await saveProfile({
      ageRange: profileDraft.ageRange || undefined,
      sex: profileDraft.sex || undefined,
      heightCm: profileDraft.heightCm ? Number(profileDraft.heightCm) : undefined,
      weightKg: profileDraft.weightKg ? Number(profileDraft.weightKg) : undefined,
      conditions: split(profileDraft.conditions),
      allergies: split(profileDraft.allergies),
      medications: split(profileDraft.medications),
      dietaryPreferences: split(profileDraft.dietaryPreferences),
      healthGoals: split(profileDraft.healthGoals),
    });
    setEditingProfile(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-surface-100">Settings</h2>

      {/* ---- AI Provider ---- */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-surface-100">AI Provider</h3>

        <div>
          <label className="text-xs text-surface-400 block mb-1">Provider</label>
          <select
            value={provider?.id ?? ''}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
          >
            <option value="">Select a provider</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {provider?.id === 'community' && (
          <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg p-3">
            <p className="text-xs text-amber-300 leading-relaxed">
              <span className="font-semibold">Note:</span> The Community provider routes your queries through a private Azure OpenAI resource. Your conversations (including health context) are sent to this service for processing. No data is stored on the server.
            </p>
          </div>
        )}

        {provider && (
          <ConfigFieldRenderer
            fields={provider.configSchema}
            values={configDraft}
            onChange={(key, value) => setConfigDraft({ ...configDraft, [key]: value })}
            inputClassName="bg-surface-900 border border-surface-600"
            labelClassName="text-xs text-surface-400"
          />
        )}

        {provider && (
          <div className="flex gap-2">
            <button
              onClick={handleSaveConfig}
              className="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-sm py-2 rounded-lg transition-colors"
            >
              {configSaved ? '✓ Saved' : 'Save Config'}
            </button>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="px-4 bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {validating ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        )}

        {validationResult !== null && (
          <p
            className={`text-xs ${validationResult ? 'text-green-400' : 'text-red-400'}`}
          >
            {validationResult
              ? '✓ Connection successful!'
              : '✗ Connection failed. Check your API key.'}
          </p>
        )}
      </section>

      {/* ---- Prompt Preview Toggle ---- */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-surface-100">
              Show Prompt Before Sending
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">
              Preview the exact prompt sent to the AI provider
            </p>
          </div>
          <button
            onClick={togglePromptPreview}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings?.showPromptBeforeSending
                ? 'bg-primary-600'
                : 'bg-surface-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                settings?.showPromptBeforeSending
                  ? 'translate-x-5'
                  : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* ---- Health Profile ---- */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-surface-100">
            Health Profile
          </h3>
          <button
            onClick={() => {
              if (editingProfile) {
                handleSaveProfile();
              } else {
                setEditingProfile(true);
              }
            }}
            className="text-xs text-primary-400 hover:underline"
          >
            {editingProfile ? 'Save' : 'Edit'}
          </button>
        </div>

        {editingProfile ? (
          <div className="space-y-3">
            {[
              { key: 'ageRange', label: 'Age Range' },
              { key: 'sex', label: 'Sex' },
              { key: 'heightCm', label: 'Height (cm)' },
              { key: 'weightKg', label: 'Weight (kg)' },
              { key: 'conditions', label: 'Conditions (comma-separated)' },
              { key: 'allergies', label: 'Allergies (comma-separated)' },
              { key: 'medications', label: 'Medications (comma-separated)' },
              {
                key: 'dietaryPreferences',
                label: 'Dietary Preferences (comma-separated)',
              },
              { key: 'healthGoals', label: 'Health Goals (comma-separated)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-surface-400 block mb-1">
                  {label}
                </label>
                <input
                  type="text"
                  value={profileDraft[key as keyof typeof profileDraft]}
                  onChange={(e) =>
                    setProfileDraft({
                      ...profileDraft,
                      [key]: e.target.value,
                    })
                  }
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 text-xs">
            {profile?.ageRange && (
              <p>
                <span className="text-surface-500">Age: </span>
                <span className="text-surface-300">{profile.ageRange}</span>
              </p>
            )}
            {profile?.sex && (
              <p>
                <span className="text-surface-500">Sex: </span>
                <span className="text-surface-300">{profile.sex}</span>
              </p>
            )}
            {(profile?.conditions.length ?? 0) > 0 && (
              <p>
                <span className="text-surface-500">Conditions: </span>
                <span className="text-surface-300">
                  {profile!.conditions.join(', ')}
                </span>
              </p>
            )}
            {(profile?.allergies.length ?? 0) > 0 && (
              <p>
                <span className="text-surface-500">Allergies: </span>
                <span className="text-surface-300">
                  {profile!.allergies.join(', ')}
                </span>
              </p>
            )}
            {(profile?.medications.length ?? 0) > 0 && (
              <p>
                <span className="text-surface-500">Medications: </span>
                <span className="text-surface-300">
                  {profile!.medications.join(', ')}
                </span>
              </p>
            )}
            {(profile?.dietaryPreferences.length ?? 0) > 0 && (
              <p>
                <span className="text-surface-500">Diet: </span>
                <span className="text-surface-300">
                  {profile!.dietaryPreferences.join(', ')}
                </span>
              </p>
            )}
            {(profile?.healthGoals.length ?? 0) > 0 && (
              <p>
                <span className="text-surface-500">Goals: </span>
                <span className="text-surface-300">
                  {profile!.healthGoals.join(', ')}
                </span>
              </p>
            )}
            {!profile && (
              <p className="text-surface-500">No profile data yet.</p>
            )}
          </div>
        )}
      </section>

      {/* ---- Export / Import ---- */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-surface-100">
          Export &amp; Import
        </h3>

        {/* Export */}
        <div className="space-y-2">
          <label className="text-xs text-surface-400 block">
            Export (encrypted backup)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={exportPass}
              onChange={(e) => setExportPass(e.target.value)}
              placeholder="Passphrase for encryption"
              className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={handleExport}
              disabled={!exportPass}
              className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Export
            </button>
          </div>
          {exportStatus && (
            <p className="text-xs text-surface-400">{exportStatus}</p>
          )}
        </div>

        {/* Import */}
        <div className="space-y-2">
          <label className="text-xs text-surface-400 block">
            Import (.healthvault file)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              placeholder="Passphrase for decryption"
              className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
            />
            <label className="bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer">
              Choose File
              <input
                type="file"
                accept=".healthvault"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
            </label>
          </div>
          {importStatus && (
            <p className="text-xs text-surface-400">{importStatus}</p>
          )}
        </div>
      </section>

      {/* ---- About ---- */}
      <section className="bg-surface-800 border border-surface-700 rounded-xl p-4 text-center">
        <p className="text-xs text-surface-500">
          HealthVault v0.1.0 · Local-first · Open source (MIT)
        </p>
        <p className="text-xs text-surface-600 mt-1">
          Your data never leaves your device unless you choose to send it to an
          AI provider.
        </p>
      </section>
    </div>
  );
}
