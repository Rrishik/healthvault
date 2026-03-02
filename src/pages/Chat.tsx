// HealthVault — Chat page (conversational health Q&A)

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAIProvider } from '../hooks/useAIProvider';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { useAppContext } from '../context/AppContext';
import { pickRandomStarters } from '../services/starters';
import ChatBubble from '../components/ChatBubble';
import ProfileUpdatePrompt from '../components/ProfileUpdatePrompt';
import type { Message } from '../types';
import type { HealthQueryResponse } from '../adapters/types';

function buildStarters(profile?: { conditions?: string[]; allergies?: string[]; medications?: string[]; dietaryPreferences?: string[] } | null): string[] {
  const starters: string[] = [];

  if (profile?.medications?.length) {
    const med = profile.medications[0];
    starters.push(`Any food interactions with ${med}?`);
  }
  if (profile?.allergies?.length) {
    const allergy = profile.allergies[0];
    starters.push(`What ingredients should I watch out for with my ${allergy} allergy?`);
  }
  if (profile?.conditions?.length) {
    const condition = profile.conditions[0];
    starters.push(`What foods help with ${condition}?`);
  }
  if (profile?.dietaryPreferences?.length) {
    const pref = profile.dietaryPreferences[0];
    starters.push(`Good ${pref} meal ideas for me?`);
  }

  // Fill remaining slots with generic starters
  const fallbacks = [
    'Is ibuprofen safe for me?',
    'What foods help lower cholesterol?',
    'Can I eat dairy with my condition?',
  ];
  for (const f of fallbacks) {
    if (starters.length >= 3) break;
    if (!starters.includes(f)) starters.push(f);
  }

  return starters.slice(0, 3);
}

export default function Chat() {
  const { askHealthQuery, loading, error } = useAIProvider();
  const { addToList } = useHealthProfile();
  const { profile, settings } = useAppContext();

  // Use AI-generated starters if available, otherwise fall back to profile-based ones
  const starters = useMemo(() => {
    if (settings?.chatStarters && settings.chatStarters.length > 0) {
      return pickRandomStarters(settings.chatStarters, 3);
    }
    return buildStarters(profile);
  }, [settings?.chatStarters, profile]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState<HealthQueryResponse['suggestedProfileUpdates'] | null>(null);
  const [updateExplanation, setUpdateExplanation] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await askHealthQuery(query, history);
    if (response) {
      const assistantMsg: Message = {
        role: 'assistant',
        content: response.answer,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Check for profile update suggestions
      if (response.suggestedProfileUpdates) {
        const u = response.suggestedProfileUpdates;
        const hasAny =
          (u.conditions?.length ?? 0) > 0 ||
          (u.allergies?.length ?? 0) > 0 ||
          (u.medications?.length ?? 0) > 0;
        if (hasAny) {
          setPendingUpdate(u);
          setUpdateExplanation(
            'Based on your conversation, new health information was detected.',
          );
        }
      }
    }
  };

  const handleAcceptUpdate = async () => {
    if (!pendingUpdate) return;
    for (const c of pendingUpdate.conditions ?? []) await addToList('conditions', c);
    for (const a of pendingUpdate.allergies ?? []) await addToList('allergies', a);
    for (const m of pendingUpdate.medications ?? []) await addToList('medications', m);
    setPendingUpdate(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h2 className="text-xl font-bold text-surface-100 mb-4">Health Chat</h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-1 pb-2">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-surface-400 text-sm">
              Ask any health-related question. Your profile will be used for
              personalized answers.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {starters.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="bg-surface-800 text-surface-300 text-xs px-3 py-1.5 rounded-full hover:bg-surface-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} {...msg} />
        ))}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-surface-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-surface-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-surface-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-surface-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Profile update prompt */}
        {pendingUpdate && (
          <ProfileUpdatePrompt
            updates={pendingUpdate}
            explanation={updateExplanation}
            onAccept={handleAcceptUpdate}
            onDismiss={() => setPendingUpdate(null)}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-2 mb-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-surface-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a health question…"
          className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
