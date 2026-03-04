// HealthVault — Dashboard page
// Hero greeting, daily health tip, quick actions, chat starters,
// health goals, profile at a glance, and merged recent activity.

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { useSettings } from '../hooks/useSettings';
import { getRecentScans, getRecentConversationSummaries } from '../services/db';
import { getDailyTip } from '../services/daily-tip';
import { pickRandomStarters } from '../services/starters';
import type { FoodScanRecord, ConversationSummary } from '../types';
import { verdictEmoji } from '../constants';

type ActivityItem =
  | { kind: 'scan'; ts: number; data: FoodScanRecord }
  | { kind: 'chat'; ts: number; data: ConversationSummary };

export default function Dashboard() {
  const { t } = useTranslation();
  const { profile, provider, settings: appSettings } = useAppContext();
  const { settings } = useSettings();
  const [recentScans, setRecentScans] = useState<FoodScanRecord[]>([]);
  const [recentConvs, setRecentConvs] = useState<ConversationSummary[]>([]);
  const [dailyTip, setDailyTip] = useState<string | null>(null);

  // Load recent data
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Load daily tip
  useEffect(() => {
    if (!provider || !appSettings) return;
    const config = appSettings.providerConfigs?.[provider.id] ?? {};
    getDailyTip(provider, config).then((tip) => {
      if (tip) setDailyTip(tip);
    });
  }, [provider, appSettings]);

  // Pick random chat starters
  const starters = useMemo(
    () => pickRandomStarters(settings?.chatStarters ?? [], 3),
    [settings?.chatStarters],
  );

  // Merge recent activity
  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...recentScans.map((s) => ({
        kind: 'scan' as const,
        ts: s.timestamp,
        data: s,
      })),
      ...recentConvs.map((c) => ({
        kind: 'chat' as const,
        ts: c.updatedAt,
        data: c,
      })),
    ];
    return items.sort((a, b) => b.ts - a.ts).slice(0, 4);
  }, [recentScans, recentConvs]);

  // Compute BMI
  const bmi = useMemo(() => {
    if (!profile?.heightCm || !profile?.weightKg) return null;
    const heightM = profile.heightCm / 100;
    return (profile.weightKg / (heightM * heightM)).toFixed(1);
  }, [profile?.heightCm, profile?.weightKg]);

  const hasActivity = recentScans.length > 0 || recentConvs.length > 0;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-surface-100">
          {t('dashboard.welcomeBack')}
        </h2>
        <p className="text-surface-400 text-sm mt-1">
          {provider ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {t('dashboard.connectedTo', { name: provider.name })}
            </span>
          ) : (
            <>
              {t('dashboard.noProvider')}
              <Link to="/settings" className="text-primary-400 hover:underline">
                {t('dashboard.setOneUp')}
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Daily Health Tip */}
      {dailyTip && (
        <div className="bg-surface-800 border-l-4 border-primary-500 rounded-r-lg p-3 flex items-start gap-3">
          <span className="text-lg shrink-0">💡</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-surface-200 leading-relaxed">
              {dailyTip}
            </p>
          </div>
          <Link
            to={`/chat?q=${encodeURIComponent(`Tell me more about: ${dailyTip}`)}`}
            className="shrink-0 text-xs text-primary-400 hover:underline whitespace-nowrap"
          >
            {t('dashboard.learnMore')}
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/scanner?new=1"
          className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl p-5 transition-colors group"
        >
          <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
            📷
          </div>
          <h3 className="text-sm font-semibold text-surface-100">
            {t('dashboard.scanFood')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            {t('dashboard.scanFoodDesc')}
          </p>
        </Link>
        <Link
          to="/chat?new=1"
          className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl p-5 transition-colors group"
        >
          <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
            💬
          </div>
          <h3 className="text-sm font-semibold text-surface-100">
            {t('dashboard.askQuestion')}
          </h3>
          <p className="text-xs text-surface-400 mt-1">
            {t('dashboard.askQuestionDesc')}
          </p>
        </Link>
      </div>

      {/* Chat Starters */}
      {starters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-100 mb-2">
            {t('dashboard.chatStarters')}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {starters.map((starter) => (
              <Link
                key={starter}
                to={`/chat?q=${encodeURIComponent(starter)}`}
                className="shrink-0 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-full px-4 py-2 text-xs text-surface-200 transition-colors"
              >
                {starter}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Health Goals */}
      {profile && profile.healthGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-100 mb-2">
            {t('dashboard.yourGoals')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.healthGoals.map((goal) => (
              <span
                key={goal}
                className="bg-primary-950/40 border border-primary-800/50 text-primary-300 rounded-full px-3 py-1 text-xs"
              >
                🎯 {goal}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Profile at a Glance */}
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
            {profile.ageRange && (
              <div>
                <span className="text-surface-500">{t('dashboard.age')}</span>
                <span className="text-surface-300">{profile.ageRange}</span>
              </div>
            )}
            {profile.sex && (
              <div>
                <span className="text-surface-500">{t('dashboard.sex')}</span>
                <span className="text-surface-300">{profile.sex}</span>
              </div>
            )}
            {bmi && (
              <div>
                <span className="text-surface-500">{t('dashboard.bmi')}</span>
                <span className="text-surface-300">{bmi}</span>
              </div>
            )}
            {profile.conditions.length > 0 && (
              <div className="col-span-2">
                <span className="text-surface-500">
                  {t('dashboard.conditions')}
                </span>
                <span className="text-surface-300">
                  {profile.conditions.join(', ')}
                </span>
              </div>
            )}
            {profile.allergies.length > 0 && (
              <div className="col-span-2">
                <span className="text-surface-500">
                  {t('dashboard.allergies')}
                </span>
                <span className="text-surface-300">
                  {profile.allergies.join(', ')}
                </span>
              </div>
            )}
            {profile.medications.length > 0 && (
              <div className="col-span-2">
                <span className="text-surface-500">
                  {t('dashboard.medications')}
                </span>
                <span className="text-surface-300">
                  {profile.medications.join(', ')}
                </span>
              </div>
            )}
            {profile.dietaryPreferences.length > 0 && (
              <div className="col-span-2">
                <span className="text-surface-500">{t('dashboard.diet')}</span>
                <span className="text-surface-300">
                  {profile.dietaryPreferences.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {hasActivity && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-surface-100">
              {t('dashboard.recentActivity')}
            </h3>
            <Link
              to="/history"
              className="text-xs text-primary-400 hover:underline"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="space-y-2">
            {activity.map((item) =>
              item.kind === 'scan' ? (
                <div
                  key={`scan-${item.data.id}`}
                  className="bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="text-lg">
                    {
                      verdictEmoji[
                        (item.data as FoodScanRecord).verdict.overall
                      ]
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 truncate">
                      {(item.data as FoodScanRecord).ingredients.join(', ')}
                    </p>
                    <p className="text-xs text-surface-500">
                      {new Date(item.ts).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key={`chat-${item.data.id}`}
                  className="bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="text-lg">💬</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 truncate">
                      {(item.data as ConversationSummary).title}
                    </p>
                    <p className="text-xs text-surface-500">
                      {new Date(item.ts).toLocaleDateString()} ·{' '}
                      {t('dashboard.messageCount', {
                        count: (item.data as ConversationSummary).messageCount,
                      })}
                    </p>
                  </div>
                  <Link
                    to={`/chat?conv=${item.data.id}`}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
                  >
                    {t('dashboard.resume')}
                  </Link>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Empty State — Feature Discovery */}
      {!hasActivity && (
        <div className="space-y-3 py-4">
          <p className="text-surface-400 text-sm text-center mb-4">
            {t('dashboard.noActivity')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/scanner?new=1"
              className="bg-surface-800 border border-surface-700 border-dashed rounded-xl p-4 text-center hover:border-primary-500/50 transition-colors"
            >
              <div className="text-2xl mb-2">📸</div>
              <p className="text-xs font-medium text-surface-200">
                {t('dashboard.discoverScan')}
              </p>
              <p className="text-xs text-surface-500 mt-1">
                {t('dashboard.discoverScanDesc')}
              </p>
            </Link>
            <Link
              to="/chat?new=1"
              className="bg-surface-800 border border-surface-700 border-dashed rounded-xl p-4 text-center hover:border-primary-500/50 transition-colors"
            >
              <div className="text-2xl mb-2">🩺</div>
              <p className="text-xs font-medium text-surface-200">
                {t('dashboard.discoverChat')}
              </p>
              <p className="text-xs text-surface-500 mt-1">
                {t('dashboard.discoverChatDesc')}
              </p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
