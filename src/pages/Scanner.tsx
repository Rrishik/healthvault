// HealthVault — Scanner page
// Supports: camera capture, file upload, manual text entry, and OCR

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAIProvider } from '../hooks/useAIProvider';
import { useAppContext } from '../context/AppContext';
import { assembleContext } from '../services/context-assembler';
import { buildFoodAnalysisPrompt } from '../prompts/food-analysis';
import { extractIngredients } from '../services/ocr';
import VerdictCard from '../components/VerdictCard';
import PromptPreviewModal from '../components/PromptPreviewModal';
import { startNewConversation, saveConversation } from '../services/db';
import type { FoodVerdict } from '../types';
import { IMAGE_MAX_DIM, IMAGE_QUALITY, LOG_PREFIX } from '../constants';

type InputMode = 'manual' | 'upload' | 'camera';

/** Resize an image to fit within maxDim and compress as JPEG */
function compressImage(
  dataUrl: string,
  maxDim = IMAGE_MAX_DIM,
  quality = IMAGE_QUALITY,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () =>
      reject(new Error('Failed to load image for compression'));
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      const base64 = compressed.split(',')[1];
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.src = dataUrl;
  });
}

export default function Scanner() {
  const { t } = useTranslation();
  const { analyzeFood, analyzeImage, loading, error, provider } =
    useAIProvider();
  const { settings } = useAppContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<InputMode>('manual');
  const [ingredients, setIngredients] = useState('');
  const [verdict, setVerdict] = useState<FoodVerdict | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const pendingSendRef = useRef<(() => Promise<void>) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const executeManualSubmit = async (list: string[]) => {
    const result = await analyzeFood(list);
    if (result) setVerdict(result);
  };

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
      pendingSendRef.current = () => executeManualSubmit(list);
      setPromptPreview(preview);
    } else {
      await executeManualSubmit(list);
    }
  };

  const handleFile = async (file: File) => {
    // Try AI vision if supported, otherwise fall back to OCR
    const reader = new FileReader();
    reader.onerror = () => {
      // Surface file read failures to the user
      console.error('FileReader error', reader.error);
    };
    reader.onload = async () => {
      const dataUrl = reader.result as string;

      // Compress to keep within proxy limits
      const { base64, mimeType } = await compressImage(dataUrl);

      // Try image analysis first
      console.log(
        LOG_PREFIX,
        'Image scan: attempting direct AI image analysis',
      );
      const result = await analyzeImage(base64, mimeType);
      if (result) {
        console.log(LOG_PREFIX, 'Image scan: AI image analysis succeeded');
        setVerdict(result);
        return;
      }

      // analyzeImage returned null — if the provider supports image analysis,
      // that means it failed (error already shown in UI), so don't retry via OCR.
      // Only fall back to OCR when image analysis isn't available at all.
      if (provider?.capabilities.imageAnalysis) return;

      // Fall back to OCR → text analysis
      console.log(
        LOG_PREFIX,
        'Image scan: falling back to OCR (provider does not support image analysis)',
      );
      setOcrLoading(true);
      try {
        const extracted = await extractIngredients(dataUrl);
        console.log(LOG_PREFIX, 'OCR extracted ingredients:', extracted);
        if (extracted.length > 0) {
          setIngredients(extracted.join(', '));
          const ocrResult = await analyzeFood(extracted);
          if (ocrResult) setVerdict(ocrResult);
        }
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const modeButtons: { mode: InputMode; label: string; icon: string }[] = [
    { mode: 'manual', label: t('scanner.type'), icon: '⌨️' },
    { mode: 'upload', label: t('scanner.upload'), icon: '📁' },
    { mode: 'camera', label: t('scanner.camera'), icon: '📷' },
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

      {/* Result */}
      {verdict && !loading && (
        <>
          <VerdictCard verdict={verdict} />
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
