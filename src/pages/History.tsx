// HealthVault — History page

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getRecentScans,
  getRecentConversationSummaries,
  startNewConversation,
  saveConversation,
} from '../services/db';
import type { FoodScanRecord, ConversationSummary } from '../types';
import VerdictCard from '../components/VerdictCard';
import { verdictEmoji } from '../constants';

type Tab = 'scans' | 'chats';

export default function History() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('scans');
  const [scans, setScans] = useState<FoodScanRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [expandedScan, setExpandedScan] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getRecentScans(50), getRecentConversationSummaries(50)]).then(
      ([s, c]) => {
        setScans(s);
        setConversations(c);
      },
    );
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-surface-100">
        {t('history.title')}
      </h2>

      {/* Tab selector */}
      <div className="flex gap-1 bg-surface-800 rounded-lg p-1">
        <button
          onClick={() => setTab('scans')}
          className={`flex-1 py-2 rounded-md text-sm transition-colors ${
            tab === 'scans'
              ? 'bg-surface-700 text-surface-100'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          {t('history.scans', { count: scans.length })}
        </button>
        <button
          onClick={() => setTab('chats')}
          className={`flex-1 py-2 rounded-md text-sm transition-colors ${
            tab === 'chats'
              ? 'bg-surface-700 text-surface-100'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          {t('history.chats', { count: conversations.length })}
        </button>
      </div>

      {/* Scans tab */}
      {tab === 'scans' && (
        <div className="space-y-3">
          {scans.length === 0 && (
            <p className="text-center text-surface-400 text-sm py-8">
              {t('history.noScans')}
            </p>
          )}
          {scans.map((scan) => (
            <div key={scan.id}>
              <button
                onClick={() =>
                  setExpandedScan(
                    expandedScan === scan.id ? null : (scan.id ?? null),
                  )
                }
                className="w-full bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3 hover:bg-surface-700/50 transition-colors text-left"
              >
                <span className="text-lg">
                  {verdictEmoji[scan.verdict.overall]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200 truncate">
                    {scan.ingredients.join(', ')}
                  </p>
                  <p className="text-xs text-surface-500">
                    {new Date(scan.timestamp).toLocaleString()} · {scan.source}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-surface-500 transition-transform ${expandedScan === scan.id ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {expandedScan === scan.id && (
                <div className="mt-2 space-y-2">
                  <VerdictCard
                    verdict={scan.verdict}
                    showNutritionDV={
                      scan.source === 'manual' ||
                      scan.source === 'ocr' ||
                      scan.verdict.imageType === 'label'
                    }
                  />
                  <button
                    onClick={async () => {
                      const conv = await startNewConversation();
                      const now = Date.now();
                      const ingredientList =
                        scan.ingredients.join(', ') || 'scanned food label';
                      conv.title = `Scan: ${ingredientList}`.slice(0, 60);
                      conv.messages = [
                        {
                          role: 'user',
                          content: `Are these ingredients safe for me? ${ingredientList}`,
                          timestamp: now,
                        },
                        {
                          role: 'assistant',
                          content: scan.verdict.summary,
                          timestamp: now + 1,
                        },
                      ];
                      conv.messageCount = 2;
                      await saveConversation(conv);
                      navigate(`/chat?conv=${conv.id}`);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm bg-surface-800 hover:bg-surface-700 border border-surface-700 text-surface-200 transition-colors"
                  >
                    {t('scanner.chatAboutThis')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chats tab */}
      {tab === 'chats' && (
        <div className="space-y-3">
          {conversations.length === 0 && (
            <p className="text-center text-surface-400 text-sm py-8">
              {t('history.noChats')}
            </p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="bg-surface-800 border border-surface-700 rounded-lg p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-200 truncate">
                  {conv.title}
                </p>
                <p className="text-xs text-surface-500">
                  {new Date(conv.updatedAt).toLocaleString()} ·{' '}
                  {t('history.messageCount', { count: conv.messageCount })}
                </p>
              </div>
              <Link
                to={`/chat?conv=${conv.id}`}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
              >
                {t('history.resume')}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
