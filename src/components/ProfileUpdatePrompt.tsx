// HealthVault — Profile update suggestion prompt
// Shown when AI detects new health info in a conversation.

import { useTranslation } from 'react-i18next';

interface ProfileUpdatePromptProps {
  updates: {
    conditions?: string[];
    allergies?: string[];
    medications?: string[];
  };
  explanation: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function ProfileUpdatePrompt({
  updates,
  explanation,
  onAccept,
  onDismiss,
}: ProfileUpdatePromptProps) {
  const { t } = useTranslation();
  const allUpdates = [
    ...(updates.conditions?.map((c) => ({
      type: t('profile.condition'),
      value: c,
    })) ?? []),
    ...(updates.allergies?.map((a) => ({
      type: t('profile.allergy'),
      value: a,
    })) ?? []),
    ...(updates.medications?.map((m) => ({
      type: t('profile.medication'),
      value: m,
    })) ?? []),
  ];

  if (allUpdates.length === 0) return null;

  return (
    <div className="bg-primary-900/30 border border-primary-700/40 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-surface-100">
            {t('profile.updateTitle')}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">{explanation}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {allUpdates.map((u, i) => (
          <span
            key={i}
            className="bg-surface-800 text-surface-200 text-xs px-2 py-1 rounded-md"
          >
            {u.type}: {u.value}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 bg-primary-600 hover:bg-primary-500 text-white text-sm py-2 rounded-lg transition-colors"
        >
          {t('profile.addToProfile')}
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm py-2 rounded-lg transition-colors"
        >
          {t('profile.dismiss')}
        </button>
      </div>
    </div>
  );
}
