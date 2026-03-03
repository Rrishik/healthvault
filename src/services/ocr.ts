// HealthVault — Tesseract.js OCR wrapper
// Provides offline text extraction from food label images.

import Tesseract from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Run Tesseract OCR on an image and return extracted text.
 * Works entirely in the browser (no server required).
 *
 * @param image - An HTMLImageElement, canvas, Blob, data URL, or image URL
 */
export async function extractText(
  image: Tesseract.ImageLike,
): Promise<OcrResult> {
  const {
    data: { text, confidence },
  } = await Tesseract.recognize(image, 'eng', {
    logger: () => {}, // silence progress logs
  });

  return {
    text: text.trim(),
    confidence,
  };
}

/**
 * Extract text from an image and split into likely ingredient names.
 * Applies basic cleanup: removes numbering, percentage values, etc.
 */
export async function extractIngredients(
  image: Tesseract.ImageLike,
): Promise<string[]> {
  const { text } = await extractText(image);
  if (!text) return [];

  return text
    .split(/[,\n;]+/)
    .map((s) =>
      s
        .replace(/\d+(\.\d+)?%/g, '') // remove percentages
        .replace(/^\d+\.\s*/, '') // remove numbering like "1. "
        .replace(/[()[\]]/g, '') // remove brackets
        .trim(),
    )
    .filter((s) => s.length > 1);
}
