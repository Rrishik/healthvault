// HealthVault — Dashboard page

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getRecentScans, getRecentInteractions } from '../services/db';
import type { FoodScanRecord, InteractionLog } from '../types';
import { verdictEmoji, DISPLAY_ITEMS_COUNT } from '../constants';

export default function Dashboard() {
  const { profile, provider } = useAppContext();
  const [recentScans, setRecentScans] = useState<FoodScanRecord[]>([]);
  const [recentChats, setRecentChats] = useState<InteractionLog[]>([]);

  useEffect(() => {
    const loadData = () => {
      Promise.all([getRecentScans(5), getRecentInteractions(5)]).then(
        ([scans, chats]) => {
          setRecentScans(scans);
          setRecentChats(chats.filter((c) => c.type === 'health-query'));
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
          Welcome back{profile?.ageRange ? '' : ''}
        </h2>
        <p className="text-surface-400 text-sm mt-1">
          {provider
            ? `Connected to ${provider.name}`
            : 'No AI provider configured — '}
          {!provider && (
            <Link to="/settings" className="text-primary-400 hover:underline">
              set one up
            </Link>
          )}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/scanner"
          className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl p-4 transition-colors"
        >
          <div className="text-2xl mb-2">📷</div>
          <h3 className="text-sm font-medium text-surface-100">Scan Food</h3>
          <p className="text-xs text-surface-400 mt-0.5">
            Check ingredients safety
          </p>
        </Link>
        <Link
          to="/chat"
          className="bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-xl p-4 transition-colors"
        >
          <div className="text-2xl mb-2">💬</div>
          <h3 className="text-sm font-medium text-surface-100">
            Health Chat
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            Ask health questions
          </p>
        </Link>
      </div>

      {/* Profile summary */}
      {profile && (
        <div className="bg-surface-800 border border-surface-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-100">
              Your Profile
            </h3>
            <Link
              to="/settings"
              className="text-xs text-primary-400 hover:underline"
            >
              Edit
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {profile.conditions.length > 0 && (
              <div>
                <span className="text-surface-500">Conditions: </span>
                <span className="text-surface-300">
                  {profile.conditions.join(', ')}
                </span>
              </div>
            )}
            {profile.allergies.length > 0 && (
              <div>
                <span className="text-surface-500">Allergies: </span>
                <span className="text-surface-300">
                  {profile.allergies.join(', ')}
                </span>
              </div>
            )}
            {profile.medications.length > 0 && (
              <div>
                <span className="text-surface-500">Medications: </span>
                <span className="text-surface-300">
                  {profile.medications.join(', ')}
                </span>
              </div>
            )}
            {profile.dietaryPreferences.length > 0 && (
              <div>
                <span className="text-surface-500">Diet: </span>
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
              Recent Scans
            </h3>
            <Link
              to="/history"
              className="text-xs text-primary-400 hover:underline"
            >
              View all
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

      {/* Recent chats */}
      {recentChats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-surface-100">
              Recent Questions
            </h3>
            <Link
              to="/history"
              className="text-xs text-primary-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentChats.slice(0, DISPLAY_ITEMS_COUNT).map((chat) => (
              <div
                key={chat.id}
                className="bg-surface-800 border border-surface-700 rounded-lg p-3"
              >
                <p className="text-sm text-surface-200 truncate">
                  {chat.query}
                </p>
                <p className="text-xs text-surface-500">
                  {new Date(chat.timestamp).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {recentScans.length === 0 && recentChats.length === 0 && (
        <div className="text-center py-8">
          <p className="text-surface-400 text-sm">
            No activity yet. Try scanning a food label or asking a health
            question!
          </p>
        </div>
      )}
    </div>
  );
}
