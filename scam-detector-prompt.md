# Scam SMS & Link Detector - Website Prompt

## Project Overview
- **Project Name**: ScamShield - SMS & Link Scanner
- **Type**: Single-page web application
- **Core Functionality**: Analyze SMS messages and URLs to detect potential scams, phishing attempts, and malicious links
- **Target Users**: General public who receive suspicious messages via SMS, WhatsApp, or other messaging platforms

## UI/UX Specification

### Layout Structure
- **Header**: Logo + App name + Dark mode toggle
- **Hero Section**: Main headline with tagline
- **Input Section**: Two tabs - "SMS/Message" and "Link/URL"
- **Results Section**: Risk score display with detailed analysis
- **Footer**: Simple credits

### Responsive Breakpoints
- Mobile: < 768px
- Desktop: >= 768px

### Visual Design

#### Color Palette
- **Background**: #0a0a0f (deep dark)
- **Card Background**: #12121a
- **Primary Accent**: #00d4ff (cyan)
- **Secondary Accent**: #7c3aed (purple)
- **Success**: #10b981 (green)
- **Warning**: #f59e0b (amber)
- **Danger**: #ef4444 (red)
- **Text Primary**: #ffffff
- **Text Secondary**: #94a3b8

#### Typography
- **Font Family**: "Outfit" (Google Fonts)
- **Headings**: Bold, large (2rem+)
- **Body**: Regular, 1rem
- **Code/URL**: Monospace font

#### Visual Effects
- Glassmorphism cards with backdrop-blur
- Gradient borders on active elements
- Subtle glow effects on buttons
- Smooth hover transitions (0.3s)
- Animated scanning effect during analysis

### Components

#### 1. Tab Switcher
- Two tabs: "SMS" and "Link"
- Active tab has gradient underline + glow

#### 2. Input Area
- Large textarea for SMS (min 150px height)
- Input field for URL with paste button
- Character counter for SMS
- Placeholder text with examples

#### 3. Analyze Button
- Gradient background (cyan to purple)
- Hover: Glow effect + slight scale
- Loading state: Spinning animation

#### 4. Results Card
- Animated reveal on result
- Risk meter (0-100%)
- Color-coded risk level:
  - 0-30%: Green (Safe)
  - 31-60%: Yellow (Suspicious)
  - 61-100%: Red (Dangerous)
- Detailed breakdown of detected indicators

#### 5. Detection Indicators
- Icon + text for each indicator found:
  - ⚠️ Urgent language detected
  - 🔗 Suspicious URL pattern
  - 💰 Money/financial keywords
  - 🎁 Too good to be true offers
  - 🔐 Requests sensitive info
  - 📱 Impersonation detected

## Functionality Specification

### Core Features

1. **SMS Analysis**
   - Detect urgent/threatening language
   - Identify financial keywords (money, bank, account, OTP, prize, lottery)
   - Find suspicious phone numbers
   - Check for impersonation patterns (fake customer service)

2. **Link/URL Analysis**
   - Suspicious domain detection (typosquatting)
   - Known phishing patterns
   - Shortened URL warning
   - IP address URLs
   - HTTPS check
   - Suspicious TLDs (.xyz, .top, .click, etc.)

3. **Risk Scoring**
   - Calculate overall risk score (0-100)
   - Provide explanation for each flag

### User Interactions
1. User selects tab (SMS/Link)
2. User enters text or URL
3. User clicks "Analyze" button
4. Loading animation plays (1.5s simulated)
5. Results appear with animation

### Edge Cases
- Empty input: Show validation message
- Very long text: Truncate display but analyze full
- Invalid URL format: Show error message

## Acceptance Criteria
- [ ] Page loads without errors
- [ ] Both tabs work correctly
- [ ] Analyze button triggers scan
- [ ] Results display with correct risk level
- [ ] All animations play smoothly
- [ ] Responsive on mobile and desktop
- [ ] Dark theme looks premium/modern