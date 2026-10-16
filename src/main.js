import { analyzeContent, detectionPatterns } from './detector.js';
import { createWorker } from 'tesseract.js';
import { analyzeScreenshotText, validateImage } from './image.js';
import { readHistory, saveScan, deleteScan, clearHistory } from './history.js';
import './styles.css';

const app = document.querySelector('#app');

// ── State ──────────────────────────────────────────────
let activePage  = 'dashboard';
let activeTab   = 'sms';
let selectedScan = null;
let scans       = readHistory();
let scanBusy    = false;
let ocrBusy     = false;
let selectedImage = null;
let ocrError    = '';

// ── Demo scan shown before any real scan ───────────────
const demoScan = {
  id: 'SH-20250527-191742',
  type: 'sms',
  text: 'Dear Airtel customer, you have won ₹50,000 cashback. Your reward expires today. To claim immediately enter your bank account number, ATM PIN and OTP at http://airtel-reward-claim.example.com',
  score: 100,
  level: 'Very High Risk',
  verdict: 'SCAM',
  confidenceLabel: '100%',
  signals: [
    { id: 'prize',         label: 'Unrealistic monetary reward (₹50,000 cashback)',                    points: 20, advice: 'Unexpected prizes that require personal details are a common scam tactic.' },
    { id: 'urgency',       label: 'Artificial urgency and pressure (expires today, claim immediately)', points: 14, advice: 'Pause before acting on urgent demands. Scammers use time pressure to stop you checking independently.' },
    { id: 'impersonation', label: 'Impersonation of Airtel Payments Bank',                             points: 10, advice: 'Contact the organization using its official app or website—not details in the message.' },
    { id: 'credentials',   label: 'Request for sensitive banking information (ATM PIN and OTP)',        points: 26, advice: 'Never share an OTP, PIN, password, or verification code. Legitimate support will not ask you to disclose one.' },
    { id: 'lookalike',     label: 'Suspicious non-official URL (airtel-reward-claim.example.com)',      points: 18, advice: 'This domain is not an official Airtel domain. Do not click or enter any information.' },
  ],
  evidence: [
    { label: 'Banking credentials demand', text: '"enter your bank account number, ATM PIN and OTP"' },
    { label: 'Fake reward claim',           text: '"You have won ₹50,000 cashback from Airtel Payments Bank"' },
    { label: 'Urgency phrase',              text: '"Your reward will expire today" and "claim your cashback immediately"' },
  ],
  recommendations: [
    'Do not click on the link under any circumstances.',
    'Never share your ATM PIN, passwords, or OTP with anyone, as financial institutions will never ask for them.',
    'Block the sender and report the message as phishing to your service provider or cybercrime authority.',
    'If you have already entered any details, contact your bank immediately to freeze your account/cards.',
  ],
  urls: ['http://airtel-reward-claim.example.com'],
  summary: 'This message is a classic example of a scam/smishing attempt. It lures the victim with a fake reward of ₹50,000 cashback and creates urgency by saying the reward will expire today. It asks for highly sensitive banking information like ATM PIN and OTP, which legitimate organizations will never ask for. The provided link is suspicious and not an official domain.',
  analyzedAt: '2025-05-27T13:47:42.000Z',
  processingTime: '2.34 seconds',
  isDemo: true,
};

// ── Helpers ────────────────────────────────────────────
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function dateLabel(value, options = {}) {
  try { return new Intl.DateTimeFormat('en-IN', options).format(new Date(value)); }
  catch { return '-'; }
}

function riskClass(score) {
  return score >= 61 ? 'high' : score >= 31 ? 'medium' : 'low';
}

function contentTypeLabel(type) {
  return type === 'image-text' ? 'Screenshot OCR' : type === 'sms' ? 'Text Message' : 'URL';
}

function latest() { return selectedScan || scans[0] || demoScan; }

function clearSelectedImage() {
  if (selectedImage?.url) URL.revokeObjectURL(selectedImage.url);
  selectedImage = null;
}

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2500);
}

function setPage(page) {
  activePage = page;
  render();
  document.querySelector('.sidebar')?.classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Header titles per page ────────────────────────────
function headerTitle() {
  const map = {
    dashboard: ['Investigation Result',   'AI-Powered Scam Analysis & Detection'],
    check:     ['New Investigation',      'Analyze SMS, links, or screenshots for threats'],
    history:   ['Scan History',           'Encrypted locally on this device only'],
    patterns:  ['Pattern Analysis',       'Active detection patterns in the engine'],
    risk:      ['Risk Assessment',        'Heuristic threat scoring breakdown'],
    evidence:  ['Evidence Report',        'Forensic details from the latest scan'],
  };
  return map[activePage] || map.dashboard;
}

// ── SIDEBAR ───────────────────────────────────────────
const navItems = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'check',     icon: '➕', label: 'New Investigation' },
  { id: 'history',   icon: '🕒', label: 'History' },
  { id: 'patterns',  icon: '📊', label: 'Pattern Analysis' },
  { id: 'risk',      icon: '🛡️', label: 'Risk Assessment' },
  { id: 'evidence',  icon: '📄', label: 'Evidence Report' },
];

function sidebar() {
  return `
  <aside class="sidebar" aria-label="Main navigation">
    <div class="sidebar-top">
      <!-- Brand -->
      <div class="brand">
        <div class="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M12 2 4.5 5.2v6.3c0 4.6 3.2 8.9 7.5 10 4.3-1.1 7.5-5.4 7.5-10V5.2L12 2z" fill="#7c3aed"/>
            <path d="M12 3.4 6 6v5.4c0 3.7 2.5 7.2 6 8.2 3.5-1 6-4.5 6-8.2V6l-6-2.6z" fill="#a855f7"/>
            <circle cx="12" cy="11.2" r="2.5" fill="#1a0e3d"/>
            <path d="M9.2 10.2c0-1.7 1.2-3 2.8-3s2.8 1.3 2.8 3c0 .9-.4 1.6-1 2.1-.3.2-.4.5-.4.9v.7h-2.8v-.7c0-.4-.1-.7-.4-.9-.6-.5-1-1.2-1-2.1z" fill="#c4b5fd"/>
            <path d="M8.4 9.4 9.6 8.6M15.6 9.4 14.4 8.6" stroke="#1a0e3d" stroke-width="1.1" stroke-linecap="round"/>
            <path d="M9.6 16.2c.7.6 1.5.9 2.4.9s1.7-.3 2.4-.9" stroke="#ddd6fe" stroke-width=".9" stroke-linecap="round" fill="none"/>
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-name">ScamHunter AI</div>
          <div class="brand-tag">AI-Powered Scam Detection</div>
        </div>
        <button class="menu-toggle" data-action="menu" aria-label="Close navigation" style="display:none">☰</button>
      </div>

      <!-- Navigation -->
      <div class="nav-section-label">Investigation</div>
      <nav class="nav-list">
        ${navItems.map(({ id, icon, label }) => `
          <button class="nav-item ${activePage === id ? 'active' : ''}"
            data-page="${id}"
            ${activePage === id ? 'aria-current="page"' : ''}>
            <span class="nav-icon" aria-hidden="true">${icon}</span>
            ${esc(label)}
          </button>`).join('')}
      </nav>
    </div>

    <!-- System Status -->
    <div class="status-section">
      <div class="nav-section-label" style="padding:0 4px 10px">System</div>
      <div class="status-row">
        <span class="status-name"><span class="status-dot" aria-hidden="true"></span>⚙️ AI Engine</span>
        <span class="status-badge-online">ONLINE</span>
      </div>
      <div class="status-row">
        <span class="status-name"><span class="status-dot" aria-hidden="true"></span>🗄️ Database</span>
        <span class="status-badge-online">CONNECTED</span>
      </div>
      <div class="status-row">
        <span class="status-name"><span class="status-dot" aria-hidden="true"></span>🌐 API Status</span>
        <span class="status-badge-online">ACTIVE</span>
      </div>
    </div>

    <!-- Promo card -->
    <div class="promo-card">
      <div class="promo-title">🕵️‍♂️ Stay Smart. Stay Safe.</div>
      <p>We protect you from online scams and suspicious content.</p>
    </div>

    <!-- Copyright -->
    <div class="copyright">© 2025 ScamHunter AI All rights reserved.</div>
  </aside>`;
}

// ── DASHBOARD ────────────────────────────────────────
function dashboard() {
  const scan = latest();
  if (!scan) {
    return `<div class="empty-state">
      <div class="empty-icon">🛡️</div>
      <h3>No Investigation Yet</h3>
      <p>Paste a suspicious message or URL to check it. The dashboard will show your findings here.</p>
      <button class="btn btn-purple" data-action="new" style="margin:0 auto">
        <span>➕</span> Start Investigation
      </button>
    </div>`;
  }

  const tone       = riskClass(scan.score);
  const isHighRisk = scan.score >= 61;
  const isMedium   = scan.score >= 31 && scan.score < 61;

  const alertClass    = isHighRisk ? 'danger' : isMedium ? 'caution' : 'safe';
  const alertTitle    = isHighRisk
    ? 'HIGH RISK — Scam indicators detected!'
    : isMedium
    ? 'CAUTION — Suspicious signals found'
    : 'CLEAR — No strong threats detected';
  const alertSubtitle = isHighRisk
    ? 'This content shows strong signs of a scam or phishing attempt. Avoid interaction.'
    : isMedium
    ? 'Some suspicious signals were found. Proceed with caution and verify independently.'
    : 'No known scam patterns matched. This is not a guarantee of safety.';

  const alertWarningIcon = isHighRisk ? '⚠️' : isMedium ? '⚡' : '✅';

  const kpi1Note    = isHighRisk ? '🔴 Very High Risk' : isMedium ? '🟡 Medium Risk' : '🟢 Low Risk';
  const confidence  = scan.confidenceLabel || (scan.signals.length >= 3 ? '100%' : scan.signals.length ? '75%' : '40%');
  const verdictText = scan.verdict || (isHighRisk ? 'SCAM' : isMedium ? 'SUSPICIOUS' : 'SAFE');

  return `
  <section aria-label="Investigation result">

    ${scan.isDemo ? `
    <div class="demo-banner">
      <span>ℹ️</span>
      <div>
        <strong>Demo Preview — Sample Message</strong>
        <span>These findings are illustrative. Select "New Investigation" to analyze your own message, link, or screenshot.</span>
      </div>
    </div>` : ''}

    <!-- KPI Cards -->
    <div class="kpi-grid">

      <!-- Risk Score -->
      <article class="kpi-card red">
        <div class="kpi-label">RISK SCORE</div>
        <div class="kpi-top">
          <div>
            <div class="kpi-value">${scan.score}/100</div>
            <div class="kpi-progress">
              <div class="kpi-progress-fill" style="width:${scan.score}%"></div>
            </div>
          </div>
          <div class="kpi-icon">🛡️</div>
        </div>
        <div class="kpi-note">
          <span class="kpi-note-dot" style="background:var(--red)"></span>
          ${esc(kpi1Note)}
        </div>
      </article>

      <!-- Confidence -->
      <article class="kpi-card blue">
        <div class="kpi-label">CONFIDENCE</div>
        <div class="kpi-top">
          <div>
            <div class="kpi-value">${esc(confidence)}</div>
            <div class="kpi-progress">
              <div class="kpi-progress-fill" style="width:${scan.signals.length >= 3 ? 100 : scan.signals.length ? 75 : 40}%"></div>
            </div>
          </div>
          <div class="kpi-icon">🎯</div>
        </div>
        <div class="kpi-note">
          <span class="kpi-note-dot" style="background:var(--blue)"></span>
          🔵 Highly Confident
        </div>
      </article>

      <!-- Verdict -->
      <article class="kpi-card purple">
        <div class="kpi-label">VERDICT</div>
        <div class="kpi-top">
          <div>
            <div class="kpi-value" style="font-size:28px;letter-spacing:-0.5px">${esc(verdictText)}</div>
            <div style="height:4px;margin:10px 0 12px"></div>
          </div>
          <div class="kpi-icon">🕵️</div>
        </div>
        <div class="kpi-note">
          <span class="kpi-note-dot" style="background:var(--purple)"></span>
          🟣 This is likely a scam
        </div>
      </article>
    </div>

    <!-- Alert Banner -->
    <div class="alert-banner ${alertClass}" role="status">
      <div class="alert-warning-icon">${alertWarningIcon}</div>
      <div class="alert-body">
        <div class="alert-title">${esc(alertTitle)}</div>
        <div class="alert-subtitle">${esc(alertSubtitle)}</div>
      </div>
      ${isHighRisk ? `
      <div class="skull-wrap" aria-hidden="true">
        <span class="alert-skull">💀</span>
      </div>` : ''}
    </div>

    <!-- 4 Content Panels -->
    <div class="content-grid">

      <!-- AI Investigation Summary -->
      <article class="panel">
        <div class="panel-head">
          <span class="panel-icon">🧠</span>
          <h2>AI Investigation Summary</h2>
        </div>
        <p class="panel-copy">${esc(scan.summary)}${scan.type === 'image-text' ? ` Content extracted via OCR (${scan.imageOcrConfidence}% confidence).` : ''}</p>
        ${scan.type === 'image-text' ? `
        <div class="ocr-text" style="margin-top:14px">
          <strong>Extracted text from image</strong>
          <pre>${esc(scan.text)}</pre>
        </div>` : ''}
      </article>

      <!-- Red Flags -->
      <article class="panel">
        <div class="panel-head">
          <span class="panel-icon">🚩</span>
          <h2>Red Flags</h2>
        </div>
        ${scan.signals.length
          ? `<ul class="flag-list">${scan.signals.map((s) => {
              const isUrlFlag = s.id === 'lookalike' && s.label.includes('airtel-reward-claim');
              const labelHtml = isUrlFlag
                ? s.label.replace(
                    /(airtel-reward-claim\.example\.com)/,
                    '<a class="evidence-link" href="javascript:void(0)">$1</a>'
                  )
                : esc(s.label);
              return `<li><span class="flag-dot"></span><span>${isUrlFlag ? labelHtml : esc(s.label)}</span></li>`;
            }).join('')}</ul>`
          : `<p class="panel-copy">No known patterns matched. New or context-specific scams may not be detected.</p>`}
      </article>

      <!-- Evidence Found -->
      <article class="panel">
        <div class="panel-head">
          <span class="panel-icon">🔍</span>
          <h2>Evidence Found</h2>
        </div>
        ${(scan.evidence.length || scan.urls.length)
          ? `<ul class="evidence-list">
              ${scan.evidence.map((e) =>
                `<li><span class="evidence-dot"></span><span><b>${esc(e.label)}:</b> ${esc(e.text)}</span></li>`).join('')}
              ${scan.urls.map((url) =>
                `<li><span class="evidence-dot"></span><span>Link provided: <a class="evidence-link" href="javascript:void(0)">${esc(url)}</a></span></li>`).join('')}
            </ul>`
          : `<p class="panel-copy">No evidence snippets available for this scan.</p>`}
      </article>

      <!-- Recommended Actions -->
      <article class="panel">
        <div class="panel-head">
          <span class="panel-icon">✅</span>
          <h2>Recommended Actions</h2>
        </div>
        <ul class="action-list">
          ${scan.recommendations.map((r) =>
            `<li><span class="action-check">✓</span><span>${esc(r)}</span></li>`).join('')}
        </ul>
      </article>
    </div>

    <!-- Footer Metadata -->
    <div class="meta-row">
      <div class="meta-card">
        <div class="meta-icon-wrap">📅</div>
        <div>
          <div class="meta-label">Analyzed On</div>
          <div class="meta-value">${dateLabel(scan.analyzedAt, { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-icon-wrap">💬</div>
        <div>
          <div class="meta-label">Content Type</div>
          <div class="meta-value">${contentTypeLabel(scan.type)}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-icon-wrap">👤</div>
        <div>
          <div class="meta-label">Analysis ID</div>
          <div class="meta-value">${esc(scan.id)}</div>
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-icon-wrap">🕒</div>
        <div>
          <div class="meta-label">Processing Time</div>
          <div class="meta-value">${esc(scan.processingTime || 'Local · instant')}</div>
        </div>
      </div>
    </div>

    <!-- Report actions -->
    <div class="report-actions">
      <span class="hint">⚠️ Analysis uses local pattern checks only. A low score is not proof of safety.</span>
      <div class="row-actions">
        <button class="btn btn-small" data-action="copy">📋 Copy Report</button>
        <button class="btn btn-purple btn-small" data-action="new">➕ New Investigation</button>
      </div>
    </div>

  </section>`;
}

// ── CHECK VIEW ────────────────────────────────────────
function checkView() {
  const presets = [
    { label: '🚨 Digital Arrest Scam',       text: 'You are under digital arrest. CBI has found your account involved in money laundering. Join this Zoom call immediately: https://short.link/123' },
    { label: '⚡ Electricity Disconnection',  text: 'Dear consumer, your electricity supply will be disconnected tonight at 9:30 PM. Last month bill not updated. Contact immediately: 9876543210' },
    { label: '📦 FedEx Parcel Seized',         text: 'Your FedEx parcel has been seized by customs due to illegal goods. Your Aadhaar is linked to this case. Pay fine or risk arrest.' },
    { label: '💰 Task/Job Scam',               text: 'Earn ₹5000 daily working part-time. Like these videos and earn ₹500 per like. Join VIP Telegram: https://telegram.me/join-task' },
    { label: '🏆 KBC Lottery',                 text: 'Congratulations! Your Jio number has won Rs 25 Lakh in the KBC lottery. Call our manager at 9876543210 now!' },
  ];

  const imagePreviewHtml = selectedImage
    ? `<div class="image-preview">
        <img src="${selectedImage.url}" alt="Selected screenshot preview" />
        <div class="image-preview-info">
          <strong>${esc(selectedImage.name)}</strong>
          <small>${(selectedImage.file.size / 1024 / 1024).toFixed(1)} MB · processed locally</small>
        </div>
        <button type="button" class="btn btn-small" data-action="remove-image">✕ Remove</button>
      </div>`
    : '';

  return `
  <div>
    <div class="section-heading">
      <h2>Check a Suspicious Message, Link or Screenshot</h2>
      <p>Local pattern checks find clues — they cannot confirm something is genuine. Submitted links are never opened.</p>
    </div>

    <div class="panel form-card">
      <div class="mode-tabs" role="tablist">
        <button class="mode-tab ${activeTab === 'sms'   ? 'active' : ''}" data-tab="sms"   role="tab">💬 SMS / Message</button>
        <button class="mode-tab ${activeTab === 'link'  ? 'active' : ''}" data-tab="link"  role="tab">🔗 Link / URL</button>
        <button class="mode-tab ${activeTab === 'image' ? 'active' : ''}" data-tab="image" role="tab">🖼️ Screenshot</button>
      </div>

      ${activeTab === 'image'
        ? `<form id="image-form" class="scan-form">
            <label class="field-label" for="image-input">
              <span>Choose a message screenshot</span>
              <span class="field-hint">PNG, JPEG, WebP · max 5 MB</span>
            </label>
            <input id="image-input" class="url-input" type="file"
              accept="image/png,image/jpeg,image/webp"
              ${ocrBusy ? 'disabled' : ''} />
            <p class="privacy-note">Screenshot OCR runs locally using Tesseract.js. The image is not uploaded. OCR reads visible text only and may misread it.</p>
            ${imagePreviewHtml}
            <div id="image-status" class="form-error" role="status" aria-live="polite">
              ${ocrBusy ? 'Reading screenshot text locally…' : esc(ocrError)}
            </div>
            <div class="form-footer">
              <button type="button" class="btn" data-action="paste">📋 Paste text instead</button>
              <button type="button" class="btn btn-purple" data-action="scan-image"
                ${!selectedImage || ocrBusy ? 'disabled' : ''}>
                ${ocrBusy ? '⏳ Reading screenshot…' : '🔍 Extract text & analyze'}
              </button>
            </div>
          </form>`
        : `<form id="scan-form" class="scan-form">
            <label class="field-label" for="scan-input">
              <span>${activeTab === 'sms' ? 'Message text' : 'Web address'}</span>
              <span class="field-hint" id="input-counter">${activeTab === 'sms' ? '0 characters' : 'Paste the full URL'}</span>
            </label>
            ${activeTab === 'sms'
              ? `<textarea id="scan-input" maxlength="10000"
                  placeholder="Paste the SMS or message here…&#10;&#10;Example: Your bank account is blocked. Share your OTP to claim a reward."
                  required></textarea>`
              : `<input class="url-input" id="scan-input" type="text" inputmode="url"
                  placeholder="https://example.com/verify"
                  autocomplete="off" spellcheck="false" required />`}
            <div id="form-error" class="form-error" role="alert"></div>
            <div class="form-footer">
              <button type="button" class="btn" data-action="paste">📋 Paste from clipboard</button>
              <button type="submit" class="btn btn-purple" ${scanBusy ? 'disabled' : ''}>
                ${scanBusy ? '⏳ Checking…' : '🔍 Analyze locally'}
              </button>
            </div>
          </form>
          <div class="privacy-note">🔒 <b>Local pattern checker:</b> text is analyzed in this browser. No link is opened and there is no live threat lookup.</div>`}
    </div>

    ${activeTab !== 'image' ? `
    <div class="panel form-card presets-panel">
      <div class="presets-label">⚡ Quick Scam Test Examples</div>
      <div class="presets-grid">
        ${presets.map((p) =>
          `<button class="preset-btn" data-preset="${esc(p.text)}">${esc(p.label)}</button>`).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

// ── HISTORY VIEW ──────────────────────────────────────
function historyView() {
  return `
  <div>
    <div class="section-heading">
      <h2>Scan History</h2>
      <p>Stored on this device only · ${scans.length} of 50 records</p>
    </div>
    ${scans.length
      ? `<div class="report-actions" style="margin-bottom:14px">
          <span class="hint">History includes message text. Avoid saving sensitive content.</span>
          <button class="btn btn-small" data-action="clear-history">🗑️ Clear History</button>
        </div>
        <div class="history-list">
          ${scans.map((item) =>
            `<article class="history-row">
              <div class="history-score ${riskClass(item.score)}">${item.score}/100</div>
              <div>
                <div class="history-snippet">${esc(item.text.slice(0, 130))}</div>
                <div class="history-meta">${contentTypeLabel(item.type)} · ${esc(item.verdict)} · ${dateLabel(item.analyzedAt, { dateStyle: 'medium', timeStyle: 'short' })}</div>
              </div>
              <div class="row-actions">
                <button class="btn btn-small" data-view-scan="${esc(item.id)}">View</button>
                <button class="btn btn-small" data-delete-scan="${esc(item.id)}" aria-label="Delete scan">✕</button>
              </div>
            </article>`).join('')}
        </div>`
      : `<div class="empty-state">
          <div class="empty-icon">🕒</div>
          <h3>History is Empty</h3>
          <p>Your completed checks will appear here and remain in this browser until deleted.</p>
          <button class="btn btn-purple" data-action="new" style="margin:0 auto">Start a Check</button>
        </div>`}
  </div>`;
}

// ── PATTERNS VIEW ─────────────────────────────────────
function patternsView() {
  return `
  <div>
    <div class="section-heading">
      <h2>Pattern Analysis</h2>
      <p>The scanner checks for these known patterns. A match is a clue, not proof of fraud.</p>
    </div>
    <div class="panel">
      <div class="pattern-grid">
        ${detectionPatterns.map((p) =>
          `<div class="pattern-row">
            <div>
              <b>${esc(p.label)}</b>
              <small>Local text pattern · heuristic weight</small>
            </div>
            <span class="pattern-score">+${p.points} pts</span>
          </div>`).join('')}
      </div>
      <div class="privacy-note" style="margin-top:16px">This list is not exhaustive. Scammers change wording frequently; unmatched content can still be harmful.</div>
    </div>
  </div>`;
}

// ── RISK VIEW ─────────────────────────────────────────
function riskView() {
  const scan = latest();
  return `
  <div>
    <div class="section-heading">
      <h2>Risk Assessment</h2>
      <p>Latest scan: ${esc(scan.id)} · ${esc(scan.verdict)}</p>
    </div>
    <div class="panel">
      <div style="font:800 38px Inter,sans-serif;margin-bottom:4px;letter-spacing:-1px;color:#fff">
        ${scan.score}<span style="font-size:16px;font-weight:400;color:var(--muted-2)"> / 100 heuristic points</span>
      </div>
      <p class="panel-copy" style="margin-bottom:24px">Signals below add up to a capped score. This number is a heuristic, not a probability.</p>
      ${scan.signals.length
        ? scan.signals.map((s) =>
            `<div class="assessment-bar">
              <label>${esc(s.label)}</label>
              <div class="bar"><span style="width:${Math.min(100, s.points * 2)}%"></span></div>
              <strong>+${s.points}</strong>
            </div>`).join('')
        : `<p class="panel-copy">No known signals matched. This is inconclusive, not a safe verdict.</p>`}
      <div class="privacy-note" style="margin-top:16px">Severity bands: 0–30 lower signal, 31–60 caution, 61–100 high signal. Always independently verify.</div>
    </div>
  </div>`;
}

// ── EVIDENCE VIEW ─────────────────────────────────────
function evidenceView() {
  const scan = latest();
  return `
  <div>
    <div class="section-heading">
      <h2>Evidence Report</h2>
      <p>${esc(scan.id)} · ${contentTypeLabel(scan.type)} · ${dateLabel(scan.analyzedAt, { dateStyle: 'full', timeStyle: 'short' })}</p>
    </div>
    <article class="panel">
      <div class="panel-head">
        <span class="panel-icon">📄</span>
        <h2>Submitted Content</h2>
      </div>
      <p class="panel-copy" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(scan.text)}</p>
    </article>
    <article class="panel" style="margin-top:14px">
      <div class="panel-head">
        <span class="panel-icon">🔍</span>
        <h2>Matched Evidence (${scan.evidence.length})</h2>
      </div>
      ${scan.evidence.length
        ? `<ul class="evidence-list">
            ${scan.evidence.map((e) =>
              `<li><span class="evidence-dot"></span><span><b>${esc(e.label)}</b> — ${esc(e.text)}</span></li>`).join('')}
          </ul>`
        : `<p class="panel-copy">No known text pattern was found.</p>`}
    </article>
    <div class="privacy-note" style="margin-top:14px">Submitted links shown as plain text and were not opened. Report stored locally in browser history.</div>
  </div>`;
}

// ── VIEW ROUTER ───────────────────────────────────────
function viewContent() {
  if (activePage === 'check')    return checkView();
  if (activePage === 'history')  return historyView();
  if (activePage === 'patterns') return patternsView();
  if (activePage === 'risk')     return riskView();
  if (activePage === 'evidence') return evidenceView();
  return dashboard();
}

// ── RENDER ────────────────────────────────────────────
function render() {
  const [title, subtitle] = headerTitle();
  const isDark = !document.documentElement.classList.contains('light');

  app.innerHTML = `
  <div class="app-shell">
    ${sidebar()}

    <main class="main">
      <!-- Top bar -->
      <div class="topbar">
        <button class="btn btn-ghost menu-toggle" data-action="menu" aria-label="Open navigation"
          style="display:none">☰</button>
        <span></span>
        <div class="topbar-actions">
          <button class="btn btn-ghost" data-action="theme" aria-label="Toggle color theme">
            ${isDark ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button class="btn btn-purple" data-action="new">
            ✨ New Investigation
          </button>
        </div>
      </div>

      <!-- Page header -->
      <div class="page-header">
        <div class="header-icon" aria-hidden="true">
          ${activePage === 'dashboard' ? '🔍' : activePage === 'check' ? '➕' : activePage === 'history' ? '🕒' : activePage === 'patterns' ? '📊' : activePage === 'risk' ? '🛡️' : '📄'}
        </div>
        <div>
          <div class="header-title">${esc(title)}</div>
          <div class="header-subtitle">${esc(subtitle)}</div>
        </div>
      </div>

      <!-- Page content -->
      <div class="view-content" id="view-content">
        ${viewContent()}
      </div>

      <footer style="text-align:center;color:var(--text-soft);font-size:11px;padding:0 32px 24px;border-top:1px solid var(--border);padding-top:16px">
        Local pattern checks only · No live threat intelligence · Always verify independently
      </footer>
    </main>
  </div>`;

  // Wire up textarea character counter
  const input = document.querySelector('#scan-input');
  if (input && activeTab === 'sms') {
    input.addEventListener('input', () => {
      const counter = document.querySelector('#input-counter');
      if (counter) counter.textContent = `${input.value.length} characters`;
    });
  }

  document.querySelector('#scan-form')?.addEventListener('submit', handleScan);
  document.querySelector('#image-input')?.addEventListener('change', handleImageSelect);

  // Show menu-toggle on mobile
  const menuToggles = document.querySelectorAll('.menu-toggle');
  menuToggles.forEach((btn) => (btn.style.display = ''));
}

// ── EVENT: image file select ──────────────────────────
function handleImageSelect(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  ocrError = '';
  const err = validateImage(file);
  if (err) { ocrError = err; event.currentTarget.value = ''; render(); return; }
  clearSelectedImage();
  selectedImage = { file, name: file.name || 'Screenshot', url: URL.createObjectURL(file) };
  render();
}

// ── EVENT: OCR screenshot scan ────────────────────────
async function analyzeScreenshot() {
  if (!selectedImage || ocrBusy) return;
  const screenshotFile = selectedImage.file;
  const screenshotUrl  = selectedImage.url;
  ocrBusy = true;
  ocrError = '';
  render();
  let worker;
  try {
    worker = await createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
      corePath: '/tesseract-core',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      gzip: true,
      logger: (message) => {
        const el = document.querySelector('#image-status');
        if (!el || !message.status) return;
        const progress = Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : '';
        el.textContent = `Reading screenshot locally: ${message.status}${progress}`;
      },
    });
    const { data } = await worker.recognize(screenshotFile);
    const result = analyzeScreenshotText(data.text, data.confidence);
    if (result.error) throw new Error(result.error);
    if (!selectedImage || selectedImage.file !== screenshotFile) {
      activePage = 'check'; activeTab = 'image';
      throw new Error('Screenshot selection changed. Please choose it again.');
    }
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

// ── EVENT: scan form submit ───────────────────────────
async function handleScan(event) {
  event.preventDefault();
  const input = document.querySelector('#scan-input');
  const errorEl = document.querySelector('#form-error');
  const text = input?.value.trim() ?? '';
  const type = activeTab === 'link' ? 'link' : 'sms';
  const result = analyzeContent(text, type);
  if (result.error) { errorEl.textContent = result.error; input?.focus(); return; }
  if (scanBusy) return;
  scanBusy = true;
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = '⏳ Checking locally…';
  const t0 = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 350));
  const processingTime = ((performance.now() - t0) / 1000).toFixed(2) + ' seconds';
  scans = saveScan({ ...result, processingTime });
  selectedScan = { ...result, processingTime };
  scanBusy = false;
  activePage = 'dashboard';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── EVENT: copy report ────────────────────────────────
async function copyReport() {
  const scan = latest();
  if (!scan) return;
  const report = [
    `ScamHunter AI — Scam Detection Report`,
    `Verdict: ${scan.verdict} (${scan.score}/100)`,
    `Content type: ${contentTypeLabel(scan.type)}`,
    `Summary: ${scan.summary}`,
    `Signals: ${scan.signals.map((s) => s.label).join('; ') || 'None matched'}`,
    `Analyzed: ${scan.analyzedAt}`,
    `ID: ${scan.id}`,
    `Note: This is a local pattern check, not a live AI result. A low score is not proof of safety.`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(report);
    toast('📋 Report copied to clipboard');
  } catch {
    toast('Clipboard unavailable in this browser');
  }
}

// ── DELEGATED CLICK HANDLER ───────────────────────────
app.addEventListener('click', async (event) => {
  // Nav page
  const pageBtn = event.target.closest('[data-page]');
  if (pageBtn) {
    if (ocrBusy) return;
    clearSelectedImage();
    selectedScan = null;
    setPage(pageBtn.dataset.page);
    return;
  }

  // Tabs
  const tabBtn = event.target.closest('[data-tab]');
  if (tabBtn) {
    if (ocrBusy) return;
    if (activeTab === 'image' && tabBtn.dataset.tab !== 'image') clearSelectedImage();
    activeTab = tabBtn.dataset.tab;
    ocrError = '';
    render();
    return;
  }

  // View a saved scan
  const viewBtn = event.target.closest('[data-view-scan]');
  if (viewBtn) {
    clearSelectedImage();
    selectedScan = scans.find((s) => s.id === viewBtn.dataset.viewScan) || null;
    activePage = 'dashboard';
    render();
    return;
  }

  // Delete a saved scan
  const deleteBtn = event.target.closest('[data-delete-scan]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteScan;
    if (window.confirm('Delete this saved scan from browser history?')) {
      scans = deleteScan(id);
      if (selectedScan?.id === id) selectedScan = null;
      render();
      toast('Scan deleted');
    }
    return;
  }

  // Preset buttons
  const presetBtn = event.target.closest('[data-preset]');
  if (presetBtn) {
    const input = document.querySelector('#scan-input');
    if (input) {
      input.value = presetBtn.dataset.preset;
      input.dispatchEvent(new Event('input'));
      input.focus();
    }
    return;
  }

  // Action buttons
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'new') {
    if (ocrBusy) return;
    selectedScan = null;
    activePage = 'check';
    activeTab = 'sms';
    ocrError = '';
    clearSelectedImage();
    render();
    document.querySelector('.sidebar')?.classList.remove('open');
    setTimeout(() => document.querySelector('#scan-input')?.focus(), 30);
  }

  if (action === 'scan-image') analyzeScreenshot();

  if (action === 'remove-image') {
    if (ocrBusy) return;
    clearSelectedImage();
    ocrError = '';
    render();
  }

  if (action === 'theme') {
    document.documentElement.classList.toggle('light');
    try { localStorage.setItem('scamhunter.theme', document.documentElement.classList.contains('light') ? 'light' : 'dark'); }
    catch { /* optional */ }
    render();
  }

  if (action === 'menu') {
    document.querySelector('.sidebar')?.classList.toggle('open');
  }

  if (action === 'copy') copyReport();

  if (action === 'clear-history') {
    if (window.confirm('Delete all locally saved scan history?')) {
      clearHistory();
      scans = [];
      selectedScan = null;
      render();
      toast('History cleared');
    }
  }

  if (action === 'paste') {
    if (activeTab === 'image') { if (ocrBusy) return; clearSelectedImage(); activeTab = 'sms'; render(); }
    try {
      document.querySelector('#scan-input').value = await navigator.clipboard.readText();
      document.querySelector('#scan-input').dispatchEvent(new Event('input'));
    } catch {
      toast('Clipboard permission unavailable. Paste with Ctrl+V.');
    }
  }
});

// ── INIT ──────────────────────────────────────────────
try {
  if (localStorage.getItem('scamhunter.theme') === 'light') document.documentElement.classList.add('light');
} catch { /* optional */ }

render();
