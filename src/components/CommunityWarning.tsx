// HealthVault — Community provider warning banner (shared)

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LS_KEYS } from '../constants';

export default function CommunityWarning() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(LS_KEYS.COMMUNITY_WARNING_DISMISSED) === '1',
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(LS_KEYS.COMMUNITY_WARNING_DISMISSED, '1');
  };

  return (
    <div className="relative bg-amber-900/30 border border-amber-700/40 rounded-lg p-3 pr-8 space-y-2">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-amber-500 hover:text-amber-300 transition-colors"
        aria-label="Dismiss"
      >
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <p className="text-xs text-amber-300 leading-relaxed">
        <span className="font-semibold">{t('community.note')}</span>{' '}
        {t('community.description')}
      </p>
      <ul className="text-xs text-amber-400/80 list-disc list-inside space-y-0.5">
        <li>{t('community.rateLimit')}</li>
        <li>{t('community.sizeLimit')}</li>
      </ul>
    </div>
  );
}
