// HealthVault — Traffic-light food verdict display

import type { FoodVerdict } from '../types';
import { useTranslation } from 'react-i18next';

const statusColors = {
  safe: 'bg-success-500',
  caution: 'bg-warning-500',
  avoid: 'bg-danger-500',
} as const;

const statusBgLight = {
  safe: 'bg-green-900/30 border-green-700/40',
  caution: 'bg-yellow-900/30 border-yellow-700/40',
  avoid: 'bg-red-900/30 border-red-700/40',
} as const;

interface VerdictCardProps {
  verdict: FoodVerdict;
}

export default function VerdictCard({ verdict }: VerdictCardProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${statusBgLight[verdict.overall]}`}
    >
      {/* Overall badge */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold text-white ${statusColors[verdict.overall]}`}
        >
          {t(`verdict.${verdict.overall}`)}
        </span>
        <p className="text-surface-200 text-sm flex-1">{verdict.summary}</p>
      </div>

      {/* Per-ingredient details */}
      <ul className="space-y-2">
        {verdict.details.map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${statusColors[d.status]}`}
            />
            <div>
              <span className="font-medium text-surface-100">
                {d.ingredient}
              </span>
              <span className="text-surface-400 ml-1">— {d.reason}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Alternatives */}
      {verdict.alternatives && verdict.alternatives.length > 0 && (
        <div className="pt-2 border-t border-surface-700/50">
          <p className="text-xs text-surface-400 mb-1">
            {t('verdict.alternatives')}
          </p>
          <div className="flex flex-wrap gap-2">
            {verdict.alternatives.map((alt, i) => (
              <span
                key={i}
                className="bg-surface-800 text-surface-200 text-xs px-2 py-1 rounded-md"
              >
                {alt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
