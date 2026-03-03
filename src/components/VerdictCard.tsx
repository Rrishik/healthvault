// HealthVault — Traffic-light food verdict display

import { useState } from 'react';
import type { FoodVerdict } from '../types';
import { useTranslation } from 'react-i18next';
import {
  computeDailyValuePercents,
  type NutrientWithDV,
} from '../data/daily-values';

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
  /** Show full nutrition %DV panel; when false, show a hint to upload the label */
  showNutritionDV?: boolean;
}

export default function VerdictCard({
  verdict,
  showNutritionDV = true,
}: VerdictCardProps) {
  const { t } = useTranslation();
  const [showNutrition, setShowNutrition] = useState(false);

  const nutrientsWithDV: NutrientWithDV[] = verdict.nutrition?.nutrients
    ? computeDailyValuePercents(verdict.nutrition.nutrients)
    : [];

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

      {/* Ingredient source attribution */}
      {verdict.ingredientSource && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-300">ℹ️ {verdict.ingredientSource}</p>
        </div>
      )}

      {/* Nutrition facts — collapsible (only when showNutritionDV) */}
      {showNutritionDV && nutrientsWithDV.length > 0 && (
        <div className="border border-surface-700/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowNutrition((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-800/60 hover:bg-surface-700/60 transition-colors"
          >
            <span className="text-sm font-medium text-surface-200">
              {t('nutrition.title')}
              {verdict.nutrition?.servingSize && (
                <span className="text-surface-400 font-normal ml-1">
                  — {verdict.nutrition.servingSize}
                </span>
              )}
            </span>
            <span
              className={`text-surface-400 transition-transform ${showNutrition ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          </button>
          {showNutrition && (
            <div className="px-3 py-2 space-y-1.5">
              <p className="text-[10px] text-surface-500 mb-2">
                {t('nutrition.dvFootnote')}
              </p>
              {nutrientsWithDV.map((n, i) => (
                <NutrientRow key={i} nutrient={n} />
              ))}
              <p className="text-[10px] text-surface-500 pt-2 border-t border-surface-700/50">
                {t('nutrition.source')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Hint to upload ingredients list when nutrition %DV is not available */}
      {!showNutritionDV && (
        <div className="bg-surface-800/40 border border-surface-700/50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-surface-400">
            📊 {t('nutrition.uploadHint')}
          </p>
        </div>
      )}

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

/** Color for %DV bar: green ≤15%, yellow 16-39%, red ≥40% (simplified) */
function dvBarColor(pct: number): string {
  if (pct <= 15) return 'bg-green-500';
  if (pct <= 39) return 'bg-yellow-500';
  return 'bg-red-500';
}

function NutrientRow({ nutrient }: { nutrient: NutrientWithDV }) {
  const isMacro = [
    'calories',
    'total fat',
    'total carbohydrate',
    'protein',
  ].includes(nutrient.nutrient.toLowerCase());

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`${isMacro ? 'font-semibold' : 'pl-3'} text-surface-200 w-32 shrink-0 truncate`}
      >
        {nutrient.nutrient}
      </span>
      <span className="text-surface-400 w-16 text-right shrink-0">
        {nutrient.amount}
        {nutrient.unit}
      </span>
      {nutrient.dailyValuePercent !== null ? (
        <>
          <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${dvBarColor(nutrient.dailyValuePercent)}`}
              style={{
                width: `${Math.min(nutrient.dailyValuePercent, 100)}%`,
              }}
            />
          </div>
          <span className="text-surface-300 w-10 text-right shrink-0">
            {nutrient.dailyValuePercent}%
          </span>
        </>
      ) : (
        <span className="flex-1 text-surface-500 text-right">—</span>
      )}
    </div>
  );
}
