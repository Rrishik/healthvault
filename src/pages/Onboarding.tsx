// HealthVault — Onboarding page
// Step 0: AI Provider setup (with Test Connection)
// Steps 1–6: Profile entry with AI-powered suggestions
//
// Two-phase AI flow:
//   Phase 1 (Test Connection) → locale-aware health conditions
//   Phase 2 (Leave conditions step) → condition-aware suggestions for
//           allergies, medications, dietary preferences, health goals

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { useSettings } from '../hooks/useSettings';
import ProviderSetup from '../components/ProviderSetup';
import ChipSelector from '../components/ChipSelector';
import TagInput from '../components/TagInput';
import {
  generatePhase1Suggestions,
  generateContextualSuggestions,
  getFallbackSuggestions,
  type OnboardingSuggestions,
} from '../services/onboarding-suggestions';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const SEX_OPTION_KEYS = ['male', 'female', 'other', 'preferNot'] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const { saveProfile, profile } = useHealthProfile();
  const { completeOnboarding, providers, selectProvider, setProviderConfig } =
    useSettings();
  const navigate = useNavigate();

  // Provider state
  const [selectedProvider, setSelectedProvider] = useState('');
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  // AI suggestions state
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions>(
    getFallbackSuggestions(),
  );
  const [conditionsLoading, setConditionsLoading] = useState(false); // Phase 1
  const [contextualLoading, setContextualLoading] = useState(false); // Phase 2
  const conditionsRequested = useRef(false); // Phase 1 guard
  const lastContextConditions = useRef<string>(''); // Phase 2 dedup key

  // Profile state
  const [ageRange, setAgeRange] = useState(profile?.ageRange ?? '');
  const [sex, setSex] = useState(profile?.sex ?? '');
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(profile?.weightKg?.toString() ?? '');
  const [conditions, setConditions] = useState<string[]>(
    profile?.conditions ?? [],
  );
  const [allergies, setAllergies] = useState<string[]>(
    profile?.allergies ?? [],
  );
  const [medications, setMedications] = useState<string[]>(
    profile?.medications ?? [],
  );
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(
    profile?.dietaryPreferences ?? [],
  );
  const [healthGoals, setHealthGoals] = useState<string[]>(
    profile?.healthGoals ?? [],
  );
  const [connectionVerified, setConnectionVerified] = useState(false); // true after successful connection

  const totalSteps = 8; // provider + 7 profile steps

  // ---------- Phase 1: Use suggestions request as connection test ----------
  const handleEstablishConnection = useCallback(async () => {
    if (!selectedProvider) return;
    const prov = providers.find((p) => p.id === selectedProvider);
    if (!prov) throw new Error('Provider not found');

    conditionsRequested.current = true;
    setConditionsLoading(true);
    try {
      const result = await generatePhase1Suggestions(prov, configDraft);
      if (result) {
        setSuggestions((prev) => ({
          ...prev,
          conditions: result.conditions,
          allergies: result.allergies,
        }));
      }
      setConnectionVerified(true);
    } catch (e) {
      conditionsRequested.current = false;
      throw e; // re-throw so ProviderSetup shows failure state
    } finally {
      setConditionsLoading(false);
    }
  }, [selectedProvider, providers, configDraft]);

  // ---------- Phase 2: Fire contextual suggestions when leaving conditions step ----------
  const fireContextualSuggestions = useCallback(() => {
    if (conditions.length === 0) return; // nothing to contextualize
    const key = [...conditions].sort().join('|'); // dedup key
    if (key === lastContextConditions.current) return; // unchanged
    lastContextConditions.current = key;

    const prov = providers.find((p) => p.id === selectedProvider);
    if (!prov) return;

    setContextualLoading(true);
    generateContextualSuggestions(prov, configDraft, conditions).then(
      (result) => {
        if (result) {
          setSuggestions((prev) => ({
            ...prev,
            // Merge: keep any items the user already selected + new AI options
            medications: [...new Set([...medications, ...result.medications])],
            dietaryPreferences: [
              ...new Set([...dietaryPreferences, ...result.dietaryPreferences]),
            ],
            healthGoals: [...new Set([...healthGoals, ...result.healthGoals])],
          }));
        }
        setContextualLoading(false);
      },
    );
  }, [
    conditions,
    medications,
    dietaryPreferences,
    healthGoals,
    selectedProvider,
    configDraft,
    providers,
  ]);

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
      <h2 className="text-xl font-semibold">
        {t('onboarding.connectProvider')}
      </h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.connectProviderDesc')}
      </p>
      <ProviderSetup
        providers={providers}
        selectedProviderId={selectedProvider}
        onProviderChange={(id) => {
          setSelectedProvider(id);
          setConfigDraft({});
          conditionsRequested.current = false;
          lastContextConditions.current = '';
          setConnectionVerified(false);
        }}
        config={configDraft}
        onConfigChange={(key, value) => {
          setConfigDraft((prev) => ({ ...prev, [key]: value }));
          conditionsRequested.current = false;
          lastContextConditions.current = '';
          setConnectionVerified(false);
        }}
        onTestConnection={handleEstablishConnection}
      />
    </div>,

    // Step 1: Age & Sex (buffer for Phase 1 condition suggestions)
    <div key="age-sex" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('onboarding.aboutYou')}</h2>
      <p className="text-surface-400 text-sm">{t('onboarding.aboutYouDesc')}</p>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-surface-300 block mb-1">
            {t('onboarding.ageRange')}
          </label>
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
          <label className="text-sm text-surface-300 block mb-1">
            {t('onboarding.sex')}
          </label>
          <div className="flex flex-wrap gap-2">
            {SEX_OPTION_KEYS.map((key) => {
              const label = t(`onboarding.sexOptions.${key}`);
              return (
                <button
                  key={key}
                  onClick={() => setSex(label)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${sex === label ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,

    // Step 2: Health Conditions (Phase 1 results should be ready)
    <div key="conditions" className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t('onboarding.healthConditions')}
      </h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.healthConditionsDesc')}
      </p>
      <ChipSelector
        options={suggestions.conditions}
        selected={conditions}
        onChange={setConditions}
        loading={conditionsLoading}
      />
      <TagInput
        tags={conditions.filter((c) => !suggestions.conditions.includes(c))}
        onChange={(custom) =>
          setConditions([
            ...conditions.filter((c) => suggestions.conditions.includes(c)),
            ...custom,
          ])
        }
        placeholder={t('onboarding.addCondition')}
      />
    </div>,

    // Step 3: Height & Weight (buffer for Phase 2 contextual suggestions)
    <div key="height-weight" className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t('onboarding.bodyMeasurements')}
      </h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.bodyMeasurementsDesc')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-surface-300 block mb-1">
            {t('onboarding.heightCm')}
          </label>
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="170"
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
          />
        </div>
        <div>
          <label className="text-sm text-surface-300 block mb-1">
            {t('onboarding.weightKg')}
          </label>
          <input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="70"
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>
    </div>,

    // Step 4: Allergies
    <div key="allergies" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('onboarding.allergies')}</h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.allergiesDesc')}
      </p>
      <ChipSelector
        options={suggestions.allergies}
        selected={allergies}
        onChange={setAllergies}
        loading={conditionsLoading}
      />
      <TagInput
        tags={allergies.filter((a) => !suggestions.allergies.includes(a))}
        onChange={(custom) =>
          setAllergies([
            ...allergies.filter((a) => suggestions.allergies.includes(a)),
            ...custom,
          ])
        }
        placeholder={t('onboarding.addAllergy')}
      />
    </div>,

    // Step 5: Medications
    <div key="medications" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('onboarding.medications')}</h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.medicationsDesc')}
      </p>
      {suggestions.medications.length > 0 && (
        <>
          <ChipSelector
            options={suggestions.medications}
            selected={medications}
            onChange={setMedications}
            loading={contextualLoading}
          />
        </>
      )}
      <TagInput
        tags={medications.filter((m) => !suggestions.medications.includes(m))}
        onChange={(custom) =>
          setMedications([
            ...medications.filter((m) => suggestions.medications.includes(m)),
            ...custom,
          ])
        }
        placeholder={t('onboarding.addMedication')}
      />
    </div>,

    // Step 6: Diet
    <div key="diet" className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t('onboarding.dietaryPreferences')}
      </h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.dietaryPreferencesDesc')}
      </p>
      <ChipSelector
        options={suggestions.dietaryPreferences}
        selected={dietaryPreferences}
        onChange={setDietaryPreferences}
        loading={contextualLoading}
      />
      <TagInput
        tags={dietaryPreferences.filter(
          (d) => !suggestions.dietaryPreferences.includes(d),
        )}
        onChange={(custom) =>
          setDietaryPreferences([
            ...dietaryPreferences.filter((d) =>
              suggestions.dietaryPreferences.includes(d),
            ),
            ...custom,
          ])
        }
        placeholder={t('onboarding.addPreference')}
      />
    </div>,

    // Step 7: Goals
    <div key="goals" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('onboarding.healthGoals')}</h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.healthGoalsDesc')}
      </p>
      <ChipSelector
        options={suggestions.healthGoals}
        selected={healthGoals}
        onChange={setHealthGoals}
        loading={contextualLoading}
      />
      <TagInput
        tags={healthGoals.filter((g) => !suggestions.healthGoals.includes(g))}
        onChange={(custom) =>
          setHealthGoals([
            ...healthGoals.filter((g) => suggestions.healthGoals.includes(g)),
            ...custom,
          ])
        }
        placeholder={t('onboarding.addGoal')}
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
              {t('onboarding.stepOf', { current: step + 1, total: totalSteps })}
            </span>
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
      <div className="flex-1 p-4 max-w-lg mx-auto w-full overflow-y-auto">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="p-4 max-w-lg mx-auto w-full flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 bg-surface-800 hover:bg-surface-700 text-surface-300 py-2.5 rounded-lg text-sm transition-colors"
          >
            {t('onboarding.back')}
          </button>
        )}
        {step < totalSteps - 1 ? (
          <button
            onClick={() => {
              // Fire Phase 2 when leaving the conditions step (step 2)
              if (step === 2) fireContextualSuggestions();
              setStep(step + 1);
            }}
            disabled={step === 0 && !connectionVerified}
            className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm transition-colors"
          >
            {t('onboarding.next')}
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-lg text-sm transition-colors"
          >
            {t('onboarding.getStarted')}
          </button>
        )}
      </div>
    </div>
  );
}
