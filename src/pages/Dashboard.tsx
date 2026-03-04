// HealthVault — Dashboard page
// Hero greeting, goal tips, quick actions, chat starters,
// health goals with tip badges, health snapshot, and merged recent activity.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { useSettings } from '../hooks/useSettings';
import { getRecentScans, getRecentConversationSummaries } from '../services/db';
import {
  getGoalTips,
  getSeenGoals,
  markGoalSeen,
  type GoalTip,
} from '../services/goal-tips';
import { pickRandomStarters } from '../services/starters';
import type { FoodScanRecord, ConversationSummary } from '../types';
import { verdictEmoji } from '../constants';
import BmiGauge from '../components/BmiGauge';

type ActivityItem =
  | { kind: 'scan'; ts: number; data: FoodScanRecord }
  | { kind: 'chat'; ts: number; data: ConversationSummary };

export default function Dashboard() {
  const { t } = useTranslation();
  const { profile, provider, settings: appSettings } = useAppContext();
  const { settings } = useSettings();
  const [recentScans, setRecentScans] = useState<FoodScanRecord[]>([]);
  const [recentConvs, setRecentConvs] = useState<ConversationSummary[]>([]);
  const [goalTips, setGoalTips] = useState<GoalTip[]>([]);
  const [seenGoals, setSeenGoals] = useState<Set<string>>(getSeenGoals);
  const [activeTipGoal, setActiveTipGoal] = useState<string | null>(null);

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

  // Load goal tips
  useEffect(() => {
    if (!provider || !appSettings || !profile?.healthGoals?.length) return;
    const config = appSettings.providerConfigs?.[provider.id] ?? {};
    getGoalTips(provider, config, profile.healthGoals).then((tips) => {
      if (tips) setGoalTips(tips);
    });
  }, [provider, appSettings, profile?.healthGoals]);

  const handleGoalClick = useCallback(
    (goal: string) => {
      setActiveTipGoal((prev) => (prev === goal ? null : goal));
      if (!seenGoals.has(goal)) {
        markGoalSeen(goal);
        setSeenGoals((prev) => new Set([...prev, goal]));
      }
    },
    [seenGoals],
  );

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

  // Profile completeness (9 fields total)
  const profileCompleteness = useMemo(() => {
    if (!profile) return { filled: 0, total: 9, percent: 0 };
    let filled = 0;
    if (profile.ageRange) filled++;
    if (profile.sex) filled++;
    if (profile.heightCm) filled++;
    if (profile.weightKg) filled++;
    if (profile.conditions.length > 0) filled++;
    if (profile.allergies.length > 0) filled++;
    if (profile.medications.length > 0) filled++;
    if (profile.dietaryPreferences.length > 0) filled++;
    if (profile.healthGoals.length > 0) filled++;
    return { filled, total: 9, percent: Math.round((filled / 9) * 100) };
  }, [profile]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    if (!profile) return [];
    const parts: string[] = [];
    if (profile.conditions.length > 0)
      parts.push(
        `${profile.conditions.length} condition${profile.conditions.length > 1 ? 's' : ''}`,
      );
    if (profile.allergies.length > 0)
      parts.push(
        `${profile.allergies.length} allerg${profile.allergies.length > 1 ? 'ies' : 'y'}`,
      );
    if (profile.medications.length > 0)
      parts.push(
        `${profile.medications.length} med${profile.medications.length > 1 ? 's' : ''}`,
      );
    if (profile.dietaryPreferences.length > 0)
      parts.push(
        `${profile.dietaryPreferences.length} diet pref${profile.dietaryPreferences.length > 1 ? 's' : ''}`,
      );
    return parts;
  }, [profile]);

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

      {/* Health Goals with Tip Badges */}
      {profile && profile.healthGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-100 mb-2">
            {t('dashboard.yourGoals')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.healthGoals.map((goal) => {
              const tip = goalTips.find(
                (t) => t.goal.toLowerCase() === goal.toLowerCase(),
              );
              const hasUnseen = tip && !seenGoals.has(goal);
              const isActive = activeTipGoal === goal;
              return (
                <div key={goal} className="relative">
                  <button
                    onClick={() => tip && handleGoalClick(goal)}
                    className={`relative rounded-full px-3 py-1 text-xs transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-primary-950/40 border border-primary-800/50 text-primary-300 hover:bg-primary-900/60'
                    } ${tip ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    🎯 {goal}
                    {hasUnseen && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                    )}
                  </button>
                  {/* Tip popover */}
                  {isActive && tip && (
                    <div className="absolute left-0 top-full mt-2 z-10 w-64 bg-surface-700 border border-surface-600 rounded-lg p-3 pr-8 shadow-lg">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTipGoal(null);
                        }}
                        className="absolute top-2 right-2 text-surface-400 hover:text-surface-200 transition-colors"
                        aria-label="Close"
                      >
                        <svg
                          className="w-3.5 h-3.5"
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
                      <p className="text-xs text-surface-200 leading-relaxed">
                        💡 {tip.tip}
                      </p>
                      <Link
                        to={`/chat?q=${encodeURIComponent(`You suggested this tip: "${tip.tip}". Tell me more about this and how I can ${goal.toLowerCase()} based on my health profile.`)}`}
                        className="block mt-2 text-xs text-primary-400 hover:underline"
                      >
                        {t('dashboard.learnMore')}
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Health Snapshot */}
      {profile && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-100">
              {t('dashboard.healthSnapshot')}
            </h3>
            <Link
              to="/settings"
              className="text-xs text-primary-400 hover:underline"
            >
              {t('dashboard.viewProfile')}
            </Link>
          </div>

          {/* BMI Gauge + Summary */}
          <div className="flex items-center gap-4">
            {bmi && <BmiGauge value={Number(bmi)} size={90} />}
            {summaryCounts.length > 0 && (
              <p className="text-xs text-surface-400 flex-1">
                {summaryCounts.join(' · ')}
              </p>
            )}
          </div>

          {/* Profile completeness */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-surface-500">
                {t('dashboard.profileComplete', {
                  filled: profileCompleteness.filled,
                  total: profileCompleteness.total,
                })}
              </span>
              <span className="text-xs text-surface-500">
                {profileCompleteness.percent}%
              </span>
            </div>
            <div className="w-full bg-surface-700 rounded-full h-1.5">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${profileCompleteness.percent}%` }}
              />
            </div>
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
