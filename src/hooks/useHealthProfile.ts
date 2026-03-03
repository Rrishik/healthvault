// HealthVault — useHealthProfile hook

import { useAppContext } from '../context/AppContext';
import type { HealthProfile } from '../types';

export function useHealthProfile() {
  const { profile, saveProfile } = useAppContext();

  const updateField = async <K extends keyof HealthProfile>(
    field: K,
    value: HealthProfile[K],
  ) => {
    await saveProfile({ [field]: value });
  };

  const addToList = async (
    field:
      | 'conditions'
      | 'allergies'
      | 'medications'
      | 'dietaryPreferences'
      | 'healthGoals',
    item: string,
  ) => {
    const current = profile?.[field] ?? [];
    if (!current.includes(item)) {
      await saveProfile({ [field]: [...current, item] });
    }
  };

  const removeFromList = async (
    field:
      | 'conditions'
      | 'allergies'
      | 'medications'
      | 'dietaryPreferences'
      | 'healthGoals',
    item: string,
  ) => {
    const current = profile?.[field] ?? [];
    await saveProfile({ [field]: current.filter((i) => i !== item) });
  };

  return {
    profile,
    saveProfile,
    updateField,
    addToList,
    removeFromList,
  };
}
