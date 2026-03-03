// HealthVault — Dashboard page

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { getRecentScans, getRecentConversationSummaries } from '../services/db';
import type { FoodScanRecord, ConversationSummary } from '../types';
import { verdictEmoji, DISPLAY_ITEMS_COUNT } from '../constants';

export default function Dashboard() {
  const { t } = useTranslation();
  const { profile, provider } = useAppContext();
  const [recentScans, setRecentScans] = useState<FoodScanRecord[]>([]);
  const [recentConvs, setRecentConvs] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    const loadData = () => {
      Promise.all([getRecentScans(5), getRecentConversationSummaries(5)]).then(
        ([scans, convs]) => {
          setRecentScans(scans);
          setRecentConvs(convs);
        },
      );
    };
    loadData();

    // Refresh data when the tab becomes visible (e.g., returning from another tab)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-surface-100">
          {t('dashboard.welcomeBack')}
        </h2>
        <p className="text-surface-400 text-sm mt-1">
          {provider
            ? t('dashboard.connectedTo', { name: provider.name })
            : t('dashboard.noProvider')}
          {!provider && (
            <Link to="/settings" className="text-primary-400 hover:underline">
              {t('dashboard.setOneUp')}
            </Link>
          )}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/scanner?new=1"
          className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl p-4 transition-colors"
        >
          <div className="text-2xl mb-2">📷</div>
          <h3 className="text-sm font-medium text-surface-100">
            {t('dashboard.newFoodScan')}
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            {t('dashboard.newFoodScanDesc')}
          </p>
        </Link>
        <Link
          to="/chat?new=1"
          className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl p-4 transition-colors"
        >
          <div className="text-2xl mb-2">💬</div>
          <h3 className="text-sm font-medium text-surface-100">
            {t('dashboard.newHealthChat')}
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            {t('dashboard.newHealthChatDesc')}
          </p>
        </Link>
      </div>

      {/* Profile summary */}
      {profile && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-100">
              {t('dashboard.yourProfile')}
            </h3>
            <Link
              to="/settings"
              className="text-xs text-primary-400 hover:underline"
            >
              {t('dashboard.edit')}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {profile.conditions.length > 0 && (
              <div>
                <span className="text-surface-500">
                  {t('dashboard.conditions')}
                </span>
                <span className="text-surface-300">
                  {profile.conditions.join(', ')}
                </span>
              </div>
            )}
            {profile.allergies.length > 0 && (
              <div>
                <span className="text-surface-500">
                  {t('dashboard.allergies')}
                </span>
                <span className="text-surface-300">
                  {profile.allergies.join(', ')}
                </span>
              </div>
            )}
            {profile.medications.length > 0 && (
              <div>
                <span className="text-surface-500">
                  {t('dashboard.medications')}
                </span>
                <span className="text-surface-300">
                  {profile.medications.join(', ')}
                </span>
              </div>
            )}
            {profile.dietaryPreferences.length > 0 && (
              <div>
                <span className="text-surface-500">{t('dashboard.diet')}</span>
                <span className="text-surface-300">
                  {profile.dietaryPreferences.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent scans */}
      {recentScans.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-surface-100">
              {t('dashboard.recentScans')}
            </h3>
            <Link
              to="/history"
              className="text-xs text-primary-400 hover:underline"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="space-y-2">
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                className="bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3"
              >
                <span className="text-lg">
                  {verdictEmoji[scan.verdict.overall]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 truncate">
                    {scan.ingredients.join(', ')}
                  </p>
                  <p className="text-xs text-surface-500">
                    {new Date(scan.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent conversations */}
      {recentConvs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-surface-100">
              {t('dashboard.recentConversations')}
            </h3>
            <Link
              to="/history"
              className="text-xs text-primary-400 hover:underline"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="space-y-2">
            {recentConvs.slice(0, DISPLAY_ITEMS_COUNT).map((conv) => (
              <div
                key={conv.id}
                className="bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 truncate">
                    {conv.title}
                  </p>
                  <p className="text-xs text-surface-500">
                    {new Date(conv.updatedAt).toLocaleDateString()} ·{' '}
                    {t('dashboard.messageCount', { count: conv.messageCount })}
                  </p>
                </div>
                <Link
                  to={`/chat?conv=${conv.id}`}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                >
                  {t('dashboard.resume')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentScans.length === 0 && recentConvs.length === 0 && (
        <div className="text-center py-8">
          <p className="text-surface-400 text-sm">
            {t('dashboard.noActivity')}
          </p>
        </div>
      )}
    </div>
  );
}
