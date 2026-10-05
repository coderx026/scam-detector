import { analyzeContent } from './detector.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function validateImage(file) {
  if (!file || !SUPPORTED_IMAGE_TYPES.has(file.type)) return 'Choose a PNG, JPEG, or WebP screenshot.';
  if (file.size > MAX_IMAGE_BYTES) return 'Image exceeds the 5 MB limit. Resize it and try again.';
  return '';
}

export function analyzeScreenshotText(text, confidence = 0) {
  const recognizedText = String(text ?? '').trim();
  if (!recognizedText) return { error: 'No readable text was found. Try a clearer screenshot or paste its text manually.' };
  if (recognizedText.length > 10000) return { error: 'The extracted text is too long to scan safely. Use a cropped screenshot with less text.' };
  const result = analyzeContent(recognizedText, 'sms');
  if (result.error) return result;
  const imageOcrConfidence = Math.round(Math.max(0, Math.min(100, Number(confidence) || 0)) * 10) / 10;
  return {
    ...result,
    type: 'image-text',
    imageOcrConfidence,
    summary: `OCR extracted text from a screenshot (recognition confidence ${imageOcrConfidence}%). ${result.summary} Verify the extracted text; OCR may misread characters.`,
    recommendations: [...new Set(['Review the extracted text carefully; OCR can misread numbers and URLs.', ...result.recommendations])],
  };
}
