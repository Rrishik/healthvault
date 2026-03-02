// HealthVault — Prompt preview modal
// Shows the full prompt that will be sent to the AI provider.

import { useEffect, useRef } from 'react';

interface PromptPreviewModalProps {
  prompt: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PromptPreviewModal({
  prompt,
  onConfirm,
  onCancel,
}: PromptPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) onCancel();
  };

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="text-sm font-semibold text-surface-100">
            Prompt Preview
          </h3>
          <button
            onClick={onCancel}
            className="text-surface-500 hover:text-surface-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Prompt content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <pre className="text-xs text-surface-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
            {prompt}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-surface-700">
          <button
            onClick={onCancel}
            className="flex-1 bg-surface-800 hover:bg-surface-700 text-surface-300 py-2 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-primary-600 hover:bg-primary-500 text-white py-2 rounded-lg text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
