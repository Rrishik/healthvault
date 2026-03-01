// HealthVault — Scanner page
// Supports: camera capture, file upload, manual text entry, and OCR

import { useState, useRef } from 'react';
import { useAIProvider } from '../hooks/useAIProvider';
import { extractIngredients } from '../services/ocr';
import VerdictCard from '../components/VerdictCard';
import type { FoodVerdict } from '../types';

type InputMode = 'manual' | 'upload' | 'camera';

/** Resize an image to fit within maxDim and compress as JPEG */
function compressImage(dataUrl: string, maxDim = 1024, quality = 0.7): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Failed to load image for compression'));
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
  const { analyzeFood, analyzeImage, loading, error } = useAIProvider();
  const [mode, setMode] = useState<InputMode>('manual');
  const [ingredients, setIngredients] = useState('');
  const [verdict, setVerdict] = useState<FoodVerdict | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleManualSubmit = async () => {
    if (!ingredients.trim()) return;
    const list = ingredients
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await analyzeFood(list);
    if (result) setVerdict(result);
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
      const result = await analyzeImage(base64, mimeType);
      if (result) {
        setVerdict(result);
        return;
      }

      // Fall back to OCR → text analysis
      setOcrLoading(true);
      try {
        const extracted = await extractIngredients(dataUrl);
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
    { mode: 'manual', label: 'Type', icon: '⌨️' },
    { mode: 'upload', label: 'Upload', icon: '📁' },
    { mode: 'camera', label: 'Camera', icon: '📷' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-surface-100">Food Scanner</h2>
      <p className="text-surface-400 text-sm">
        Enter ingredients or snap a photo of a food label to check safety.
      </p>

      {/* Mode selector */}
      <div className="flex gap-2">
        {modeButtons.map((m) => (
          <button
            key={m.mode}
            onClick={() => {
              setMode(m.mode);
              if (m.mode === 'upload') fileInputRef.current?.click();
              if (m.mode === 'camera') cameraInputRef.current?.click();
            }}
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
            placeholder="Enter ingredients separated by commas…&#10;e.g. sugar, citric acid, sodium benzoate"
            rows={4}
            className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 resize-none"
          />
          <button
            onClick={handleManualSubmit}
            disabled={loading || !ingredients.trim()}
            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Analyzing…' : 'Analyze Ingredients'}
          </button>
        </div>
      )}

      {/* Upload / camera prompt */}
      {(mode === 'upload' || mode === 'camera') && !loading && !ocrLoading && (
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
              ? 'Click to select a food label image'
              : 'Click to take a photo of a food label'}
          </p>
        </div>
      )}

      {/* Loading states */}
      {(loading || ocrLoading) && (
        <div className="text-center py-6">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-surface-400 text-sm mt-2">
            {ocrLoading ? 'Reading label text…' : 'Analyzing ingredients…'}
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
      {verdict && !loading && <VerdictCard verdict={verdict} />}
    </div>
  );
}
