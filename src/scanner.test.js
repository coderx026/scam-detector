import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeContent } from './detector.js';

test('empty input is rejected', () => {
  assert.ok(analyzeContent('  ', 'sms').error);
});

test('suspicious SMS reports bounded score and evidence', () => {
  const result = analyzeContent('Your bank account is blocked. Share OTP now to claim ₹5000 reward: http://paypa1.xyz/login', 'sms');
  assert.equal(result.type, 'sms');
  assert.ok(result.score >= 61 && result.score <= 100);
  assert.ok(result.signals.length >= 3);
  assert.ok(result.evidence.length > 0);
  assert.match(result.verdict, /scam/i);
});

test('valid URL gets analyzed without fetching it', () => {
  const result = analyzeContent('http://amaz0n-support.xyz/verify', 'link');
  assert.equal(result.error, undefined);
  assert.ok(result.signals.some((signal) => signal.id === 'http'));
  assert.ok(result.score <= 100);
});

test('malformed or multi-token URL is rejected', () => {
  assert.ok(analyzeContent('not a url', 'link').error);
  assert.ok(analyzeContent('javascript:alert(1)', 'link').error);
});

test('benign content is not guaranteed safe', () => {
  const result = analyzeContent('Hello, are we still meeting for lunch tomorrow?', 'sms');
  assert.equal(result.score, 0);
  assert.match(result.summary, /not proof|may not be detected/i);
});

test('electricity disconnection threat with bill issue scores high', () => {
  const result = analyzeContent('Dear Consumer, Your Electricity power will be disconnected tonight at 9:30 PM from electricity office because your previous month bill was not updated. Please immediately contact our electricity officer Mr. Verma at 98765XXXXX. Thank you.', 'sms');
  assert.ok(result.score >= 61, `Expected score >= 61, got ${result.score}`);
  assert.ok(result.signals.some((s) => s.id === 'disconnection'), 'Should detect disconnection threat');
  assert.ok(result.signals.some((s) => s.id === 'bill-arrears'), 'Should detect bill issue');
  assert.ok(result.signals.some((s) => s.id === 'utility-impersonation'), 'Should detect utility impersonation');
  assert.match(result.verdict, /scam|caution/i);
});

test('benign utility bill notice scores low', () => {
  const result = analyzeContent('Your monthly bill is ready. Payment is due by the 15th. You can pay online or call 1800-123-4567 (official number from your bill). Thank you!', 'sms');
  assert.ok(result.score <= 30, `Expected score <= 30, got ${result.score}`);
});

test('delivery and toll payment lures receive multiple explainable signals', () => {
  const result = analyzeContent('Your parcel is on hold. Pay a small fee now to release delivery: https://parcel-release.click/pay', 'sms');
  assert.ok(result.score >= 31);
  assert.ok(result.signals.some((signal) => signal.id === 'delivery-toll'));
  assert.ok(result.signals.some((signal) => signal.id === 'payment-lure'));
  assert.ok(result.urls.includes('https://parcel-release.click/pay'));
});

test('remote access and verification-code scams are flagged', () => {
  const result = analyzeContent('Your bank account is blocked. Install AnyDesk and share the OTP with our support agent immediately.', 'sms');
  assert.ok(result.score >= 61);
  assert.ok(result.signals.some((signal) => signal.id === 'remote-access'));
  assert.ok(result.signals.some((signal) => signal.id === 'credentials'));
  assert.ok(result.evidence.every((item) => item.text.length > 0));
});

test('easy-income task offer with upfront fee is suspicious', () => {
  const result = analyzeContent('Part-time online job: like videos to earn daily income. Pay registration fee to unlock tasks.', 'sms');
  assert.ok(result.signals.some((signal) => signal.id === 'job-task-scam'));
  assert.ok(result.signals.some((signal) => signal.id === 'payment-lure'));
});

test('bare domain in an SMS is extracted and checked without fetching', () => {
  const result = analyzeContent('Your bank KYC is blocked. Verify your account at paypa1.xyz/login immediately.', 'sms');
  assert.ok(result.urls.includes('paypa1.xyz/login'));
  assert.ok(result.signals.some((signal) => signal.id === 'lookalike'));
  assert.ok(result.signals.some((signal) => signal.id === 'odd-tld'));
});

test('ordinary meeting text does not become a bare URL', () => {
  const result = analyzeContent('Meet me at 5, bring snacks and a notebook.', 'sms');
  assert.deepEqual(result.urls, []);
  assert.equal(result.score, 0);
});

test('heuristic output never describes low signal as safe', () => {
  const result = analyzeContent('Your account is ready for review in our store.', 'sms');
  assert.ok(result.score <= 30);
  assert.match(result.summary, /not be detected|no strong known signals/i);
  assert.doesNotMatch(result.verdict, /safe/i);
});
