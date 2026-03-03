// HealthVault — ScanContext
// Holds scan state at the app level so in-flight scans survive navigation.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useAppContext } from './AppContext';
import { assembleContext } from '../services/context-assembler';
import { addInteraction, addFoodScan } from '../services/db';
import { extractIngredients } from '../services/ocr';
import type {
  FoodAnalysisRequest,
  ImageAnalysisRequest,
} from '../adapters/types';
import type { FoodVerdict } from '../types';
import { IMAGE_MAX_DIM, IMAGE_QUALITY, LOG_PREFIX } from '../constants';

type InputMode = 'manual' | 'upload' | 'camera';

interface ScanState {
  mode: InputMode;
  ingredients: string;
  verdict: FoodVerdict | null;
  loading: boolean;
  ocrLoading: boolean;
  error: string | null;
  notFood: boolean;
}

interface ScanContextValue extends ScanState {
  setMode: (mode: InputMode) => void;
  setIngredients: (value: string) => void;
  submitManual: (ingredientList: string[]) => Promise<void>;
  submitImage: (file: File) => Promise<void>;
  reset: () => void;
}

const initialState: ScanState = {
  mode: 'manual',
  ingredients: '',
  verdict: null,
  loading: false,
  ocrLoading: false,
  error: null,
  notFood: false,
};

const ScanCtx = createContext<ScanContextValue | null>(null);

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

export function ScanProvider({ children }: { children: ReactNode }) {
  const { provider, settings } = useAppContext();

  const [mode, setMode] = useState<InputMode>(initialState.mode);
  const [ingredients, setIngredients] = useState(initialState.ingredients);
  const [verdict, setVerdict] = useState<FoodVerdict | null>(
    initialState.verdict,
  );
  const [loading, setLoading] = useState(initialState.loading);
  const [ocrLoading, setOcrLoading] = useState(initialState.ocrLoading);
  const [error, setError] = useState<string | null>(initialState.error);
  const [notFood, setNotFood] = useState(initialState.notFood);

  // Keep a ref to provider/settings so callbacks don't go stale
  const providerRef = useRef(provider);
  providerRef.current = provider;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const getConfig = useCallback((): Record<string, string> => {
    const p = providerRef.current;
    const s = settingsRef.current;
    if (!p || !s) return {};
    return s.providerConfigs[p.id] ?? {};
  }, []);

  const reset = useCallback(() => {
    setVerdict(null);
    setError(null);
    setNotFood(false);
    setOcrLoading(false);
    // Don't reset loading — an in-flight scan should keep showing
  }, []);

  const submitManual = useCallback(
    async (ingredientList: string[]) => {
      const p = providerRef.current;
      if (!p) {
        setError('No AI provider selected');
        return;
      }
      setLoading(true);
      setError(null);
      setVerdict(null);
      setNotFood(false);
      try {
        const context = await assembleContext();
        const request: FoodAnalysisRequest = {
          ingredients: ingredientList,
          context,
        };
        const config = getConfig();
        const result = await p.analyzeFood(request, config);

        await addInteraction({
          type: 'food-analysis',
          query: ingredientList.join(', '),
          response: JSON.stringify(result),
          context: JSON.stringify(context),
          providerId: p.id,
          model: config.model || '',
          timestamp: Date.now(),
        });

        await addFoodScan({
          ingredients: ingredientList,
          verdict: result,
          source: 'manual',
          providerId: p.id,
          timestamp: Date.now(),
        });

        setVerdict(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [getConfig],
  );

  const submitImage = useCallback(
    async (file: File) => {
      const p = providerRef.current;
      if (!p) {
        setError('No AI provider selected');
        return;
      }

      setNotFood(false);
      setVerdict(null);
      setError(null);

      // Read file as data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const { base64, mimeType } = await compressImage(dataUrl);

      // Try AI image analysis
      if (p.capabilities.imageAnalysis) {
        console.log(
          LOG_PREFIX,
          'Image scan: attempting direct AI image analysis',
        );
        setLoading(true);
        try {
          const context = await assembleContext();
          const request: ImageAnalysisRequest = {
            imageBase64: base64,
            mimeType,
            context,
          };
          const config = getConfig();
          const result = await p.analyzeImage(request, config);

          await addInteraction({
            type: 'image-analysis',
            query: '[image]',
            response: JSON.stringify(result),
            context: JSON.stringify(context),
            providerId: p.id,
            model: config.model || '',
            timestamp: Date.now(),
          });

          await addFoodScan({
            ingredients: result.details.map((d) => d.ingredient),
            verdict: result,
            source: 'upload',
            providerId: p.id,
            timestamp: Date.now(),
          });

          console.log(LOG_PREFIX, 'Image scan: AI image analysis succeeded');
          if (result.imageType === 'not_food') {
            console.log(LOG_PREFIX, 'Image scan: not a food item');
            setNotFood(true);
          } else {
            setVerdict(result);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          setError(msg);
        } finally {
          setLoading(false);
        }
        return;
      }

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
          // Reuse manual analysis path
          setOcrLoading(false);
          await submitManual(extracted);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
      } finally {
        setOcrLoading(false);
      }
    },
    [getConfig, submitManual],
  );

  return (
    <ScanCtx.Provider
      value={{
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
      }}
    >
      {children}
    </ScanCtx.Provider>
  );
}

export function useScanContext(): ScanContextValue {
  const ctx = useContext(ScanCtx);
  if (!ctx)
    throw new Error('useScanContext must be used within <ScanProvider>');
  return ctx;
}
