// HealthVault — Onboarding page
// Step 0: AI Provider setup (with Test Connection)
// Steps 1–6: Profile entry with AI-powered locale-aware suggestions + hardcoded fallbacks

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { useSettings } from '../hooks/useSettings';
import ProviderSetup from '../components/ProviderSetup';
import ChipSelector from '../components/ChipSelector';
import TagInput from '../components/TagInput';
import {
  generateOnboardingSuggestions,
  getFallbackSuggestions,
  type OnboardingSuggestions,
} from '../services/onboarding-suggestions';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const SEX_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { saveProfile, profile } = useHealthProfile();
  const { completeOnboarding, providers, selectProvider, setProviderConfig } =
    useSettings();
  const navigate = useNavigate();

  // Provider state
  const [selectedProvider, setSelectedProvider] = useState('');
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  // AI suggestions state
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions>(getFallbackSuggestions());
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRequested = useRef(false);

  // Profile state
  const [ageRange, setAgeRange] = useState(profile?.ageRange ?? '');
  const [sex, setSex] = useState(profile?.sex ?? '');
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(profile?.weightKg?.toString() ?? '');
  const [conditions, setConditions] = useState<string[]>(profile?.conditions ?? []);
  const [allergies, setAllergies] = useState<string[]>(profile?.allergies ?? []);
  const [medications, setMedications] = useState<string[]>(profile?.medications ?? []);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(
    profile?.dietaryPreferences ?? [],
  );
  const [healthGoals, setHealthGoals] = useState<string[]>(profile?.healthGoals ?? []);

  const totalSteps = 7; // provider + 6 profile steps

  // ---------- Fire AI suggestions after successful connection ----------
  const handleConnectionResult = (ok: boolean) => {
    if (ok && !suggestionsRequested.current) {
      suggestionsRequested.current = true;
      const prov = providers.find((p) => p.id === selectedProvider);
      if (!prov) return;
      setSuggestionsLoading(true);
      generateOnboardingSuggestions(prov, configDraft).then((result) => {
        if (result) setSuggestions(result);
        setSuggestionsLoading(false);
      });
    }
  };

  const handleFinish = async () => {
    await saveProfile({
      ageRange: ageRange || undefined,
      sex: sex || undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      conditions,
      allergies,
      medications,
      dietaryPreferences,
      healthGoals,
    });

    if (selectedProvider && Object.values(configDraft).some(Boolean)) {
      await selectProvider(selectedProvider);
      const provider = providers.find((p) => p.id === selectedProvider);
      const finalConfig = { ...configDraft };
      provider?.configSchema.forEach((f) => {
        if (!finalConfig[f.key] && f.defaultValue) {
          finalConfig[f.key] = f.defaultValue;
        }
      });
      await setProviderConfig(selectedProvider, finalConfig);
    }

    await completeOnboarding();
    navigate('/');
  };

  // ---------- Steps ----------

  const steps = [
    // Step 0: AI Provider Setup
    <div key="provider" className="space-y-4">
      <h2 className="text-xl font-semibold">Connect AI Provider</h2>
      <p className="text-surface-400 text-sm">
        Choose an AI provider to power food analysis, health queries, and personalised suggestions.
        Your API key is stored locally and never sent to our servers.
      </p>
      <ProviderSetup
        providers={providers}
        selectedProviderId={selectedProvider}
        onProviderChange={(id) => {
          setSelectedProvider(id);
          setConfigDraft({});
          suggestionsRequested.current = false;
        }}
        config={configDraft}
        onConfigChange={(key, value) => {
          setConfigDraft((prev) => ({ ...prev, [key]: value }));
          suggestionsRequested.current = false;
        }}
        onConnectionResult={handleConnectionResult}
      />
    </div>,

    // Step 1: Basics
    <div key="basics" className="space-y-4">
      <h2 className="text-xl font-semibold">Basic Information</h2>
      <p className="text-surface-400 text-sm">Help us personalize your experience. All fields are optional.</p>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-surface-300 block mb-1">Age Range</label>
          <div className="flex flex-wrap gap-2">
            {AGE_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setAgeRange(r)}
                className={`px-3 py-1.5 rounded-lg text-sm ${ageRange === r ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-surface-300 block mb-1">Sex</label>
          <div className="flex flex-wrap gap-2">
            {SEX_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSex(s)}
                className={`px-3 py-1.5 rounded-lg text-sm ${sex === s ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-surface-300 block mb-1">Height (cm)</label>
            <input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="text-sm text-surface-300 block mb-1">Weight (kg)</label>
            <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500" />
          </div>
        </div>
      </div>
    </div>,

    // Step 2: Conditions
    <div key="conditions" className="space-y-4">
      <h2 className="text-xl font-semibold">Health Conditions</h2>
      <p className="text-surface-400 text-sm">Select any existing conditions or add your own.</p>
      <ChipSelector options={suggestions.conditions} selected={conditions} onChange={setConditions} loading={suggestionsLoading} />
      <TagInput
        tags={conditions.filter((c) => !suggestions.conditions.includes(c))}
        onChange={(custom) => setConditions([...conditions.filter((c) => suggestions.conditions.includes(c)), ...custom])}
        placeholder="Add a condition…"
      />
    </div>,

    // Step 3: Allergies
    <div key="allergies" className="space-y-4">
      <h2 className="text-xl font-semibold">Allergies</h2>
      <p className="text-surface-400 text-sm">Select known allergies or add your own.</p>
      <ChipSelector options={suggestions.allergies} selected={allergies} onChange={setAllergies} loading={suggestionsLoading} />
      <TagInput
        tags={allergies.filter((a) => !suggestions.allergies.includes(a))}
        onChange={(custom) => setAllergies([...allergies.filter((a) => suggestions.allergies.includes(a)), ...custom])}
        placeholder="Add an allergy…"
      />
    </div>,

    // Step 4: Medications
    <div key="medications" className="space-y-4">
      <h2 className="text-xl font-semibold">Medications</h2>
      <p className="text-surface-400 text-sm">List any medications you're currently taking.</p>
      {suggestions.medications.length > 0 && (
        <>
          <p className="text-xs text-surface-500">Common medications in your region:</p>
          <ChipSelector options={suggestions.medications} selected={medications} onChange={setMedications} loading={suggestionsLoading} />
        </>
      )}
      <TagInput
        tags={medications.filter((m) => !suggestions.medications.includes(m))}
        onChange={(custom) => setMedications([...medications.filter((m) => suggestions.medications.includes(m)), ...custom])}
        placeholder="Add a medication…"
      />
    </div>,

    // Step 5: Diet
    <div key="diet" className="space-y-4">
      <h2 className="text-xl font-semibold">Dietary Preferences</h2>
      <p className="text-surface-400 text-sm">Select any dietary preferences you follow.</p>
      <ChipSelector options={suggestions.dietaryPreferences} selected={dietaryPreferences} onChange={setDietaryPreferences} loading={suggestionsLoading} />
      <TagInput
        tags={dietaryPreferences.filter((d) => !suggestions.dietaryPreferences.includes(d))}
        onChange={(custom) => setDietaryPreferences([...dietaryPreferences.filter((d) => suggestions.dietaryPreferences.includes(d)), ...custom])}
        placeholder="Add a preference…"
      />
    </div>,

    // Step 6: Goals
    <div key="goals" className="space-y-4">
      <h2 className="text-xl font-semibold">Health Goals</h2>
      <p className="text-surface-400 text-sm">What are you trying to achieve?</p>
      <ChipSelector options={suggestions.healthGoals} selected={healthGoals} onChange={setHealthGoals} loading={suggestionsLoading} />
      <TagInput
        tags={healthGoals.filter((g) => !suggestions.healthGoals.includes(g))}
        onChange={(custom) => setHealthGoals([...healthGoals.filter((g) => suggestions.healthGoals.includes(g)), ...custom])}
        placeholder="Add a goal…"
      />
    </div>,
  ];

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      {/* Progress bar */}
      <div className="bg-surface-900 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-surface-400">
              Step {step + 1} of {totalSteps}
            </span>
            <button
              onClick={handleFinish}
              className="text-xs text-primary-400 hover:text-primary-300"
            >
              Skip all
            </button>
          </div>
          <div className="w-full bg-surface-800 rounded-full h-1.5">
            <div
              className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full overflow-y-auto">{steps[step]}</div>

      {/* Navigation */}
      <div className="p-4 max-w-lg mx-auto w-full flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 bg-surface-800 hover:bg-surface-700 text-surface-300 py-2.5 rounded-lg text-sm transition-colors"
          >
            Back
          </button>
        )}
        {step < totalSteps - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg text-sm transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg text-sm transition-colors"
          >
            Get Started
          </button>
        )}
      </div>
    </div>
  );
}
