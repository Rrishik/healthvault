// HealthVault — Community provider warning banner (shared)

import { useState } from 'react';
import { LS_KEYS } from '../constants';

export default function CommunityWarning() {
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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <p className="text-xs text-amber-300 leading-relaxed">
        <span className="font-semibold">Note:</span> The Community provider
        routes your queries through a private Azure OpenAI resource. Your
        conversations (including health context) are sent to this service for
        processing. No data is stored on the server.
      </p>
      <ul className="text-xs text-amber-400/80 list-disc list-inside space-y-0.5">
        <li>Rate limit: 10–20 requests per hour per IP</li>
        <li>Request size limit: 4 MB (including images)</li>
      </ul>
    </div>
  );
}
