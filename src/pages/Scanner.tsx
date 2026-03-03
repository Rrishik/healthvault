// HealthVault — Scanner page
// Supports: camera capture, file upload, manual text entry, and OCR
// Scan state lives in ScanContext so in-flight scans survive navigation.

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { useScanContext } from '../context/ScanContext';
import { assembleContext } from '../services/context-assembler';
import { buildFoodAnalysisPrompt } from '../prompts/food-analysis';
import VerdictCard from '../components/VerdictCard';
import PromptPreviewModal from '../components/PromptPreviewModal';
import { startNewConversation, saveConversation } from '../services/db';

export default function Scanner() {
  const { t } = useTranslation();
  const { settings, provider } = useAppContext();
  const {
    mode,
    ingredients,
    verdict,
    loading,
    ocrLoading,
    error,
    notFood,
    setMode,
    setIngredients,
    submitManual,
    submitImage,
    reset,
  } = useScanContext();
  const navigate = useNavigate();
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const pendingSendRef = useRef<(() => Promise<void>) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleManualSubmit = async () => {
    if (!ingredients.trim()) return;
    const list = ingredients
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (settings?.showPromptBeforeSending) {
      const context = await assembleContext();
      const preview = buildFoodAnalysisPrompt({ ingredients: list, context })
        .replace(/Respond with a JSON object[\s\S]*$/, '')
        .trimEnd();
      pendingSendRef.current = () => submitManual(list);
      setPromptPreview(preview);
    } else {
      await submitManual(list);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      reset();
      submitImage(file);
    }
  };

  const modeButtons = [
    { mode: 'manual' as const, label: t('scanner.type'), icon: '⌨️' },
    { mode: 'upload' as const, label: t('scanner.upload'), icon: '📁' },
    { mode: 'camera' as const, label: t('scanner.camera'), icon: '📷' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-surface-100">
        {t('scanner.title')}
      </h2>
      <p className="text-surface-400 text-sm">{t('scanner.subtitle')}</p>

      {/* Mode selector */}
      <div className="flex gap-2">
        {modeButtons.map((m) => (
          <button
            key={m.mode}
            onClick={() => setMode(m.mode)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-colors ${
              mode === m.mode
                ? 'bg-primary-600 text-white'
                : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
            }`}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Manual input */}
      {mode === 'manual' && (
        <div className="space-y-3">
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={t('scanner.placeholder')}
            rows={4}
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 resize-none"
          />
          <button
            onClick={handleManualSubmit}
            disabled={loading || !ingredients.trim()}
            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? t('scanner.analyzing') : t('scanner.analyze')}
          </button>
        </div>
      )}

      {/* Upload / camera prompt */}
      {(mode === 'upload' || mode === 'camera') && !loading && !ocrLoading && (
        <>
          {!provider?.capabilities.imageAnalysis && (
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg p-3">
              <p className="text-sm text-yellow-300">
                {t('scanner.imageWarning', { name: provider?.name ?? 'none' })}
              </p>
            </div>
          )}
          <div
            onClick={() =>
              mode === 'upload'
                ? fileInputRef.current?.click()
                : cameraInputRef.current?.click()
            }
            className="border-2 border-dashed border-surface-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 transition-colors"
          >
            <p className="text-surface-400 text-sm">
              {mode === 'upload'
                ? t('scanner.clickUpload')
                : t('scanner.clickCamera')}
            </p>
          </div>
        </>
      )}

      {/* Loading states */}
      {(loading || ocrLoading) && (
        <div className="text-center py-6">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-surface-400 text-sm mt-2">
            {ocrLoading
              ? t('scanner.readingLabel')
              : t('scanner.analyzingIngredients')}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Not-food warning */}
      {notFood && !loading && (
        <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-200">
            {t('scanner.notFoodTitle')}
          </p>
          <p className="text-sm text-yellow-300/80">
            {t('scanner.notFoodDesc')}
          </p>
        </div>
      )}

      {/* Result */}
      {verdict && !loading && !notFood && (
        <>
          <VerdictCard
            verdict={verdict}
            showNutritionDV={mode === 'manual' || verdict.imageType === 'label'}
          />
          <button
            onClick={async () => {
              const conv = await startNewConversation();
              const now = Date.now();
              const ingredientList = ingredients.trim() || 'scanned food label';
              conv.title = `Scan: ${ingredientList}`.slice(0, 60);
              conv.messages = [
                {
                  role: 'user',
                  content: `Are these ingredients safe for me? ${ingredientList}`,
                  timestamp: now,
                },
                {
                  role: 'assistant',
                  content: verdict.summary,
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
        </>
      )}

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
