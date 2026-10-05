const RULES = [
  { id: 'urgency', label: 'Urgent or threatening language', group: 'pressure', points: 14, pattern: /\b(urgent|immediately|act now|expires? today|within\s+\d+\s*(?:hours?|minutes?|days?)|blocked|suspended|limited time|final warning|tonight|urgent action|last chance|shortly|without delay)\b/i, advice: 'Pause before acting. Scammers use time pressure to stop you checking independently.' },
  { id: 'disconnection', label: 'Threatened service or account disconnection', group: 'pressure', points: 28, pattern: /\b((?:power|electricity|supply|connection|service|water|gas|account|sim|mobile(?: number)?)\s+(?:will\s+)?(?:be\s+)?(?:cut|disconnected|suspended|closed|terminated|disabled|blocked|deactivated)|disconnect(?:ed|ion)|cutoff|cut off)\b/i, advice: 'Verify disconnection threats directly with the organization using official contact info from your bill or official website.' },
  { id: 'utility-impersonation', label: 'Utility or regulatory impersonation', group: 'identity', points: 18, pattern: /\b(?:electricity|power|water|gas|utility|electricit[iy]|electric|supply)\s+(?:office|department|board|authority|commission|corporation|company)|(?:power|electricity|water|gas)\s+(?:department|board|office|authority)|\b(?:TRAI|DOT|Telecom)\b/i, advice: 'Never trust utility or regulatory contact details in a message. Use the official website.' },
  { id: 'bill-arrears', label: 'Bill overdue, unpaid, or not updated', group: 'money', points: 16, pattern: /\b(?:(?:previous\s+)?month\s+)?bill\s+(?:was\s+)?not\s+(?:updated|paid|received)|unpaid\s+bill|overdue\s+bill|bill\s+(?:overdue|unpaid|past due)|bill\s+payment\s+(?:overdue|due|required)|payment\s+overdue|arrears\b/i, advice: 'Contact the organization directly using the contact number on your bill. Do not use numbers in the message.' },
  { id: 'credentials', label: 'Requests sensitive credentials or verification codes', group: 'credentials', points: 26, pattern: /\b(otp|one[- ]time password|verification code|security code|password|passcode|cvv|pin number|atm pin|mfa code|2fa code|authenticator code)\b/i, advice: 'Never share an OTP, PIN, password, or verification code. Legitimate support will not ask you to disclose one.' },
  { id: 'payment', label: 'Money, payment, or account action mentioned', group: 'money', points: 10, pattern: /\b(pay(?:ment)?|transfer|fee|refund|bank account|account number|upi|wallet|invoice|payment failed|debit|credit)\b|₹|\bINR\b/i, advice: 'Verify payment or account requests using the official app or a number you already trust.' },
  { id: 'payment-lure', label: 'Unusual payment method or fee demanded', group: 'money', points: 18, pattern: /\b(?:pay|send|transfer)\s+(?:a\s+)?(?:small\s+)?(?:fee|deposit|tax|charge|processing fee)|\b(?:scan|use)\s+(?:this\s+)?qr\s+(?:code\s+)?to\s+pay|\bpay\s+to\s+(?:receive|release|unlock)\b|\bpayment\s+(?:to\s+)?(?:personal|private)\s+(?:upi|wallet|account)\b|\b(?:registration|recharge|training)\s+fee\b/i, advice: 'Do not pay fees or scan payment QR codes from unexpected messages. Check through the official app or contact.' },
  { id: 'prize', label: 'Unexpected prize or reward claim', group: 'prize', points: 20, pattern: /\b(you(?:'| a)?re the winner|won|winner|prize|lottery|cashback|reward|gift card|claim your|kbc|lucky draw)\b/i, advice: 'Unexpected prizes that require a fee or personal details are a common scam tactic.' },
  { id: 'impersonation', label: 'Brand, bank, or authority impersonation language', group: 'identity', points: 10, pattern: /\b(bank|SBI|HDFC|ICICI|Axis|Airtel|Paytm|PhonePe|government|income tax|police|customs|courier|support team|parcel|delivery)\b/i, advice: 'Contact the organization using its official app or website—not details in the message.' },
  { id: 'account-recovery', label: 'Account/KYC recovery or verification threat', group: 'identity', points: 18, pattern: /\b(?:kyc|account|sim|card|wallet|pan|aadhaar)\s+(?:will\s+be\s+)?(?:blocked|suspended|deactivated|expired)|\b(?:update|verify|reactivate)\s+(?:your\s+)?(?:kyc|account|pan|aadhaar|aadhar|sim)\b|\baccount\s+verification\s+(?:required|failed)\b/i, advice: 'Do not use message links to update KYC or recover an account. Open the official app or type its known website address yourself.' },
  { id: 'delivery-toll', label: 'Unexpected delivery, customs, or road-toll payment notice', group: 'money', points: 18, pattern: /\b(?:parcel|package|shipment|delivery|customs|toll|e-?challan|fedex|bluedart|dhl)\b.{0,65}\b(?:fee|pay|payment|hold|release|redelivery|fine|unpaid|address|seized|illegal)\b|\b(?:fee|payment|redelivery|fine|seized)\b.{0,65}\b(?:parcel|package|shipment|delivery|customs|toll|e-?challan|fedex|bluedart)\b/i, advice: 'Check delivery or toll charges only in the carrier or government service’s official app/site. Do not pay through an unexpected SMS link.' },
  { id: 'threat', label: 'Threat of legal action or arrest (Digital Arrest)', group: 'pressure', points: 24, pattern: /\b(arrest|warrant|legal action|police complaint|jail|prosecution|account will be closed|freeze your account|digital arrest|narcotics|cbi|fir|supreme court|interpol)\b/i, advice: 'Threats of immediate arrest over phone or messages are a classic intimidation tactic (e.g., Digital Arrest scams). Verify through official channels in person.' },
  { id: 'remote-access', label: 'Request to install remote-access software or share screen', group: 'credentials', points: 25, pattern: /\b(?:install|download)\s+(?:anydesk|teamviewer|quick.?support|remote access|screen.?sharing|rustdesk|\*21\*)|\b(?:share|allow|give)\s+(?:me\s+)?(?:your\s+)?screen|\bremote\s+access\s+(?:to|app|software)\b/i, advice: 'Do not install remote-access apps, share your screen, or dial forwarding codes (*21*) at an unsolicited caller’s request.' },
  { id: 'job-task-scam', label: 'Unexpected job/task offer with easy earnings or deposit', group: 'money', points: 20, pattern: /\b(?:part.?time|online|wfh)\s+(?:job|work|task)|\b(?:like|rate|review)\s+(?:videos?|products?|posts?|movies?|hotels?|restaurants?)\b.{0,60}\b(?:earn|daily|income|commission|payment)\b|\b(?:earn|make)\s+(?:₹|INR|\$)?\s?\d[\d,]*\s+(?:daily|per day|in minutes)\b|\b(?:registration|recharge|training)\s+fee\b|\bregistration fee\b|\btelegram task|whatsapp task\b/i, advice: 'Treat unsolicited jobs promising easy income for liking videos/maps or asking for deposits as suspicious. Verify independently.' },
  { id: 'investment-lure', label: 'Guaranteed investment or crypto returns', group: 'money', points: 20, pattern: /\b(?:guaranteed|risk.?free|fixed)\s+(?:profit|returns?|income)|\bdouble\s+(?:your\s+)?(?:money|investment)|\b(?:crypto|bitcoin|forex|trading|share market|stocks?|upper circuit)\b.{0,55}\b(?:guaranteed|profit|returns?|signal|deposit|premium group|vip group)\b/i, advice: 'No investment return is guaranteed. Beware of VIP WhatsApp/Telegram trading groups.' },
  { id: 'named-officer', label: 'Requests contact with a named officer or unknown person', group: 'identity', points: 16, pattern: /\b(?:contact|call|reach\s+out\s+to|speak\s+with)\s+(?:our\s+)?(?:\w+\s+)?(?:officer|manager|representative|person|staff|agent|inspector|commissioner)\s+(?:Mr|Mrs|Ms|Dr|[A-Z][a-z]+)|\bcontact\s+[A-Z][a-z]+\s+(?:at\s+)?(?:\d{10}|\+\d{1,3}\s*\d{10})/i, advice: 'Do not contact numbers or people unknown to you. Use the organization’s official contact details.' },
  { id: 'shortlink', label: 'Shortened URL hides its destination', group: 'link', points: 14, pattern: /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|buff\.ly|cutt\.ly|rb\.gy|lnkd\.in)\//i, advice: 'Short links conceal their destination. Do not open one unless you can verify the sender and destination.' },
  { id: 'ip-url', label: 'URL uses a raw IP address', group: 'link', points: 25, pattern: /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/|$)/i, advice: 'A raw IP address is unusual for consumer services. Do not open it unless you can independently verify it.' },
  { id: 'punycode', label: 'URL uses an encoded internationalized domain name', group: 'link', points: 18, pattern: /https?:\/\/[^\s/]*xn--[^\s/]*(?:\/|$)/i, advice: 'Encoded internationalized domains can obscure lookalike characters. Check the exact registered domain independently.' },
  { id: 'odd-tld', label: 'URL uses a less familiar domain ending', group: 'link', points: 10, pattern: /\.(?:xyz|top|click|work|buzz|gq|ml|cf|tk|ga|shop|rest|fit|support|vip)(?::\d+)?(?:\/|$)/i, advice: 'A domain ending alone does not prove fraud. Verify the exact registered domain independently.' },
  { id: 'lookalike', label: 'Possible lookalike brand spelling', group: 'link', points: 26, pattern: /\b(?:amaz0n|arnazon|paypa1|paypai|googl3|g00gle|faceb00k|micr0soft|netf1ix|app1e|airte1|sbi[-.]?kyc|pnb|yono)\b/i, advice: 'Lookalike spellings can impersonate trusted brands. Navigate to the official site yourself.' },
  { id: 'http', label: 'Link does not use HTTPS', group: 'link', points: 8, pattern: /^http:\/\//i, advice: 'HTTP is not encrypted in transit. HTTPS also does not prove a site is legitimate—verify the domain before entering information.' },
  { id: 'suspicious-subdomain', label: 'URL contains a brand name in an unfamiliar domain', group: 'link', points: 18, pattern: /https?:\/\/[^/]*(?:sbi|hdfc|icici|paytm|amazon|google|airtel|flipkart|phonepe|jio|vi)[^/]*\.(?:xyz|top|click|work|site|online|info|support|vip)(?:\/|$)/i, advice: 'Brand words inside a URL do not make it official. Check the registered domain carefully.' },
  { id: 'url-userinfo', label: 'URL contains a misleading username or password section', group: 'link', points: 20, pattern: /https?:\/\/[^/\s@]+:[^/\s@]+@/i, advice: 'URLs with username/password text before the @ can disguise the actual destination. Do not open; verify the domain.' },
];

const EXPLICIT_URL = /https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const BARE_DOMAIN = /(?:^|[\s(])((?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:com|org|net|edu|gov|in|co|io|app|info|biz|xyz|top|site|online|click|work|shop|support|vip)(?::\d+)?(?:\/[\w~:/?#[\]@!$&'()*+,;=%.-]*)?)/gi;
const LINK_RULES = RULES.filter((rule) => rule.group === 'link');

export function extractUrls(text) {
  const found = [];
  const seen = new Set();
  for (const match of text.matchAll(EXPLICIT_URL)) {
    const value = match[0].replace(/[),.!?;:]+$/, '');
    if (!seen.has(value.toLowerCase())) { found.push({ value, index: match.index ?? 0 }); seen.add(value.toLowerCase()); }
  }
  for (const match of text.matchAll(BARE_DOMAIN)) {
    const value = match[1].replace(/[),.!?;:]+$/, '');
    const start = (match.index ?? 0) + match[0].indexOf(match[1]);
    if (!seen.has(value.toLowerCase())) { found.push({ value, index: start }); seen.add(value.toLowerCase()); }
  }
  return found.sort((a, b) => a.index - b.index);
}

function linkTextFor(text, type, urls) {
  if (type === 'link') return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return urls.map(({ value }) => /^https?:\/\//i.test(value) ? value : `https://${value}`).join(' ');
}

export function analyzeContent(rawText, type = 'sms') {
  const text = String(rawText ?? '').trim();
  if (!text) return { error: 'Paste a message or URL to scan.' };
  if (!['sms', 'link'].includes(type)) return { error: 'Choose message or URL analysis.' };
  if (type === 'link') {
    const candidate = text.match(/^(?:https?:\/\/)?[^\s]+$/i)?.[0];
    if (!candidate) return { error: 'Enter one URL without spaces.' };
    const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') throw new Error('invalid host');
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    } catch {
      return { error: 'That does not look like a valid web URL. Try a domain such as example.com.' };
    }
  }

  const urls = extractUrls(text);
  const inspected = linkTextFor(text, type, urls);
  const found = [];
  for (const rule of RULES) {
    const testText = rule.group === 'link' ? inspected : text;
    rule.pattern.lastIndex = 0;
    const match = testText.match(rule.pattern);
    if (!match) continue;
    found.push({ id: rule.id, label: rule.label, points: rule.points, advice: rule.advice, matchedText: match[0] });
  }
  const score = Math.min(100, found.reduce((sum, item) => sum + item.points, 0));
  const level = score >= 61 ? 'High risk' : score >= 31 ? 'Suspicious' : 'Lower risk';
  const verdict = score >= 61 ? 'Likely scam' : score >= 31 ? 'Use caution' : 'No strong signals';
  const evidence = found.map((item) => ({ label: item.label, text: `“${item.matchedText}”` }));
  const recommendations = found.length
    ? [...new Set(found.map((item) => item.advice))]
    : ['No strong scam patterns were found. This is not proof the message or link is safe.', 'Verify unexpected requests through the organization’s official app or a contact method you already trust.', 'Never share OTPs, passwords, or PINs with anyone.'];

  return {
    text,
    type,
    score,
    level,
    verdict,
    confidenceLabel: found.length >= 3 ? 'Multiple signals' : found.length ? 'Some signals' : 'Limited signals',
    signals: found.map(({ matchedText, ...signal }) => signal),
    evidence,
    recommendations,
    urls: (type === 'link' ? [{ value: inspected }] : urls).map(({ value }) => value),
    summary: found.length
      ? `Local pattern checks found ${found.length} signal${found.length === 1 ? '' : 's'} in this ${type === 'sms' ? 'message' : 'URL'}. The score is a heuristic, not a probability or confirmation of fraud.`
      : `Local pattern checks found no strong known signals in this ${type === 'sms' ? 'message' : 'URL'}. New or context-specific scams may not be detected.`,
    analyzedAt: new Date().toISOString(),
    id: `SH-${Date.now().toString(36).toUpperCase()}`,
  };
}

export const detectionPatterns = RULES.map(({ id, label, points }) => ({ id, label, points }));
