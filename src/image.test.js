import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGE_BYTES, validateImage, analyzeScreenshotText } from './image.js';

test('accepts supported screenshot image types within size limit', () => {
  assert.equal(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES }), '');
  assert.equal(validateImage({ type: 'image/jpeg', size: 512 }), '');
  assert.equal(validateImage({ type: 'image/webp', size: 512 }), '');
});

test('rejects unsupported and oversized screenshot files', () => {
  assert.match(validateImage({ type: 'image/gif', size: 12 }), /PNG, JPEG, or WebP/);
  assert.match(validateImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }), /5 MB/);
  assert.match(validateImage(null), /PNG, JPEG, or WebP/);
});

test('OCR output uses the same scam rules and labels image-derived text', () => {
  const result = analyzeScreenshotText('Your bank account is blocked. Share your OTP now.', 82.46);
  assert.equal(result.type, 'image-text');
  assert.equal(result.imageOcrConfidence, 82.5);
  assert.ok(result.signals.some((signal) => signal.id === 'credentials'));
  assert.match(result.summary, /OCR extracted text/);
  assert.ok(result.recommendations.some((recommendation) => /OCR can misread/.test(recommendation)));
  assert.equal(Object.hasOwn(result, 'file'), false);
});

test('empty or excessive OCR output returns an actionable error', () => {
  assert.match(analyzeScreenshotText('  ').error, /No readable text/);
  assert.match(analyzeScreenshotText('x'.repeat(10001)).error, /too long to scan/);
});
