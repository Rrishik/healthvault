// HealthVault — Chat page (conversational health Q&A)

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAIProvider } from '../hooks/useAIProvider';
import { useHealthProfile } from '../hooks/useHealthProfile';
import { useAppContext } from '../context/AppContext';
import { pickRandomStarters } from '../services/starters';
import { getActiveConversation, getConversationById, saveConversation, startNewConversation } from '../services/db';
import { assembleContext } from '../services/context-assembler';
import { buildHealthQueryPrompt } from '../prompts/health-query';
import ChatBubble from '../components/ChatBubble';
import ProfileUpdatePrompt from '../components/ProfileUpdatePrompt';
import PromptPreviewModal from '../components/PromptPreviewModal';
import type { Message, Conversation } from '../types';
import type { HealthQueryResponse } from '../adapters/types';
import {
  DEFAULT_CHAT_TITLE,
  CHAT_TITLE_MAX_LENGTH,
  DISPLAY_ITEMS_COUNT,
  NEW_CHAT_TIP_THRESHOLD,
  NEW_CHAT_PULSE_THRESHOLD,
  LS_KEYS,
} from '../constants';

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
    if (starters.length >= DISPLAY_ITEMS_COUNT) break;
    if (!starters.includes(f)) starters.push(f);
  }

  return starters.slice(0, DISPLAY_ITEMS_COUNT);
}

export default function Chat() {
  const { askHealthQuery, loading, error } = useAIProvider();
  const { addToList } = useHealthProfile();
  const { profile, settings } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use AI-generated starters if available, otherwise fall back to profile-based ones
  const starters = useMemo(() => {
    if (settings?.chatStarters && settings.chatStarters.length > 0) {
      return pickRandomStarters(settings.chatStarters, DISPLAY_ITEMS_COUNT);
    }
    return buildStarters(profile);
  }, [settings?.chatStarters, profile]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState<HealthQueryResponse['suggestedProfileUpdates'] | null>(null);
  const [updateExplanation, setUpdateExplanation] = useState('');
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const pendingSendRef = useRef<(() => Promise<void>) | null>(null);
  const [tipDismissed, setTipDismissed] = useState(
    () => localStorage.getItem(LS_KEYS.NEW_CHAT_TIP_DISMISSED) === '1',
  );

  const dismissTip = useCallback(() => {
    setTipDismissed(true);
    localStorage.setItem(LS_KEYS.NEW_CHAT_TIP_DISMISSED, '1');
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<Conversation | null>(null);

  // Load a specific conversation (from URL param) or the most recent
  useEffect(() => {
    const convId = searchParams.get('conv');
    const isNew = searchParams.get('new');
    if (isNew) {
      // Start fresh — don't load any previous conversation
      activeConvRef.current = null;
      setMessages([]);
      setSearchParams({}, { replace: true });
    } else if (convId) {
      getConversationById(Number(convId)).then((conv) => {
        if (conv) {
          activeConvRef.current = conv;
          setMessages(conv.messages);
        }
      });
      // Clear the search param so subsequent new-chats don't reload it
      setSearchParams({}, { replace: true });
    } else {
      getActiveConversation().then((conv) => {
        if (conv && conv.messages.length > 0) {
          activeConvRef.current = conv;
          setMessages(conv.messages);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist conversation to IndexedDB
  const persistMessages = useCallback(async (msgs: Message[]) => {
    const conv = activeConvRef.current;
    if (conv) {
      conv.messages = msgs;
      await saveConversation(conv);
    } else {
      // First message — create a new conversation
      const title = msgs[0]?.content.slice(0, CHAT_TITLE_MAX_LENGTH) || DEFAULT_CHAT_TITLE;
      const newConv = await startNewConversation();
      newConv.title = title;
      newConv.messages = msgs;
      await saveConversation(newConv);
      activeConvRef.current = newConv;
    }
  }, []);

  const handleNewChat = useCallback(() => {
    activeConvRef.current = null;
    setMessages([]);
    setInput('');
    setPendingUpdate(null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const executeSend = async (query: string) => {
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
      const updatedMessages = [...messages, userMsg, assistantMsg];
      setMessages(updatedMessages);
      await persistMessages(updatedMessages);

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

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    if (settings?.showPromptBeforeSending) {
      // Build prompt preview without sending
      const context = await assembleContext();
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const preview = buildHealthQueryPrompt({
        query,
        conversationHistory: history,
        context,
      }).replace(/Respond with a JSON object[\s\S]*$/, '').trimEnd();
      pendingSendRef.current = () => executeSend(query);
      setPromptPreview(preview);
    } else {
      await executeSend(query);
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
        {messages.length > 0 && (
          <div className="relative shrink-0">
            {/* Coachmark tooltip anchored to + button */}
            {messages.length >= NEW_CHAT_TIP_THRESHOLD && !tipDismissed && (
              <div className="absolute bottom-full left-0 mb-2 z-10 animate-fade-in">
                <div className="relative bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 shadow-lg w-56">
                  <button
                    onClick={dismissTip}
                    className="absolute top-1 right-1 text-surface-500 hover:text-surface-300"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="text-xs text-surface-300 pr-3">
                    💡 Start a new chat for unrelated questions — keeps answers faster & more accurate.
                  </p>
                  {/* Arrow pointing down at the + button */}
                  <div className="absolute top-full left-5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-surface-600" />
                </div>
              </div>
            )}
            <button
              onClick={handleNewChat}
              title="Start a new conversation"
              className={`flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-white px-3 py-2.5 rounded-lg transition-colors${
                messages.length >= NEW_CHAT_PULSE_THRESHOLD ? ' animate-pulse' : ''
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        )}
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

      {/* Prompt preview modal */}
      {promptPreview && (
        <PromptPreviewModal
          prompt={promptPreview}
          onConfirm={() => {
            setPromptPreview(null);
            pendingSendRef.current?.();
            pendingSendRef.current = null;
          }}
          onCancel={() => {
            setPromptPreview(null);
            pendingSendRef.current = null;
          }}
        />
      )}
    </div>
  );
}
