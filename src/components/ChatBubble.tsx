// HealthVault — Chat message bubble

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ChatBubble({
  role,
  content,
  timestamp,
}: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-surface-800 text-surface-100 rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        <p
          className={`text-[10px] mt-1 ${
            isUser ? 'text-primary-200' : 'text-surface-500'
          }`}
        >
          {new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
