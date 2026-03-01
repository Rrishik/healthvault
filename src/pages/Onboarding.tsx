// HealthVault — Onboarding page (6 skippable steps)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { useSettings } from '../hooks/useSettings';
import ConfigFieldRenderer from '../components/ConfigFieldRenderer';

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const SEX_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const COMMON_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Celiac Disease',
  'IBS', 'GERD', 'Thyroid Disorder', 'Kidney Disease', 'Liver Disease',
];
const COMMON_ALLERGIES = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish',
  'Shellfish', 'Sesame', 'Gluten',
];
const DIET_OPTIONS = [
  'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Halal', 'Kosher',
  'Gluten-Free', 'Dairy-Free', 'Low-Sodium', 'Low-Sugar',
];
const GOAL_OPTIONS = [
  'Lose Weight', 'Gain Muscle', 'Improve Heart Health', 'Manage Blood Sugar',
  'Reduce Inflammation', 'Improve Gut Health', 'Better Sleep', 'More Energy',
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const { saveProfile, profile } = useHealthProfile();
  const { completeOnboarding, providers, selectProvider, setProviderConfig } =
    useSettings();
  const navigate = useNavigate();

  // Local state for form fields
  const [ageRange, setAgeRange] = useState(profile?.ageRange ?? '');
  const [sex, setSex] = useState(profile?.sex ?? '');
  const [heightCm, setHeightCm] = useState(profile?.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(profile?.weightKg?.toString() ?? '');
  const [conditions, setConditions] = useState<string[]>(profile?.conditions ?? []);
  const [conditionInput, setConditionInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>(profile?.allergies ?? []);
  const [allergyInput, setAllergyInput] = useState('');
  const [medications, setMedications] = useState<string[]>(profile?.medications ?? []);
  const [medInput, setMedInput] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(
    profile?.dietaryPreferences ?? [],
  );
  const [healthGoals, setHealthGoals] = useState<string[]>(profile?.healthGoals ?? []);
  const [goalInput, setGoalInput] = useState('');

  // Provider setup
  const [selectedProvider, setSelectedProvider] = useState('');
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  const totalSteps = 7; // 6 profile steps + 1 provider setup

  const toggleChip = (
    list: string[],
    setList: (v: string[]) => void,
    item: string,
  ) => {
    setList(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
    );
  };

  const addTag = (
    list: string[],
    setList: (v: string[]) => void,
    input: string,
    setInput: (v: string) => void,
  ) => {
    const trimmed = input.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput('');
  };

  const removeTag = (
    list: string[],
    setList: (v: string[]) => void,
    item: string,
  ) => {
    setList(list.filter((i) => i !== item));
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
      // Merge any default values from the schema into the config
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

  const renderChips = (
    options: string[],
    selected: string[],
    setSelected: (v: string[]) => void,
  ) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => toggleChip(selected, setSelected, opt)}
          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
            selected.includes(opt)
              ? 'bg-primary-600 text-white'
              : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  const renderTagInput = (
    list: string[],
    setList: (v: string[]) => void,
    input: string,
    setInput: (v: string) => void,
    placeholder: string,
  ) => (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(list, setList, input, setInput);
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
        />
        <button
          onClick={() => addTag(list, setList, input, setInput)}
          className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-2 rounded-lg text-sm"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((item) => (
          <span
            key={item}
            className="bg-surface-800 text-surface-200 text-xs px-2 py-1 rounded-md flex items-center gap-1"
          >
            {item}
            <button
              onClick={() => removeTag(list, setList, item)}
              className="text-surface-500 hover:text-surface-200"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );

  const steps = [
    // Step 0: Basics
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

    // Step 1: Conditions
    <div key="conditions" className="space-y-4">
      <h2 className="text-xl font-semibold">Health Conditions</h2>
      <p className="text-surface-400 text-sm">Select any existing conditions or add your own.</p>
      {renderChips(COMMON_CONDITIONS, conditions, setConditions)}
      {renderTagInput(
        conditions.filter((c) => !COMMON_CONDITIONS.includes(c)),
        (custom) => setConditions([...conditions.filter((c) => COMMON_CONDITIONS.includes(c)), ...custom]),
        conditionInput,
        setConditionInput,
        'Add a condition…',
      )}
    </div>,

    // Step 2: Allergies
    <div key="allergies" className="space-y-4">
      <h2 className="text-xl font-semibold">Allergies</h2>
      <p className="text-surface-400 text-sm">Select known allergies or add your own.</p>
      {renderChips(COMMON_ALLERGIES, allergies, setAllergies)}
      {renderTagInput(
        allergies.filter((a) => !COMMON_ALLERGIES.includes(a)),
        (custom) => setAllergies([...allergies.filter((a) => COMMON_ALLERGIES.includes(a)), ...custom]),
        allergyInput,
        setAllergyInput,
        'Add an allergy…',
      )}
    </div>,

    // Step 3: Medications
    <div key="medications" className="space-y-4">
      <h2 className="text-xl font-semibold">Medications</h2>
      <p className="text-surface-400 text-sm">List any medications you're currently taking.</p>
      {renderTagInput(medications, setMedications, medInput, setMedInput, 'Add a medication…')}
    </div>,

    // Step 4: Diet
    <div key="diet" className="space-y-4">
      <h2 className="text-xl font-semibold">Dietary Preferences</h2>
      <p className="text-surface-400 text-sm">Select any dietary preferences or restrictions.</p>
      {renderChips(DIET_OPTIONS, dietaryPreferences, setDietaryPreferences)}
    </div>,

    // Step 5: Goals
    <div key="goals" className="space-y-4">
      <h2 className="text-xl font-semibold">Health Goals</h2>
      <p className="text-surface-400 text-sm">What are you trying to achieve?</p>
      {renderChips(GOAL_OPTIONS, healthGoals, setHealthGoals)}
      {renderTagInput(
        healthGoals.filter((g) => !GOAL_OPTIONS.includes(g)),
        (custom) => setHealthGoals([...healthGoals.filter((g) => GOAL_OPTIONS.includes(g)), ...custom]),
        goalInput,
        setGoalInput,
        'Add a goal…',
      )}
    </div>,

    // Step 6: Provider setup
    <div key="provider" className="space-y-4">
      <h2 className="text-xl font-semibold">AI Provider Setup</h2>
      <p className="text-surface-400 text-sm">
        Connect an AI provider to power food analysis and health queries.
        Your API key is stored locally and never sent to our servers.
      </p>
      <div>
        <label className="text-sm text-surface-300 block mb-1">Provider</label>
        <select
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value);
            setConfigDraft({});
          }}
          className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 focus:outline-none focus:border-primary-500"
        >
          <option value="">Select a provider…</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {selectedProvider && (
        <ConfigFieldRenderer
          fields={providers.find((p) => p.id === selectedProvider)?.configSchema ?? []}
          values={configDraft}
          onChange={(key, value) => setConfigDraft({ ...configDraft, [key]: value })}
        />
      )}
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
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">{steps[step]}</div>

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
