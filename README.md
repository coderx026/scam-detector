# ScamHunter — Message & Link Pattern Checker

A responsive, local-first dashboard for checking scam patterns in SMS/message text and web addresses. This tool surfaces clues; it does not determine whether a message is genuine.

## Run on Windows PowerShell

```powershell
cd C:\Users\ASUS\scam-detector
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). To create a production build:

```powershell
npm run build
npm run preview
```

## What it does

- Analyze pasted SMS/message text, a single URL, or an uploaded screenshot with local pattern checks.
- Extract visible screenshot text using browser-side Tesseract.js OCR, then scan it as message text; OCR is text extraction, not image understanding.
- Show a heuristic score, matched indicators, evidence text, and practical safety suggestions.
- View scan history saved in this browser, inspect past results, and clear history.
- Use Dashboard, Check Request, History, Pattern Analysis, Risk Assessment and Evidence Report sections, plus light/dark mode.

## Detection patterns

The scanner checks a curated set of **local text patterns** for common scam tactics, including urgency and threats, credential/OTP theft, account/KYC recovery lures, utility disconnection claims, delivery or toll payment demands, QR/payment lures, remote-access requests, job/task deposits, guaranteed investment returns, prize bait, impersonation terms, and suspicious links/domains. The list is illustrative, not comprehensive or continuously updated. New campaigns and different wording may not match.

Bare domains and explicit links in messages are inspected as text only. The scanner does not open, expand, resolve, or reputation-check submitted links. HTTPS does not mean a site is legitimate. A familiar brand word or unusual domain suffix alone does not establish fraud.

Each matched pattern contributes heuristic points (capped at 100). The score bands are:
- **0–30:** Lower signal (limited patterns detected; not a safety result)
- **31–60:** Suspicious (review signals carefully)
- **61–100:** High signal (multiple scam indicators may be present)

## Important limitations and privacy

This version does **not** use an AI model, server, or live threat-intelligence service. It does not check sender reputation, visit a URL, verify domain ownership, or query recent scam reports. Screenshot scanning uses browser-side Tesseract.js to extract visible English text and then runs the same local message patterns. It does not understand image layout, verify sender identity, or read QR destinations. OCR can misread important characters; check the displayed extracted text.

The score is a heuristic based on a fixed set of local text patterns—not a probability, definitive verdict, or guarantee. A low score does not mean a message or link is safe; a high score does not confirm fraud. Patterns are not automatically refreshed with current campaigns. New scams, context-specific threats, languages, and evolving attack methods may not be detected; false positives are also possible. Always independently verify unexpected requests through official channels (official websites, official phone numbers from your bill or account).

Analysis of the submitted message or link runs in the browser. Submitted text and URL strings are saved in this browser's `localStorage` history until you clear it; do not scan content you do not want retained on this device. Screenshot files must be PNG, JPEG, or WebP and no larger than 5 MB. The image is processed in the browser and is not stored in history. Tesseract.js downloads its worker and English language data from third-party CDNs on first use; its WebAssembly engine is served by this app. The selected screenshot itself is processed in the browser and is not uploaded to ScamHunter or the OCR asset hosts. OCR may be unavailable offline before those assets are cached. Scan history does store extracted text and results in browser `localStorage` until cleared, so do not scan sensitive text you do not want retained.

The app does not navigate to submitted URLs, load external fonts, or send scans to a ScamHunter backend.

## Tests

```powershell
npm test
```

All tests verify local pattern detection, benign-message handling, URL parsing, input validation, browser history persistence, and storage resilience.
