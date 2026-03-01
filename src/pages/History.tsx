// HealthVault — History page

import { useEffect, useState } from 'react';
import { getRecentInteractions, getRecentScans } from '../services/db';
import type { InteractionLog, FoodScanRecord } from '../types';
import VerdictCard from '../components/VerdictCard';
import { verdictEmoji } from '../constants';

type Tab = 'scans' | 'queries';

export default function History() {
  const [tab, setTab] = useState<Tab>('scans');
  const [scans, setScans] = useState<FoodScanRecord[]>([]);
  const [queries, setQueries] = useState<InteractionLog[]>([]);
  const [expandedScan, setExpandedScan] = useState<number | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getRecentScans(50), getRecentInteractions(50)]).then(
      ([s, q]) => {
        setScans(s);
        setQueries(q.filter((i) => i.type === 'health-query'));
      },
    );
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-surface-100">History</h2>

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
          Food Scans ({scans.length})
        </button>
        <button
          onClick={() => setTab('queries')}
          className={`flex-1 py-2 rounded-md text-sm transition-colors ${
            tab === 'queries'
              ? 'bg-surface-700 text-surface-100'
              : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Questions ({queries.length})
        </button>
      </div>

      {/* Scans tab */}
      {tab === 'scans' && (
        <div className="space-y-3">
          {scans.length === 0 && (
            <p className="text-center text-surface-400 text-sm py-8">
              No food scans yet.
            </p>
          )}
          {scans.map((scan) => (
            <div key={scan.id}>
              <button
                onClick={() =>
                  setExpandedScan(expandedScan === scan.id ? null : (scan.id ?? null))
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedScan === scan.id && (
                <div className="mt-2">
                  <VerdictCard verdict={scan.verdict} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Queries tab */}
      {tab === 'queries' && (
        <div className="space-y-3">
          {queries.length === 0 && (
            <p className="text-center text-surface-400 text-sm py-8">
              No health questions yet.
            </p>
          )}
          {queries.map((q) => {
            let parsedAnswer = '';
            try {
              const parsed = JSON.parse(q.response);
              parsedAnswer = parsed.answer ?? q.response;
            } catch {
              parsedAnswer = q.response;
            }
            return (
              <div key={q.id}>
                <button
                  onClick={() =>
                    setExpandedQuery(expandedQuery === q.id ? null : (q.id ?? null))
                  }
                  className="w-full bg-surface-800 border border-surface-700 rounded-lg p-3 hover:bg-surface-700/50 transition-colors text-left"
                >
                  <p className="text-sm text-surface-200 truncate">{q.query}</p>
                  <p className="text-xs text-surface-500">
                    {new Date(q.timestamp).toLocaleString()} · {q.providerId}
                  </p>
                </button>
                {expandedQuery === q.id && (
                  <div className="mt-2 bg-surface-800/50 border border-surface-700 rounded-lg p-3">
                    <p className="text-sm text-surface-300 whitespace-pre-wrap">
                      {parsedAnswer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
