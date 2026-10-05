import { analyzeContent, detectionPatterns } from './detector.js';
import { createWorker } from 'tesseract.js';
import { analyzeScreenshotText, validateImage } from './image.js';
import { readHistory, saveScan, deleteScan, clearHistory } from './history.js';
import './styles.css';

const app = document.querySelector('#app');
const icon = (code) => String.fromCodePoint(code);
const icons = {
  dashboard: icon(0x2302),
  check: icon(0x2315),
  history: icon(0x25F7),
  patterns: icon(0x25A5),
  risk: icon(0x26A0),
  evidence: icon(0x25A4),
};
const navItems = [
  ['dashboard', 'Dashboard'], ['check', 'Check Request'], ['history', 'History'],
  ['patterns', 'Pattern Analysis'], ['risk', 'Risk Assessment'], ['evidence', 'Evidence Report'],
];
let activePage = 'dashboard';
let activeTab = 'sms';
let selectedScan = null;
let scans = readHistory();
let scanBusy = false;
let ocrBusy = false;
let selectedImage = null;
let ocrError = '';

// A clearly labeled preview lets the dashboard show its full layout before the first real scan.
const demoScan = {
  id: 'DEMO-PREVIEW',
  type: 'sms',
  text: 'THREAT DETECTED: You have been placed under Digital Arrest by the CBI. A warrant has been issued against your linked Aadhaar card for money laundering. Join this video call immediately for verification, or a police complaint will be filed: https://police-verification-portal.xyz',
  score: 96,
  level: 'High risk',
  verdict: 'Likely scam',
  confidenceLabel: 'Strong pattern match',
  signals: [
    { id: 'threat', label: 'Threat of legal action or arrest (Digital Arrest)', points: 24, advice: 'Threats of immediate arrest over phone or messages are a classic intimidation tactic (e.g., Digital Arrest scams). Verify through official channels in person.' },
    { id: 'urgency', label: 'Urgent or threatening language', points: 14, advice: 'Pause before acting on urgent demands.' },
    { id: 'impersonation', label: 'Brand, bank, or authority impersonation language', points: 10, advice: 'Contact the organization using its official app or website.' },
    { id: 'odd-tld', label: 'URL uses a less familiar domain ending', points: 10, advice: 'A domain ending alone does not prove fraud. Verify the exact registered domain independently.' },
  ],
  evidence: [
    { label: 'Digital Arrest', text: '"Digital Arrest"' },
    { label: 'CBI Impersonation', text: '"CBI"' },
    { label: 'Fake URL Extension', text: '".xyz"' },
  ],
  recommendations: [
    'Do NOT click the link or join any random video calls.',
    'There is no such thing as "Digital Arrest" under Indian Law. Police will not interrogate you via Skype/WhatsApp.',
    'Ignore and block the unknown number immediately.',
    'If you have transferred funds or shared bank info, report via the Cyber Crime Portal 1930.'
  ],
  urls: ['https://police-verification-portal.xyz'],
  summary: 'DEMO ONLY: This sample represents a severe "Digital Arrest" scam using authority impersonation and threats.',
  analyzedAt: new Date().toISOString(),
  isDemo: true,
};

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function contentTypeLabel(type) { return type === 'image-text' ? 'Screenshot OCR' : type === 'sms' ? 'Text message' : 'URL'; }
function clearSelectedImage() { if (selectedImage?.url) URL.revokeObjectURL(selectedImage.url); selectedImage = null; }
function dateLabel(value, options = {}) {
  try { return new Intl.DateTimeFormat('en-IN', options).format(new Date(value)); } catch { return '-'; }
}
function riskClass(score) { return score >= 61 ? 'high' : score >= 31 ? 'medium' : 'low'; }
function latest() { return selectedScan || scans[0] || demoScan; }
function toast(message) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast'; node.setAttribute('role', 'status'); node.textContent = message;
  document.body.append(node); setTimeout(() => node.remove(), 2300);
}
function setPage(page) {
  activePage = page;
  render();
  document.querySelector('.sidebar')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function headerTitle() {
  const titles = {
    dashboard: ['Threat Analysis', 'Real-time scam pattern intelligence'],
    check: ['Scan Target', 'Analyze SMS, links, or screenshot for threats'],
    history: ['Scan Logs', 'Encrypted locally on this device only'],
    patterns: ['Threat Database', 'Active detection patterns in the engine'],
    risk: ['Risk Matrix', 'Heuristic threat scoring breakdown'],
    evidence: ['Evidence Vault', 'Forensic details from the latest scan'],
  };
  return titles[activePage] || titles.dashboard;
}
function sidebar() {
  return `<aside class="sidebar" aria-label="Main navigation">
    <div class="brand"><div class="brand-mark" aria-hidden="true">${icon(0x2620)}</div><div><div class="brand-name">SCAMHUNTER</div><div class="brand-tag">${icon(0x26A0)} THREAT DETECTOR v2.0</div></div></div>
    <div class="nav-label">${icon(0x25B6)} Operations</div><nav class="nav-list">${navItems.map(([id, label]) => `<button class="nav-item ${activePage === id ? 'active' : ''}" data-page="${id}" ${activePage === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icons[id]}</span>${label}</button>`).join('')}</nav>
    <div class="status-block"><div class="nav-label">${icon(0x25B6)} System Status</div><div class="status-row"><span>${icon(0x25A3)} &nbsp; Threat engine</span><span class="status-badge">ONLINE</span></div><div class="status-row"><span>${icon(0x25A4)} &nbsp; Scan memory</span><span class="status-badge">${scans.length ? `${scans.length} RECORDS` : 'EMPTY'}</span></div><div class="status-row"><span>${icon(0x25C9)} &nbsp; Live intel feed</span><span class="status-badge">OFFLINE</span></div></div>
    <div class="privacy-card"><b>${icon(0x1F512)} Zero data leakage</b>All scans execute locally in your browser. Nothing leaves this machine. History can be wiped anytime.</div><div class="copyright">&copy; 2026 ScamHunter AI<br>Pattern-based threat detector &middot; Not a safety guarantee</div>
  </aside>`;
}
function dashboard() {
  const scan = latest();
  if (!scan) return `<div class="section-wrap"><div class="empty"><div class="empty-icon">${icon(0x1F6E1)}</div><h3>No investigation yet</h3><p>Paste a suspicious message or URL to check it. This dashboard will show findings from your actual scan. No sample result is presented as real.</p><button class="btn btn-primary" data-action="new"><span class="btn-icon">+</span>Start a new check</button></div><div class="privacy-note">${icon(0x2139)} This is a local pattern checker, not a real AI or live threat-intelligence service. A low score cannot guarantee safety.</div></div>`;
  const tone = riskClass(scan.score);
  const alertClass = scan.score >= 61 ? '' : scan.score >= 31 ? 'caution' : 'safe';
  const alertTitle = scan.score >= 61 ? `${icon(0x1F6A8)} DANGER — THREAT DETECTED` : scan.score >= 31 ? `CAUTION — SUSPICIOUS SIGNALS FOUND` : `CLEAR — NO STRONG THREATS DETECTED`;
  const alertIcon = scan.score >= 61 ? icon(0x2620) : scan.score >= 31 ? icon(0x26A1) : icon(0x2713);
  return `<section aria-label="Latest scan result">
    ${scan.isDemo ? '<div class="demo-banner"><strong>DEMO PREVIEW - SAMPLE MESSAGE</strong><span>These findings are illustrative, not your scan. Select New Check to analyze your own message, link, or copied screenshot text.</span></div>' : ''}
    <div class="kpi-grid">
      <article class="kpi risk-${tone}"><div class="kpi-label">RISK SCORE</div><div class="kpi-value">${scan.score}/100</div><div class="mini-track" role="progressbar" aria-label="Heuristic risk score" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${scan.score}"><span style="width:${scan.score}%;background:${scan.score >= 61 ? 'var(--danger)' : scan.score >= 31 ? 'var(--caution)' : 'var(--safe)'}"></span></div><div class="kpi-note">${esc(scan.level)} &middot; heuristic</div></article>
      <article class="kpi blue"><div class="kpi-label">SIGNAL COVERAGE</div><div class="kpi-value">${scan.signals.length} pattern${scan.signals.length === 1 ? '' : 's'}</div><div class="kpi-note">${esc(scan.confidenceLabel)} &middot; heuristic, not confidence</div></article>
      <article class="kpi purple"><div class="kpi-label">VERDICT</div><div class="kpi-value">${esc(scan.verdict)}</div><div class="kpi-note">Not a definitive determination</div></article>
    </div>
    <div class="alert ${alertClass}" role="status"><div class="alert-icon">${alertIcon}</div><div><strong>${alertTitle}</strong><p>${esc(scan.summary)}</p></div></div>
    <div class="content-grid">
      <article class="panel"><div class="panel-head"><span class="panel-icon">${icon(0x1F50E)}</span><h2>Investigation Summary</h2></div><p class="panel-copy">${esc(scan.summary)} Content type: ${scan.type === 'image-text' ? 'Screenshot OCR text' : scan.type === 'sms' ? 'Text message' : 'URL'}.</p>${scan.type === 'image-text' ? `<div class="ocr-text"><strong>Text extracted from image (${scan.imageOcrConfidence}% OCR confidence)</strong><pre>${esc(scan.text)}</pre></div>` : ''}</article>
      <article class="panel"><div class="panel-head"><span class="panel-icon">${icon(0x1F6A8)}</span><h2>Red Flags</h2></div>${scan.signals.length ? `<ul class="flag-list">${scan.signals.map((item) => `<li><span class="flag-dot"></span>${esc(item.label)}</li>`).join('')}</ul>` : `<p class="panel-copy">No known pattern matched. That does not mean the content is safe. New or context-specific scams may not be detected.</p>`}</article>
      <article class="panel"><div class="panel-head"><span class="panel-icon">${icon(0x1F50D)}</span><h2>Evidence Found</h2></div>${scan.evidence.length ? `<ul class="evidence-list">${scan.evidence.map((item) => `<li><span class="evidence-dot"></span><span class="evidence-text"><b>${esc(item.label)}:</b> ${esc(item.text)}</span></li>`).join('')}${scan.urls.map((url) => `<li><span class="evidence-dot"></span><span class="evidence-text">URL text: <code>${esc(url)}</code> <small>(not opened)</small></span></li>`).join('')}</ul>` : `<p class="panel-copy">No evidence snippets are available for this scan. Treat this result as inconclusive.</p>`}</article>
      <article class="panel"><div class="panel-head"><span class="panel-icon">${icon(0x2705)}</span><h2>Recommended Actions</h2></div><ul class="action-list">${scan.recommendations.map((item) => `<li><span class="action-check">${icon(0x2713)}</span>${esc(item)}</li>`).join('')}</ul></article>
    </div>
    <div class="meta-row"><div class="meta-item"><span class="meta-icon">${icon(0x1F4C5)}</span><div><div class="meta-label">Analyzed On</div><div class="meta-value">${dateLabel(scan.analyzedAt, { dateStyle: 'medium', timeStyle: 'short' })}</div></div></div><div class="meta-item"><span class="meta-icon">${icon(0x1F4AC)}</span><div><div class="meta-label">Content Type</div><div class="meta-value">${contentTypeLabel(scan.type)}</div></div></div><div class="meta-item"><span class="meta-icon">${icon(0x25CF)}</span><div><div class="meta-label">Analysis ID</div><div class="meta-value">${esc(scan.id)}</div></div></div><div class="meta-item"><span class="meta-icon">${icon(0x23F2)}</span><div><div class="meta-label">Processing</div><div class="meta-value">Local &middot; instantaneous</div></div></div></div>
    <div class="form-footer"><span class="field-hint">Analysis uses local pattern checks only. A low score is not proof of safety.</span><div class="row-actions"><button class="btn btn-small" data-action="copy">Copy report</button><button class="btn btn-primary btn-small" data-action="new">+ New Check</button></div></div>
  </section>`;
}
function checkView() {
  const chosenImage = selectedImage ? `<div class="image-preview"><img src="${selectedImage.url}" alt="Selected screenshot preview" /><div><strong>${esc(selectedImage.name)}</strong><small>${(selectedImage.file.size / 1024 / 1024).toFixed(1)} MB &middot; processed locally</small></div><button type="button" class="btn btn-small" data-action="remove-image">Remove</button></div>` : '';
  const presets = [
    { label: '🚨 Digital Arrest Scam', text: 'You are under digital arrest. CBI has found your account involved in money laundering. Join this Zoom call immediately for verification: https://short.link/123' },
    { label: '⚡ Electricity Disconnection', text: 'Dear consumer, your electricity supply will be disconnected tonight at 9:30 PM because your last month bill was not updated. Please contact this number immediately: 9876543210' },
    { label: '📦 FedEx Parcel Seized', text: 'Your FedEx parcel has been seized by customs due to illegal goods. Your Aadhaar is linked to this case. Pay a fine or risk arrest.' },
    { label: '💰 Task/Job Scam', text: 'Earn ₹5000 daily working part-time. Just like these videos and earn 500 per like. Join our VIP Telegram channel: https://telegram.me/join-task' },
    { label: '🏆 KBC Lottery', text: 'Congratulations, your Jio number has won Rs 25 Lakh in the KBC lottery. Your reward is waiting. Call our manager at 9876543210 now!' },
  ];
  return `<div class="section-wrap"><div class="section-heading"><h2>Check a suspicious message, link, or screenshot</h2><p>Local pattern checks find clues; they cannot confirm something is genuine. Submitted links are never opened.</p></div>
    <div class="panel form-card">
      <div class="mode-tabs" role="tablist" aria-label="Content type"><button class="mode-tab ${activeTab === 'sms' ? 'active' : ''}" data-tab="sms" role="tab" aria-selected="${activeTab === 'sms'}">${icon(0x1F4AC)} &nbsp; SMS / Message</button><button class="mode-tab ${activeTab === 'link' ? 'active' : ''}" data-tab="link" role="tab" aria-selected="${activeTab === 'link'}">${icon(0x1F517)} &nbsp; Link / URL</button><button class="mode-tab ${activeTab === 'image' ? 'active' : ''}" data-tab="image" role="tab" aria-selected="${activeTab === 'image'}">${icon(0x1F5BC)} &nbsp; Screenshot</button></div>
      ${activeTab === 'image' ? `<form id="image-form" class="scan-form"><label class="field-label" for="image-input"><span>Choose a message screenshot</span><span class="field-hint">PNG, JPEG, or WebP &middot; max 5 MB</span></label><input id="image-input" class="url-input" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="image-help image-status" ${ocrBusy ? 'disabled' : ''} /><p id="image-help" class="privacy-note">Screenshot OCR runs in this browser using Tesseract.js. The first run downloads OCR engine/language assets from its CDN. The image is not uploaded to ScamHunter or saved; extracted text and results are saved in local history. OCR only reads visible text and may misread it—it cannot understand the image or verify the sender.</p>${chosenImage}<div id="image-status" class="form-error" role="status" aria-live="polite">${ocrBusy ? 'Reading screenshot text locally...' : esc(ocrError)}</div><div class="form-footer"><button type="button" class="btn" data-action="paste">Paste text instead</button><button type="button" class="btn btn-primary" data-action="scan-image" ${!selectedImage || ocrBusy ? 'disabled' : ''}>${ocrBusy ? 'Reading screenshot...' : 'Extract text & analyze'}</button></div></form>` : `<form id="scan-form" class="scan-form"><label class="field-label" for="scan-input"><span>${activeTab === 'sms' ? 'Message text (including text copied from an image)' : 'Web address'}</span><span class="field-hint" id="input-counter">${activeTab === 'sms' ? '0 characters' : 'Paste the full URL'}</span></label>${activeTab === 'sms' ? `<textarea id="scan-input" maxlength="10000" placeholder="Paste the SMS or message here...&#10;&#10;Example: Your bank account is blocked. Share your OTP to claim a reward." required></textarea>` : `<input class="url-input" id="scan-input" type="text" inputmode="url" placeholder="https://example.com/verify" autocomplete="off" spellcheck="false" required />`}<div id="form-error" class="form-error" role="alert"></div><div class="form-footer"><button type="button" class="btn" data-action="paste">Paste from clipboard</button><button type="submit" class="btn btn-primary" ${scanBusy ? 'disabled' : ''}>${scanBusy ? 'Checking...' : `${icon(0x2315)}  Analyze locally`}</button></div></form><div class="privacy-note">${icon(0x1F512)} <b>Local pattern checker:</b> text is analyzed in this browser and saved in browser history. No link is opened and there is no live threat lookup.</div>`}
    </div>

    ${activeTab !== 'image' ? `<div class="panel form-card" style="margin-top:16px">
      <h2 style="margin-bottom:12px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--info)">Quick Scam Test Examples</h2>
      <div style="display:grid;gap:8px">
        ${presets.map(p => `<button class="btn btn-small" data-preset="${esc(p.text)}" style="text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.label)}</button>`).join('')}
      </div></div>` : ''}
  </div>`;
}
function historyView() {
  const list = scans;
  return `<div class="section-wrap"><div class="section-heading"><h2>Recent scans</h2><p>Stored on this device only &middot; ${list.length} of 50 records</p></div>${list.length ? `<div class="form-footer" style="margin:0 0 12px"><span class="field-hint">History includes message text. Avoid saving sensitive content.</span><button class="btn btn-small" data-action="clear-history">Clear history</button></div><div class="history-list">${list.map((item) => `<article class="history-row"><div class="history-score ${riskClass(item.score)}">${item.score}/100</div><div><div class="history-snippet">${esc(item.text.slice(0, 130))}</div><div class="history-meta">${contentTypeLabel(item.type)} &middot; ${esc(item.verdict)} &middot; ${dateLabel(item.analyzedAt, { dateStyle: 'medium', timeStyle: 'short' })}</div></div><div class="row-actions"><button class="btn btn-small" data-view-scan="${esc(item.id)}">View</button><button class="btn btn-small" data-delete-scan="${esc(item.id)}" aria-label="Delete saved scan">Delete</button></div></article>`).join('')}</div>` : `<div class="empty"><div class="empty-icon">${icon(0x25F7)}</div><h3>History is empty</h3><p>Your completed checks will appear here and remain in this browser until deleted.</p><button class="btn btn-primary" data-action="new">Start a check</button></div>`}</div>`;
}
function patternsView() {
  return `<div class="section-wrap"><div class="section-heading"><h2>Signals checked</h2><p>The scanner looks for these known patterns. A match is a clue, not proof of fraud.</p></div><div class="panel"><div class="pattern-grid">${detectionPatterns.map((pattern) => `<div class="pattern-row"><div><b>${esc(pattern.label)}</b><small>Local text pattern &middot; heuristic weight</small></div><span class="pattern-score">+${pattern.points} pts max</span></div>`).join('')}</div><div class="privacy-note">This list is not exhaustive. Scammers change wording and domains frequently; unmatched content can still be harmful.</div></div></div>`;
}
function riskView() {
  const scan = latest();
  return `<div class="section-wrap"><div class="section-heading"><h2>Risk assessment</h2><p>Latest scan: ${esc(scan.id)} &middot; ${esc(scan.verdict)}</p></div><div class="panel"><div style="font:700 34px 'Cascadia Code',monospace;margin-bottom:4px;text-shadow:0 0 8px var(--text)">${scan.score}<span style="font-size:15px;color:var(--muted)"> / 100 heuristic points</span></div><p class="panel-copy" style="margin-bottom:20px">Signals below add up to a capped score. We do not calibrate this number against real-world scam outcomes.</p>${scan.signals.length ? scan.signals.map((signal) => `<div class="assessment-bar"><label>${esc(signal.label)}</label><div class="bar"><span style="width:${Math.min(100, signal.points * 2)}%"></span></div><strong>+${signal.points}</strong></div>`).join('') : '<p class="panel-copy">No known signals matched. This is inconclusive, not a safe verdict.</p>'}<div class="privacy-note">Severity bands: 0-30 lower signal, 31-60 caution, 61-100 high signal. Always independently verify requests.</div></div></div>`;
}
function evidenceView() {
  const scan = latest();
  return `<div class="section-wrap"><div class="section-heading"><h2>Evidence from latest check</h2><p>${esc(scan.id)} &middot; ${contentTypeLabel(scan.type)} &middot; ${dateLabel(scan.analyzedAt, { dateStyle: 'full', timeStyle: 'short' })}</p></div><article class="panel"><div class="panel-head"><span class="panel-icon">${icon(0x1F4C4)}</span><h2>Submitted content</h2></div><p class="panel-copy" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(scan.text)}</p></article><article class="panel" style="margin-top:14px"><div class="panel-head"><span class="panel-icon">${icon(0x1F50D)}</span><h2>Matched evidence (${scan.evidence.length})</h2></div>${scan.evidence.length ? `<ul class="evidence-list">${scan.evidence.map((item) => `<li><span class="evidence-dot"></span><span class="evidence-text"><b>${esc(item.label)}</b> - ${esc(item.text)}</span></li>`).join('')}</ul>` : '<p class="panel-copy">No known text pattern was found.</p>'}</article><div class="privacy-note">Submitted links are shown as plain text and were not opened. Report contents are stored locally in browser history.</div></div>`;
}
function viewContent() {
  if (activePage === 'check') return checkView();
  if (activePage === 'history') return historyView();
  if (activePage === 'patterns') return patternsView();
  if (activePage === 'risk') return riskView();
  if (activePage === 'evidence') return evidenceView();
  return dashboard();
}
function render() {
  const [title, subtitle] = headerTitle();
  app.innerHTML = `${sidebar()}<main class="main"><header class="topbar"><div class="page-title"><button class="btn menu-toggle" data-action="menu" aria-label="Open navigation">${icon(0x2630)}</button><div class="page-symbol" aria-hidden="true">${activePage === 'dashboard' ? icon(0x2620) : icons[activePage] || icon(0x26A0)}</div><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div></div><div class="actions"><button class="btn" data-action="theme" aria-label="Toggle color theme">${icon(0x25D0)} <span class="theme-label">${document.documentElement.classList.contains('light') ? 'Light' : 'Dark'}</span></button><button class="btn btn-primary" data-action="new">New Check <span class="btn-icon">+</span></button></div></header><div id="view-content">${viewContent()}</div><footer style="text-align:center;color:var(--muted);font-size:10px;padding:24px 0 4px">Local pattern checks &middot; No live threat intelligence &middot; Verify independently</footer></main>`;
  const input = document.querySelector('#scan-input');
  if (input && activeTab === 'sms') input.addEventListener('input', () => { const counter = document.querySelector('#input-counter'); if (counter) counter.textContent = `${input.value.length} characters`; });
  document.querySelector('#scan-form')?.addEventListener('submit', handleScan);
  document.querySelector('#image-input')?.addEventListener('change', handleImageSelect);
}
function handleImageSelect(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  ocrError = '';
  const validationError = validateImage(file);
  if (validationError) {
    ocrError = validationError;
    event.currentTarget.value = '';
    render();
    return;
  }
  clearSelectedImage();
  selectedImage = { file, name: file.name || 'Screenshot', url: URL.createObjectURL(file) };
  render();
}
async function analyzeScreenshot() {
  if (!selectedImage || ocrBusy) return;
  const screenshotFile = selectedImage.file;
  const screenshotUrl = selectedImage.url;
  ocrBusy = true;
  ocrError = '';
  render();
  let worker;
  try {
    worker = await createWorker('eng', 1, { workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js', corePath: '/tesseract-core', langPath: 'https://tessdata.projectnaptha.com/4.0.0', gzip: true, logger: (message) => {
      const current = document.querySelector('#image-status');
      if (!current || !message.status) return;
      const progress = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : '';
      current.textContent = `Reading screenshot locally: ${message.status}${progress}`;
    } });
    const { data } = await worker.recognize(screenshotFile);
    const result = analyzeScreenshotText(data.text, data.confidence);
    if (result.error) throw new Error(result.error);
    if (!selectedImage || selectedImage.file !== screenshotFile) { activePage = 'check'; activeTab = 'image'; throw new Error('Screenshot selection changed. Please choose it again.'); }
    clearSelectedImage();
    scans = saveScan(result);
    selectedScan = result;
    activePage = 'dashboard';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    ocrError = error.message || 'OCR could not process this image. Try pasting its text instead.';
    if (selectedImage?.url === screenshotUrl) clearSelectedImage();
  } finally {
    await worker?.terminate();
    ocrBusy = false;
    render();
  }
  if (selectedScan) render();
}
async function handleScan(event) {
  event.preventDefault();
  const input = document.querySelector('#scan-input');
  const error = document.querySelector('#form-error');
  const text = input?.value.trim() ?? '';
  const type = activeTab === 'link' ? 'link' : 'sms';
  const result = analyzeContent(text, type);
  if (result.error) { error.textContent = result.error; input?.focus(); return; }
  if (scanBusy) return;
  scanBusy = true;
  const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled = true; submit.textContent = 'Checking locally...';
  await new Promise((resolve) => setTimeout(resolve, 350));
  scans = saveScan(result);
  selectedScan = result;
  scanBusy = false;
  activePage = 'dashboard';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function copyReport() {
  const scan = latest(); if (!scan) return;
  const report = [`ScamHunter local pattern report`, `Verdict: ${scan.verdict} (${scan.score}/100 heuristic points)`, `Content type: ${contentTypeLabel(scan.type)}`, `Summary: ${scan.summary}`, `Signals: ${scan.signals.map((item) => item.label).join('; ') || 'None matched'}`, `Analyzed: ${scan.analyzedAt}`, `Note: This is not an AI or live threat-intelligence result; a low score is not proof of safety.`].join('\n');
  try { await navigator.clipboard.writeText(report); toast('Report copied'); } catch { toast('Clipboard unavailable in this browser'); }
}
app.addEventListener('click', async (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { if (ocrBusy) return; clearSelectedImage(); selectedScan = null; setPage(pageButton.dataset.page); return; }
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) { if (ocrBusy) return; if (activeTab === 'image' && tabButton.dataset.tab !== 'image') clearSelectedImage(); activeTab = tabButton.dataset.tab; ocrError = ''; render(); return; }
  const viewButton = event.target.closest('[data-view-scan]');
  if (viewButton) { clearSelectedImage(); selectedScan = scans.find((item) => item.id === viewButton.dataset.viewScan) || null; activePage = 'dashboard'; render(); return; }
  const deleteButton = event.target.closest('[data-delete-scan]');
  if (deleteButton) {
    const id = deleteButton.dataset.deleteScan;
    if (window.confirm('Delete this saved scan from browser history?')) {
      scans = deleteScan(id);
      if (selectedScan?.id === id) selectedScan = null;
      render();
      toast('Saved scan deleted');
    }
    return;
  }
  const presetButton = event.target.closest('[data-preset]');
  if (presetButton) {
    const input = document.querySelector('#scan-input');
    if (input) {
      input.value = presetButton.dataset.preset;
      input.dispatchEvent(new Event('input'));
      input.focus();
    }
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'new') { if (ocrBusy) return; selectedScan = null; activePage = 'check'; activeTab = 'sms'; ocrError = ''; clearSelectedImage(); render(); document.querySelector('.sidebar')?.classList.remove('open'); setTimeout(() => document.querySelector('#scan-input')?.focus(), 30); }
  if (action === 'scan-image') analyzeScreenshot();
  if (action === 'remove-image') { if (ocrBusy) return; clearSelectedImage(); ocrError = ''; render(); }
  if (action === 'theme') {
    document.documentElement.classList.toggle('light');
    try { localStorage.setItem('scamhunter.theme', document.documentElement.classList.contains('light') ? 'light' : 'dark'); } catch { /* theme preference is optional */ }
    render();
  }
  if (action === 'menu') document.querySelector('.sidebar')?.classList.toggle('open');
  if (action === 'copy') copyReport();
  if (action === 'clear-history') { if (window.confirm('Delete all locally saved scan history?')) { clearHistory(); scans = []; selectedScan = null; render(); toast('History cleared from this browser'); } }
  if (action === 'paste') {
    if (activeTab === 'image') { if (ocrBusy) return; clearSelectedImage(); activeTab = 'sms'; render(); }
    try { document.querySelector('#scan-input').value = await navigator.clipboard.readText(); document.querySelector('#scan-input').dispatchEvent(new Event('input')); }
    catch { toast('Clipboard permission unavailable. Paste with Ctrl+V.'); }
  }
});
try { if (localStorage.getItem('scamhunter.theme') === 'light') document.documentElement.classList.add('light'); } catch { /* theme preference is optional */ }
render();
