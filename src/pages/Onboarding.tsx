// HealthVault — Onboarding page
// Step 0: AI Provider setup (with Test Connection)
// Steps 1–4: Profile entry with AI-powered suggestions
//
// Two-phase AI flow:
//   Phase 1 (Next from About You step) → age/sex/locale-aware health conditions
//   Phase 2 (Leave health profile step) → condition-aware suggestions for
//           medications and health goals
// Dietary preferences use a static list.

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { useSettings } from '../hooks/useSettings';
import ProviderSetup from '../components/ProviderSetup';
import CommunityWarning from '../components/CommunityWarning';
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
  const [providerMode, setProviderMode] = useState<
    'none' | 'community' | 'byop'
  >('none');

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

  const totalSteps = 5; // provider + 4 profile steps

  // ---------- Phase 1: Fire when leaving Age & Sex step ----------
  const handlePhase1Next = useCallback(async () => {
    if (conditionsRequested.current) {
      // Already fetched, just advance
      setStep(2);
      return;
    }

    const prov = providers.find((p) => p.id === selectedProvider);
    if (!prov) {
      setStep(2);
      return;
    }

    conditionsRequested.current = true;
    setConditionsLoading(true);
    try {
      const result = await generatePhase1Suggestions(prov, configDraft, {
        ageRange,
        sex,
      });
      if (result) {
        setSuggestions((prev) => ({
          ...prev,
          conditions: result.conditions,
          allergies: result.allergies,
        }));
      }
    } catch {
      conditionsRequested.current = false;
      // Swallow — fallback suggestions are already loaded
    } finally {
      setConditionsLoading(false);
      setStep(2);
    }
  }, [selectedProvider, providers, configDraft, ageRange, sex]);

  // ---------- Phase 2: Fire contextual suggestions when leaving conditions step ----------
  const handlePhase2Next = useCallback(async () => {
    if (conditions.length === 0) {
      setStep(3);
      return;
    }
    const key = [...conditions].sort().join('|'); // dedup key
    if (key === lastContextConditions.current) {
      // Already fetched for these conditions, just advance
      setStep(3);
      return;
    }
    lastContextConditions.current = key;

    const prov = providers.find((p) => p.id === selectedProvider);
    if (!prov) {
      setStep(3);
      return;
    }

    setContextualLoading(true);
    try {
      const result = await generateContextualSuggestions(
        prov,
        configDraft,
        conditions,
      );
      if (result) {
        setSuggestions((prev) => ({
          ...prev,
          // Merge: keep any items the user already selected + new AI options
          medications: [...new Set([...medications, ...result.medications])],
          healthGoals: [...new Set([...healthGoals, ...result.healthGoals])],
        }));
      }
    } catch {
      // Swallow — fallback suggestions are already loaded
    } finally {
      setContextualLoading(false);
      setStep(3);
    }
  }, [
    conditions,
    medications,
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
    // Step 0: AI Provider Setup — two sections
    <div key="provider" className="space-y-4">
      <h2 className="text-xl font-semibold">
        {t('onboarding.connectProvider')}
      </h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.connectProviderDesc')}
      </p>

      {/* Section 1: Community (Free) */}
      <button
        onClick={() => {
          setProviderMode('community');
          setSelectedProvider('community');
          setConfigDraft({});
          conditionsRequested.current = false;
          lastContextConditions.current = '';
          setConnectionVerified(false);
        }}
        className={`w-full text-left rounded-lg border p-4 transition-colors ${
          providerMode === 'community'
            ? 'border-primary-500 bg-primary-950/40'
            : 'border-surface-600 bg-surface-800 hover:border-surface-500'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-100">
              {t('onboarding.communityTitle')}
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              {t('onboarding.communityDesc')}
            </p>
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              providerMode === 'community'
                ? 'border-primary-500'
                : 'border-surface-500'
            }`}
          >
            {providerMode === 'community' && (
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            )}
          </div>
        </div>
      </button>

      {providerMode === 'community' && (
        <div className="space-y-3 pl-1">
          <CommunityWarning />
          <ProviderSetup
            providers={providers.filter((p) => p.id === 'community')}
            selectedProviderId="community"
            onProviderChange={() => {}}
            hideProviderSelect
            config={configDraft}
            onConfigChange={(key, value) => {
              setConfigDraft((prev) => ({ ...prev, [key]: value }));
              setConnectionVerified(false);
            }}
            onConnectionResult={(ok) => setConnectionVerified(ok)}
          />
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-surface-700" />
        <span className="text-xs text-surface-500 uppercase">
          {t('onboarding.or')}
        </span>
        <div className="flex-1 h-px bg-surface-700" />
      </div>

      {/* Section 2: Bring Your Own */}
      <button
        onClick={() => {
          setProviderMode('byop');
          setSelectedProvider('');
          setConfigDraft({});
          conditionsRequested.current = false;
          lastContextConditions.current = '';
          setConnectionVerified(false);
        }}
        className={`w-full text-left rounded-lg border p-4 transition-colors ${
          providerMode === 'byop'
            ? 'border-primary-500 bg-primary-950/40'
            : 'border-surface-600 bg-surface-800 hover:border-surface-500'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-surface-100">
              {t('onboarding.byopTitle')}
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              {t('onboarding.byopDesc')}
            </p>
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              providerMode === 'byop'
                ? 'border-primary-500'
                : 'border-surface-500'
            }`}
          >
            {providerMode === 'byop' && (
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />
            )}
          </div>
        </div>
      </button>

      {providerMode === 'byop' && (
        <div className="space-y-3 pl-1">
          <ProviderSetup
            providers={providers.filter((p) => p.id !== 'community')}
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
            onConnectionResult={(ok) => setConnectionVerified(ok)}
          />
        </div>
      )}
    </div>,

    // Step 1: About You (age, sex, height, weight)
    <div key="about-you" className="space-y-4">
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
        <div className="grid grid-cols-2 gap-3 pt-2">
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
      </div>
    </div>,

    // Step 2: Health Profile (conditions + allergies)
    <div key="health-profile" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('onboarding.healthProfile')}</h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.healthProfileDesc')}
      </p>
      <div className="space-y-2">
        <label className="text-sm text-surface-300 block">
          {t('onboarding.healthConditions')}
        </label>
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
      </div>
      <div className="border-t border-surface-700 pt-4 space-y-2">
        <label className="text-sm text-surface-300 block">
          {t('onboarding.allergies')}
        </label>
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
      </div>
    </div>,

    // Step 3: Medications & Diet
    <div key="meds-diet" className="space-y-4">
      <h2 className="text-xl font-semibold">{t('onboarding.medsAndDiet')}</h2>
      <p className="text-surface-400 text-sm">
        {t('onboarding.medsAndDietDesc')}
      </p>
      <div className="space-y-2">
        <label className="text-sm text-surface-300 block">
          {t('onboarding.medications')}
        </label>
        {suggestions.medications.length > 0 && (
          <ChipSelector
            options={suggestions.medications}
            selected={medications}
            onChange={setMedications}
            loading={contextualLoading}
          />
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
      </div>
      <div className="border-t border-surface-700 pt-4 space-y-2">
        <label className="text-sm text-surface-300 block">
          {t('onboarding.dietaryPreferences')}
        </label>
        <ChipSelector
          options={suggestions.dietaryPreferences}
          selected={dietaryPreferences}
          onChange={setDietaryPreferences}
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
      </div>
    </div>,

    // Step 4: Health Goals
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
              // Fire Phase 1 when leaving the about you step (step 1)
              if (step === 1) {
                handlePhase1Next();
                return;
              }
              // Fire Phase 2 when leaving the health profile step (step 2)
              if (step === 2) {
                handlePhase2Next();
                return;
              }
              setStep(step + 1);
            }}
            disabled={
              (step === 0 && !connectionVerified) ||
              conditionsLoading ||
              contextualLoading
            }
            className="flex-1 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {(conditionsLoading && step === 1) ||
            (contextualLoading && step === 2) ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {t('onboarding.next')}
              </>
            ) : (
              t('onboarding.next')
            )}
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
