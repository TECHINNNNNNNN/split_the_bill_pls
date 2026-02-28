# PlaDukKhlongToei — Product Requirements Document (PRD)

## "Scan → Split → Share a link → Friends pay via QR. No app download needed."

**Version:** 1.0
**Last Updated:** February 27, 2026
**Course:** Software Engineering Capstone, Chulalongkorn University ISE

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Competitor Analysis](#3-competitor-analysis)
4. [System Objectives](#4-system-objectives)
5. [User Types & Auth Strategy](#5-user-types--auth-strategy)
6. [Architecture & Tech Stack](#6-architecture--tech-stack)
7. [Key Libraries & Technical Tools](#7-key-libraries--technical-tools)
8. [Database Schema](#8-database-schema)
9. [Core User Flows](#9-core-user-flows)
10. [Payment Verification System](#10-payment-verification-system)
11. [Reminder System](#11-reminder-system)
12. [VAT & Service Charge Calculation Engine](#12-vat--service-charge-calculation-engine)
13. [Shared Bill Page (The Product)](#13-shared-bill-page-the-product)
14. [Wow Factors & Micro-Interactions](#14-wow-factors--micro-interactions)
15. [API Endpoints](#15-api-endpoints)
16. [Sprint Plan](#16-sprint-plan)
17. [Team Roles](#17-team-roles)
18. [Open Items & Future Features](#18-open-items--future-features)

---

## 1. Product Overview

PlaDukKhlongToei is a mobile-first web application for splitting bills among Thai Gen-Z students. The payer (one person) scans a receipt, assigns items to friends, and shares a single link. Friends click the link, see their share, scan a PromptPay QR code, and pay — no account, no app download, no sign-up.

### Core Differentiator

We are NOT a "polished Khunthong." We are architecturally different:

- **Khunthong** is a LINE chatbot imprisoned inside LINE. It cannot exist outside LINE.
- **PlaDukKhlongToei** is a standalone web platform. One link works in LINE, WhatsApp, iMessage, Instagram DM, email — anywhere.

| Feature | Calculator + LINE | Khunthong | Splitwise | **PlaDukKhlongToei** |
|---------|-------------------|-----------|-----------|---------------------|
| Account required for friends | N/A | LINE group required | Account required | **No account needed** |
| VAT/Service charge handling | Manual | Struggles with VAT | Manual | **Automatic, transparent** |
| Receipt OCR | No | Yes (limited) | Pro only | **Yes (AI-powered)** |
| Platform lock-in | None | LINE only | App required | **Any browser, any platform** |
| Expense history | None | Per-bill only | Yes | **Yes, with dashboard** |
| Payment method | Manual transfer | K PLUS / PromptPay | In-app (paywalled) | **PromptPay QR (all banks)** |
| Thai localization | N/A | Thai only | English only | **Thai + English** |

### What We Don't Compete On

- **Distribution:** We can't beat Khunthong's LINE integration (54M Thai users)
- **Feature depth:** We can't out-feature Splitwise in 8 weeks
- **Speed for simple splits:** A calculator is still faster for equal splits

### What Makes Us Win

1. **The shared link model** — Friends never sign up, never download, never create accounts
2. **Transparent VAT/service charge** — Shows exact math, builds trust
3. **PromptPay QR on every share page** — One scan to pay, works with ALL Thai banks
4. **Automated slip verification** — OpenVerifySlip API + Mini QR extraction verifies payments against bank records. No manual checking needed.
5. **Native LINE integration** — LIFF Share Target Picker sends rich Flex Messages directly into LINE chats. 95% of Thai Gen-Z use LINE.
6. **Real-time multiplayer** — PartyKit WebSockets turn the bill page into a live experience. All participants see updates instantly.
7. **Mobile-first gestures** — Drag-to-claim, swipe actions, haptic feedback via `motion`. Feels native, runs in browser.
8. **Expense history** — Turns one-time utility into recurring tool
9. **Purpose-built UI** — Not constrained by chatbot limitations

---

## 2. Problem Statement

Thai Gen-Z students default to calculators + LINE for bill splitting — not because they love it, but because existing alternatives are worse. From 70 survey responses + 10 interviews:

### Top Pain Points

1. Late payments / people forgetting
2. Confusion about who owes whom
3. Calculation errors (especially with VAT and service charge)
4. Awkwardness of sending payment reminders

### Adoption Killers

1. Too complicated to set up
2. Too slow (more steps than a calculator)
3. Privacy concerns (connecting social accounts)
4. Cost (paywalled features)

---

## 3. Competitor Analysis

### Calculator + LINE (The Default)

- **Pros:** Zero setup, everyone has it
- **Cons:** Manual calculation, no validation, receipts buried in chat, no history, error-prone

### Khunthong (LINE Bot by KBank)

- **Pros:** Lives in LINE (zero adoption cost), payment slip verification, K PLUS integration
- **Cons:** Requires everyone in same LINE group, processes bills in isolation (multiple transfers per meal), OCR struggles with VAT/service charge, tedious unequal splitting, Thai-only, no expense history

### Splitwise

- **Pros:** Global leader, comprehensive features, debt simplification
- **Cons:** Complex UI, key features paywalled, requires all users to create accounts, no Thai localization, no PromptPay, no Thai QR support

---

## 4. System Objectives

1. **AI-assisted bill splitting with OCR** — Scan Thai receipts, extract items + VAT + service charge (handled by AI team, not lead dev)
2. **Frictionless sharing** — Payer shares ONE link. Friends click, see amount owed + PromptPay QR. No sign-up required.
3. **Transparent calculation** — Show exact breakdown: subtotal → VAT 7% → service 10% → proportional distribution per person
4. **Expense history & financial summary** — Track spending over time, by group, with totals

---

## 5. User Types & Auth Strategy

### Payer (Creates Bills)

**Must sign up.** Needs persistent data: groups, bills, expense history, PromptPay ID.

**Auth Options (maximum choice — differentiator vs. Khunthong):**

| Provider | Why |
|----------|-----|
| Google OAuth | Primary — ISE students use Google Workspace |
| Apple Sign-In | iOS-first users, required for App Store if we ever go native |
| LINE Login | Thai localization, familiar to Thai users, opens LINE ecosystem |
| Email/Password | Fallback for anyone who doesn't want social login |

**Implementation:** Use a robust auth library (better-auth or next-auth) that supports multiple providers via config, not custom code per provider.

**Data collected from payer:**
- Display name (auto-populated from social login)
- Profile picture (auto-populated from social login)
- Email
- PromptPay ID (phone number or national ID — entered manually during onboarding)

### Friend (Pays Bills)

**NEVER logs in. NEVER creates an account.**

The entire friend experience happens on a single shared web page:
1. Click link from group chat
2. See the bill breakdown
3. Tap their name
4. See their share + PromptPay QR
5. Pay via banking app
6. Tap "I've Paid"

**Optional data from friend:**
- Push notification subscription (browser prompt)
- Nothing else

### Guest-to-User Conversion (V2)

A friend who uses the app frequently can optionally sign up later and claim their guest history. Nice-to-have, not MVP.

---

## 6. Architecture & Tech Stack

### Monorepo Structure (Turborepo + pnpm workspaces)

```
pladuk/
├── apps/
│   ├── web/                    # Next.js 14 (App Router) — Vercel
│   │   ├── app/
│   │   │   ├── (auth)/         # Auth pages (login, register)
│   │   │   ├── (dashboard)/    # Payer dashboard (groups, bills, history)
│   │   │   ├── bill/
│   │   │   │   └── [token]/    # Public shared bill page (SSR, no auth)
│   │   │   │       ├── page.tsx
│   │   │   │       └── opengraph-image.tsx  # Dynamic OG image
│   │   │   └── api/            # Next.js API routes (OG image, webhooks)
│   │   ├── public/
│   │   │   ├── manifest.json   # PWA manifest
│   │   │   └── sw.js           # Service worker (push notifications)
│   │   └── next.config.ts
│   │
│   └── server/                 # Hono API — Railway
│       ├── src/
│       │   ├── index.ts        # Hono app entry
│       │   ├── routes/         # API route handlers
│       │   ├── middleware/      # Auth, CORS, rate limiting
│       │   ├── services/       # Business logic
│       │   └── db/
│       │       ├── schema.ts   # Drizzle schema
│       │       └── migrations/ # Database migrations
│       └── drizzle.config.ts
│
├── packages/
│   └── shared/                 # Shared TypeScript types & Zod schemas
│       ├── types/              # API request/response types
│       ├── schemas/            # Zod validation schemas
│       └── utils/              # Shared utilities (calculation engine, etc.)
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Tech Stack Details

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 14 (App Router) | SSR for shared bill pages (SEO + OG images), file-based routing, Vercel deploy |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design system, mobile-first |
| **Backend** | Hono | Lightweight, TypeScript-native, runs anywhere, minimal boilerplate |
| **ORM** | Drizzle | Type-safe, SQL-like syntax, lightweight, excellent TypeScript support |
| **Database** | PostgreSQL (Railway) | Relational data (groups, bills, items, payments), robust, free tier on Railway |
| **Validation** | Zod (shared package) | Runtime type validation, shared between frontend + backend |
| **Auth** | better-auth or next-auth | Multi-provider OAuth (Google, Apple, LINE), session management |
| **QR Generation** | `promptparse` + `qrcode` | PromptPay EMVCo payload generation + QR image rendering (replaces promptpay-qr) |
| **QR Scanning** | `html5-qrcode` + Barcode Detection API | Extract Mini QR from slip images (client-side) |
| **Slip Verification** | OpenVerifySlip API + `promptparse` | Automated payment verification against Bank of Thailand records |
| **Image Optimization** | `browser-image-compression` | Client-side compression before upload (8MB → 800KB) |
| **OCR** | Tesseract.js (client preview) + AI team (server) | Two-stage: instant preview + accurate structured extraction |
| **Animations** | `motion` (Framer Motion) | Drag gestures, layout animations, spring physics, exit animations |
| **Toasts** | `sonner` | shadcn/ui official toast, promise-based, beautiful defaults |
| **URL State** | `nuqs` | Type-safe URL query state management for Next.js |
| **Real-Time** | PartyKit | WebSocket rooms for live bill updates, auto-reconnect, edge-deployed |
| **LINE Integration** | `@line/liff` | Share Target Picker, LINE profile access, native LINE sharing |
| **Page Transitions** | View Transition API | Native browser morphing animations, progressive enhancement |
| **Push Notifications** | `web-push` + Service Worker (VAPID) | Browser push notifications without app install |
| **Confetti** | `canvas-confetti` | Celebration animation when bill is fully paid |
| **Monorepo** | Turborepo + pnpm workspaces | Shared types, parallel builds, efficient dependency management |
| **Deploy (Frontend)** | Vercel | Free tier, automatic deploys, edge functions for OG images |
| **Deploy (Backend + DB)** | Railway | PostgreSQL hosting, Hono deployment, free tier |
| **Deploy (Real-Time)** | PartyKit Cloud | WebSocket server hosting, global edge network, free tier |

---

## 7. Key Libraries & Technical Tools

These are the "boundaries-pushing" tools that make the app possible with less code. Every library here has been individually verified for production readiness, active maintenance, and npm download health.

### `promptparse` (npm) — PRIMARY QR LIBRARY ⭐

**What:** All-in-one library for PromptPay & EMVCo QR codes. Can **parse**, **generate**, **manipulate**, and **validate** QR data. **Replaces `promptpay-qr`** with zero dependencies and broader functionality.

**QR Generation (replaces promptpay-qr):**
```ts
import { generate } from 'promptparse'

// Generate QR payload for ฿350.50 to phone number
const payload = generate({ mobileNumber: '0812345678', amount: 350.50 })
// payload is a string — render it as a QR code image
```

**Key feature — Slip Verify (V1 — enabled by OpenVerifySlip API):**
```ts
import { slipVerify } from 'promptparse/validate'

// Validate transfer slip Mini QR code
const data = slipVerify('00550006000001...')
if (!data) {
  console.error('Invalid slip')
}
const { sendingBank, transRef } = data
// Use transRef to cross-reference with OpenVerifySlip API
```

**Privacy note:** The QR code contains the payer's PromptPay ID (phone number or national ID). Users must be informed of this.

### `html5-qrcode` (npm) — BROWSER QR SCANNER 🔥

**What:** Scan QR codes from camera feed or static images directly in the browser. Essential for extracting Mini QR data from transfer slip photos.

```ts
import { Html5Qrcode } from 'html5-qrcode'

// Scan QR from uploaded slip image
const html5QrCode = new Html5Qrcode("reader")
const result = await html5QrCode.scanFile(slipImageFile, /* showImage */ true)
// result = raw Mini QR payload string
// Feed into promptparse.slipVerify() for parsing
```

**Use case:** When a friend uploads a transfer slip, extract the Mini QR before sending to the server. This enables client-side pre-validation and instant feedback.

### OpenVerifySlip API (External API) — SLIP VERIFICATION 🔥

**What:** Free API by OpenVerifySlip for verifying Thai bank transfer slips against Bank of Thailand records. **500 requests/day free tier.**

```ts
// Server-side verification
const response = await fetch('https://api.openverifyslip.com/v1/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENVERIFYSLIP_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ transRef, sendingBank })
})

const result = await response.json()
// { success: true, amount: 250.00, receivingBank: "SCB", transTime: "..." }
```

**Why this is a V1 game-changer:** Combined with `promptparse` + `html5-qrcode`, this creates a complete automated slip verification pipeline. No competitor in the Thai market has this in a web-based bill splitter.

**Upgrade path (V2):** EasySlip API (developer.easyslip.com) for higher volume, duplicate detection, and production SLA.

### `browser-image-compression` (npm) — IMAGE OPTIMIZATION

**What:** Client-side image compression before upload. Reduces 8MB phone photos to ~800KB without visible quality loss.

```ts
import imageCompression from 'browser-image-compression'

const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true
}
const compressedFile = await imageCompression(receiptImage, options)
// Upload compressedFile instead of original
```

**Why:** Thai receipts photographed on phones are often 5-10MB. Compressing client-side saves bandwidth, speeds up upload, and reduces server storage costs.

### LINE LIFF SDK (`@line/liff`) — NATIVE LINE SHARING 🔥

**What:** LINE Front-end Framework. Enables **Share Target Picker** — native LINE friend/group selector that sends rich Flex Messages directly into LINE chats.

```ts
import liff from '@line/liff'

await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID })

if (liff.isApiAvailable('shareTargetPicker')) {
  await liff.shareTargetPicker([{
    type: 'flex',
    altText: 'ปลาดุกคลองเตย — คุณต้องจ่าย ฿250',
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: '🐟 ปลาดุกคลองเตย', weight: 'bold', size: 'xl' },
          { type: 'text', text: 'ส่วนของคุณ: ฿462.50', color: '#10b981', weight: 'bold' }
        ]
      },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button',
          action: { type: 'uri', label: 'ดูรายละเอียด', uri: billUrl },
          style: 'primary'
        }]
      }
    }
  }])
}
```

**Why this is THE differentiator:** 95% of Thai Gen-Z use LINE. Share Target Picker sends a beautiful card message — not a plain URL — directly to a friend's LINE chat. It appears as if the payer sent it natively. Friends tap "View Details" and land on the bill page. No competitor has this.

**Requirements:** LINE Login channel (free) + LIFF app registration in LINE Developers Console.

### `motion` (formerly Framer Motion) — PRODUCTION ANIMATIONS 🔥

**What:** The industry-standard React animation library. 30M+ downloads/month. Used by Framer, Figma, Vercel.

```tsx
import { motion } from 'motion/react'

// Drag-to-claim menu items (mobile-first gesture)
<motion.div
  drag
  whileDrag={{ scale: 1.05, boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }}
  dragConstraints={{ left: 0, right: 300 }}
  onDragEnd={(e, info) => {
    if (isOverDropZone(info.point)) claimItem(itemId, userId)
  }}
>
  <MenuItemCard name="ข้าวผัดกระเพรา" price={65} />
</motion.div>

// Smooth list reordering when items get claimed
<motion.div layout transition={{ type: 'spring', stiffness: 300 }}>
  {items.map(item => (
    <motion.div key={item.id} layout>{item.name}</motion.div>
  ))}
</motion.div>
```

**Use cases for bill splitting:** Drag-to-claim items, smooth payment status transitions, swipe-to-mark-paid gestures, scroll-triggered item reveals, and exit animations for paid items.

### `sonner` (npm) — TOAST NOTIFICATIONS

**What:** The official shadcn/ui toast component. 8M+ weekly downloads. Created by Emil Kowalski.

```ts
import { toast } from 'sonner'

// Basic
toast.success('ชำระเงินสำเร็จ!')

// With promise (loading → success/error)
toast.promise(verifySlip(transRef), {
  loading: 'กำลังตรวจสอบสลิป...',
  success: 'ยืนยันการชำระเงินแล้ว ✅',
  error: 'ไม่สามารถตรวจสอบสลิปได้'
})
```

**Why not react-hot-toast:** Sonner is the shadcn/ui default, has better animations, smaller bundle (2-3KB), and supports promise-based toasts natively.

### `nuqs` (npm) — URL STATE MANAGEMENT

**What:** Type-safe URL query state management for Next.js. 1.6M+ weekly downloads.

```ts
import { useQueryState, parseAsStringEnum } from 'nuqs'

// Dashboard filters stored in URL
const [status, setStatus] = useQueryState(
  'status',
  parseAsStringEnum(['all', 'unpaid', 'claimed', 'confirmed']).withDefault('all')
)
// URL becomes: /dashboard?status=unpaid
// Filters are shareable, bookmarkable, and survive page refresh
```

**Use cases:** Dashboard filters, bill view states, deep linking to specific bill sections. Makes every view sharable.

### Tesseract.js (npm) — CLIENT-SIDE OCR PREVIEW

**What:** Pure JavaScript port of Google's Tesseract OCR engine. Runs in the browser via WebAssembly. Supports 100+ languages including Thai.

```ts
import { createWorker } from 'tesseract.js'

const worker = await createWorker('tha')
const { data: { text } } = await worker.recognize(receiptImage)
// Show instant preview of extracted text while AI processes on server
await worker.terminate()
```

**Strategy — Two-Stage OCR:**
1. **Stage 1 (client, instant):** Tesseract.js quick OCR → show partial results immediately
2. **Stage 2 (server, accurate):** AI model structured extraction → final parsed items

Thai OCR accuracy with Tesseract alone is ~70-80%. The AI layer on the server handles structured extraction. But Tesseract provides instant "processing..." feedback with partial results.

### View Transition API (Browser API) — PAGE TRANSITIONS 🔥

**What:** Native browser API for animating DOM state changes and page navigations. Now experimentally supported in Next.js 15.2+.

```ts
// next.config.js
const nextConfig = { experimental: { viewTransition: true } }

// In components — smooth morphing between bill list and bill detail
import { unstable_viewTransition as ViewTransition } from 'react'

<ViewTransition name="bill-card">
  <BillCard bill={bill} />
</ViewTransition>
```

**Why:** Makes the app feel like a native mobile app with zero animation library overhead. Bill cards morph into detail views, payment status transitions animate smoothly, and page navigations have cross-fade effects. Uses GPU-accelerated compositor layers for 60fps performance.

**Fallback:** `next-view-transitions` package by Shu Ding (Next.js team) provides a simpler wrapper. Browsers that don't support it still work — progressive enhancement.

### Web Speech API (Browser API) — VOICE INPUT

**What:** Browser-native speech recognition. Users can dictate receipt items instead of typing. Supports Thai language (`th-TH`).

```ts
const recognition = new webkitSpeechRecognition()
recognition.lang = 'th-TH'
recognition.continuous = false

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript
  // "ข้าวผัดกุ้ง 120 บาท" → parse into item name + price
  addItemFromVoice(transcript)
}

recognition.start()
```

**Use case:** At a noisy restaurant, the payer can quickly dictate menu items instead of typing. Works on Chrome/Edge (Android + desktop). Degrades gracefully on unsupported browsers.

### Clipboard API (Browser API) — PASTE RECEIPT IMAGE

**What:** Allows users to paste images directly from clipboard into the upload area. Perfect for receipt screenshots copied from LINE chat.

```ts
document.addEventListener('paste', async (e) => {
  for (const item of e.clipboardData.files) {
    if (item.type.startsWith('image/')) {
      const file = item
      // Compress and process as receipt
      await processReceiptImage(file)
    }
  }
})
```

**Use case:** Friend screenshots a receipt in LINE, copies it, and pastes directly into the bill creation page. No file picker needed. Reduces friction for the most common receipt input method among Thai Gen-Z.

### PartyKit — REAL-TIME MULTIPLAYER UPDATES 🔥

**What:** Managed real-time WebSocket backend. Turns the bill page into a live, multiplayer experience where all participants see updates instantly.

```ts
// Server (party/bill-room.ts)
export default class BillRoom implements Party.Server {
  onMessage(message: string, ws: Party.Connection) {
    // Broadcast payment update to all viewers
    this.party.broadcast(message, [ws.id])
  }
}

// Client (React)
import usePartySocket from 'partysocket/react'

const ws = usePartySocket({
  room: billId,
  onMessage(event) {
    const update = JSON.parse(event.data)
    if (update.type === 'payment_confirmed') {
      // Instant UI update + confetti!
      updatePaymentStatus(update.memberId, 'confirmed')
      confetti({ particleCount: 100 })
    }
  }
})
```

**Why PartyKit over raw WebSockets/SSE:**
- 5 lines of server code for a broadcast room
- Built-in reconnection handling
- Runs on global edge network (low latency everywhere)
- Free tier is generous (up to 20 concurrent connections per room — perfect for a dinner group)
- `usePartySocket` React hook with auto-reconnect

**Use cases:**
- **Live bill page:** When one friend claims "I've Paid", everyone on the page sees it instantly
- **Real-time claiming:** Watch items get claimed in real-time during the meal
- **Live payment progress:** Progress bar updates live as friends pay
- **Demo wow factor:** During presentation, show two phones updating simultaneously

**Implementation:** ~1 day for basic real-time updates. Replaces the "Nice-to-Have" SSE approach with a production-ready solution.

### DotLottie (`@lottiefiles/dotlottie-react`) — PREMIUM MICRO-ANIMATIONS

**What:** Airbnb's Lottie animation format for React. Plays high-quality After Effects animations as lightweight JSON. The `.lottie` format reduces file sizes by up to 80%.

```tsx
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

// Payment success celebration
<DotLottieReact
  src="/animations/payment-success.lottie"
  autoplay
  loop={false}
/>

// Loading state while OCR processes
<DotLottieReact
  src="https://lottie.host/your-animation-id/receipt-scanning.lottie"
  autoplay
  loop
/>
```

**Use cases:**
- Payment confirmation animation (more premium than confetti alone)
- Receipt scanning loading state
- Empty state illustrations
- Onboarding tutorial animations
- Error state illustrations

**Source:** LottieFiles.com has thousands of free animations. Team can also create custom ones.

### Barcode Detection API (Browser API) — NATIVE QR SCANNING

**What:** Browser-native barcode/QR detection API. No library needed on supported devices (Chrome/Edge on Android, macOS).

```ts
if ('BarcodeDetector' in globalThis) {
  const detector = new BarcodeDetector({ formats: ['qr_code'] })
  const barcodes = await detector.detect(slipImageElement)
  if (barcodes.length > 0) {
    const qrData = barcodes[0].rawValue
    // Parse with promptparse.slipVerify()
  }
}
```

**Strategy:** Use as primary QR extraction method on supported devices, fall back to `html5-qrcode` on others. Zero-dependency QR scanning on Android Chrome.

### `promptpay-qr` (npm) — LEGACY REFERENCE

> **Note:** Superseded by `promptparse` which includes all QR generation functionality plus parsing and validation. Kept here for reference only.

```ts
import generatePayload from 'promptpay-qr'
const payload = generatePayload('0812345678', { amount: 350.50 })
```

### `canvas-confetti` (npm)

**What:** Performant confetti animation. 6KB, zero dependencies.

```ts
import confetti from 'canvas-confetti'

// Celebrate when bill is fully paid
confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
```

### `web-push` (npm)

**What:** Server-side library for sending Web Push notifications using VAPID keys. No third-party push service needed (no Firebase).

```ts
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:your@email.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Send notification to a subscriber
await webpush.sendNotification(subscription, JSON.stringify({
  title: '🍕 ISE Squad Dinner',
  body: 'Boom is still waiting for your ฿180.50',
  url: 'https://yourapp.com/bill/abc123'
}))
```

### `qrcode` (npm)

**What:** QR code image generator. Takes the payload string from `promptpay-qr` and renders it as SVG/PNG/DataURL.

```ts
import QRCode from 'qrcode'

// Generate QR as data URL for <img> tag
const dataUrl = await QRCode.toDataURL(payload, { width: 300, margin: 2 })

// Generate QR as SVG string
const svg = await QRCode.toString(payload, { type: 'svg' })
```

### Web Share API (Browser API)

**What:** Triggers the phone's native share sheet — same as native apps. Fallback to clipboard copy on desktop.

```ts
const shareBill = async (token: string, billName: string) => {
  const url = `https://yourapp.com/bill/${token}`
  if (navigator.share) {
    await navigator.share({
      title: `🍕 ${billName}`,
      text: 'Here\'s our bill split!',
      url
    })
  } else {
    await navigator.clipboard.writeText(url)
    toast('Link copied!')
  }
}
```

### Vibration API (Browser API)

**What:** Haptic feedback on mobile. One line of code per interaction.

```ts
// Success — single buzz
navigator.vibrate?.(150)

// Payment confirmed — double tap
navigator.vibrate?.([100, 50, 100])

// Error — triple warning
navigator.vibrate?.([80, 30, 80, 30, 80])
```

Works on Android Chrome. Degrades gracefully on iOS (no-op). Always feature-detect with optional chaining.

### Next.js `ImageResponse` (Dynamic OG Images)

**What:** Server-side JSX → PNG for Open Graph link previews. Built into Next.js.

```tsx
// app/bill/[token]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export default async function Image({ params }) {
  const bill = await getBill(params.token)
  const paidCount = bill.payments.filter(p => p.status === 'confirmed').length

  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', padding: 40, background: 'white', width: '100%', height: '100%' }}>
      <h1 style={{ fontSize: 48 }}>{bill.name}</h1>
      <p style={{ fontSize: 32, color: '#666' }}>
        ฿{bill.total} · {paidCount} of {bill.members.length} paid
      </p>
    </div>,
    { width: 1200, height: 630 }
  )
}
```

**Why this is a killer feature:** When someone drops the bill link in a LINE group chat, the preview shows "🍕 ISE Squad Dinner — ฿666.90 · 1 of 3 paid." That preview IS the social pressure. The payer doesn't need to say anything — the link preview does the talking.

### PWA (Progressive Web App)

**What:** Makes the web app installable on home screen. Required for iOS Web Push.

```json
// public/manifest.json
{
  "name": "PlaDukKhlongToei",
  "short_name": "PladukBill",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#your-brand-color",
  "background_color": "#ffffff",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Next.js PWA setup: use `next-pwa` plugin or `serwist`. Service worker handles push event handling and optional offline caching.

---

## 8. Database Schema

PostgreSQL with Drizzle ORM. All timestamps in UTC.

```ts
// packages/shared/src/db/schema.ts
import { pgTable, text, integer, numeric, timestamp, boolean, uuid, pgEnum } from 'drizzle-orm/pg-core'

// Enums
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'claimed', 'confirmed', 'rejected'])
export const billStatusEnum = pgEnum('bill_status', ['draft', 'active', 'settled'])

// ============================================
// USERS (Payers only — friends never have accounts)
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  promptpayId: text('promptpay_id'),          // Phone number or national ID
  promptpayType: text('promptpay_type'),       // 'phone' or 'national_id'
  authProvider: text('auth_provider'),          // 'google', 'apple', 'line', 'email'
  authProviderId: text('auth_provider_id'),     // Provider-specific user ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ============================================
// GROUPS (Collection of people who split bills together)
// ============================================
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),                 // "ISE Squad", "Roommates"
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  inviteCode: text('invite_code').unique(),      // Optional group invite
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============================================
// GROUP MEMBERS (Both users and guests)
// ============================================
export const groupMembers = pgTable('group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => groups.id).notNull(),
  userId: uuid('user_id').references(() => users.id),  // NULL for guests
  displayName: text('display_name').notNull(),          // Always set (even for users, as cache)
  isGuest: boolean('is_guest').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============================================
// BILLS (One receipt = one bill)
// ============================================
export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => groups.id).notNull(),
  paidBy: uuid('paid_by').references(() => users.id).notNull(),  // Who paid the restaurant
  name: text('name').notNull(),                   // "ISE Squad Dinner", "Lunch at MK"
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  vatRate: numeric('vat_rate', { precision: 5, scale: 4 }),     // 0.07 for 7%
  vatAmount: numeric('vat_amount', { precision: 10, scale: 2 }),
  serviceChargeRate: numeric('service_charge_rate', { precision: 5, scale: 4 }), // 0.10 for 10%
  serviceChargeAmount: numeric('service_charge_amount', { precision: 10, scale: 2 }),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  receiptImageUrl: text('receipt_image_url'),      // Uploaded receipt photo
  shareToken: text('share_token').unique().notNull(), // Random token for public URL
  status: billStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ============================================
// BILL ITEMS (Line items from the receipt)
// ============================================
export const billItems = pgTable('bill_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').references(() => bills.id).notNull(),
  name: text('name').notNull(),                   // "Pad Thai", "Chang Beer"
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(), // quantity * unitPrice
  sortOrder: integer('sort_order').default(0),
})

// ============================================
// ITEM CLAIMS (Who owes what — the split)
// ============================================
export const itemClaims = pgTable('item_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  billItemId: uuid('bill_item_id').references(() => billItems.id).notNull(),
  memberId: uuid('member_id').references(() => groupMembers.id).notNull(),
  shareAmount: numeric('share_amount', { precision: 10, scale: 2 }).notNull(), // Their portion of this item (BEFORE VAT/service)
})

// ============================================
// PAYMENTS (Per-member payment status per bill)
// ============================================
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').references(() => bills.id).notNull(),
  memberId: uuid('member_id').references(() => groupMembers.id).notNull(), // Who owes money
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(), // Total including proportional VAT/service
  status: paymentStatusEnum('status').default('unpaid').notNull(),
  slipImageUrl: text('slip_image_url'),           // Optional transfer slip upload
  claimedAt: timestamp('claimed_at'),             // When member tapped "I've Paid"
  confirmedAt: timestamp('confirmed_at'),         // When payer confirmed
  rejectedAt: timestamp('rejected_at'),           // When payer rejected
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ============================================
// PUSH SUBSCRIPTIONS (For Web Push notifications)
// ============================================
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').references(() => groupMembers.id), // Optional — could be anonymous
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),               // Public key
  auth: text('auth').notNull(),                    // Auth secret
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

### Key Design Decisions

1. **`groupMembers.userId` is nullable** — Friends exist as "guest members" with just a display name. No account required.
2. **`bills.shareToken`** — Random URL-safe string. Generates the public URL: `yourapp.com/bill/{shareToken}`
3. **`payments.status` has 4 states:** `unpaid` → `claimed` (friend says they paid) → `confirmed` (payer verified) or `rejected` (payer says no)
4. **`payments.claimedAt`** — Timestamp used for "⚡ First to pay" badge (compare across members)
5. **VAT/service stored at bill level** — Distributed proportionally in the calculation engine, stored in `payments.amount`
6. **`pushSubscriptions`** — Stores Web Push subscriptions for browser notifications. Decoupled from user accounts.

---

## 9. Core User Flows

### Payer Flow (Signed-In User) — 6 Screens

**Screen 1: Home / Dashboard**
- Group list with last activity
- Big "+ New Bill" button
- Quick stats: total spent this month, pending payments

**Screen 2: New Bill**
- Choose: "📸 Scan Receipt" (primary) or "✏️ Type Manually" (secondary)
- Scan Receipt → Upload image → AI extracts items (AI team's endpoint)
- Type Manually → Add items one by one

**Screen 3: Review Items**
- OCR results displayed in editable list
- Each item: name, quantity, unit price, total
- Bottom section: Subtotal, VAT 7%, Service 10%, Total
- Payer can edit any value
- "Looks Good →" button

**Screen 4: Who's Splitting?**
- Select from existing group members OR add new person (just type a name)
- Quick action: "Add from [Group Name]" to import everyone
- "Next →" button

**Screen 5: Who Had What? (Item Claiming)**
- Visual item list on top
- Member avatars/names at bottom
- Tap item → tap person(s) who had it
- "Everyone" shortcut for shared items (appetizers, shared dishes)
- If multiple people claim one item, split equally among them
- Real-time running total per person shown
- "Calculate Split →" button

**Screen 6: The Split (Summary + Share)**
- Each member's total with breakdown:
  - Items they claimed
  - Their proportional VAT/service charge
  - **Final amount**
- **🔗 Share Link** button (Web Share API → native share sheet)
- Link is ONE link for everyone: `yourapp.com/bill/{token}`

### Friend Flow (No Sign-Up) — 1 Page

**Shared Bill Page** (`yourapp.com/bill/{token}`):
- See full explanation in [Section 13](#13-shared-bill-page-the-product)

---

## 10. Payment Verification System

### Two Paths, One Truth: The Payer is Always the Final Authority

**Path A: Payer-Initiated Verification (Primary)**

```
Friend pays via banking app
  → Payer checks their banking app
  → Payer taps "Confirm Payment" on the bill page
  → Status: unpaid → confirmed (skips 'claimed')
  → Done
```

The payer saw it in their bank. No slip needed. Fastest, most trusted path.

**Path B: Friend-Initiated Claim**

```
Friend taps "I've Paid ✓" on shared page
  → Optionally uploads transfer slip image
  → Status: unpaid → claimed
  → Payer sees notification: "Bom says they paid ฿210.60"
  → If slip uploaded: AI extracts amount from slip for payer convenience
  → Payer verifies against their bank statement
  → Payer taps "Confirm" or "Reject"
  → Status: claimed → confirmed OR claimed → rejected
```

### About Transfer Slip Verification

**V1 now includes automated slip verification** thanks to the OpenVerifySlip API (free, 500/day).

**Complete Verification Pipeline:**
```
Friend uploads slip screenshot
        ↓
[browser-image-compression] (client)
  8MB photo → ~800KB
        ↓
[Barcode Detection API / html5-qrcode] (client)
  Extract Mini QR from slip image
        ↓
[promptparse.slipVerify()] (client)
  Parse QR → { sendingBank, transRef }
        ↓
POST /api/payments/verify (server)
  { transRef, expectedAmount, paymentId }
        ↓
[OpenVerifySlip API] (server)
  Verify against Bank of Thailand records
        ↓
Backend validation:
  ✓ Amount matches expected?
  ✓ Time within 24hrs?
  ✓ transRef not already used?
        ↓
Auto-update status: unpaid → confirmed
Push notification to payer
Trigger confetti 🎉
```

**Fallback:** If Mini QR extraction fails (low-res slip, damaged QR), the system falls back to Path B (payer manual confirmation). Tesseract.js still extracts the amount for display convenience.

**V2 Enhancement:** Upgrade to EasySlip API (developer.easyslip.com) for duplicate detection, higher daily limits, and production SLA.

### Database States

```
payments.status:
  'unpaid'     → Nobody has done anything
  'claimed'    → Friend tapped "I've Paid" (with optional slip)
  'confirmed'  → Payer verified the payment ✅
  'rejected'   → Payer rejected the claim ❌
```

---

## 11. Reminder System

**Philosophy:** Remove every excuse for not paying. Never make the payer be the one chasing money.

### Layer 1: Dynamic OG Link Preview (Passive, Always On)

When the bill link is shared in any chat, the link preview shows:

```
┌──────────────────────────────┐
│ 🍕 ISE Squad Dinner          │
│ ฿666.90 · 1 of 3 paid        │
│ pladuk.app                   │
└──────────────────────────────┘
```

This preview is generated dynamically by Next.js `opengraph-image.tsx`. It updates as people pay. The payer re-shares the same link in the group chat — that IS the reminder. No words needed. "1 of 3 paid" tells the story.

### Layer 2: Web Push Notifications (Automated)

When a friend opens the shared bill page, the browser can prompt: "Allow notifications?"

If they accept, the server stores their push subscription. Automated reminders:

- **After 24 hours unpaid:** "🍕 ISE Squad Dinner — ฿180.50 still outstanding"
- **After 3 days:** "Hey! 2 of 3 have already paid for ISE Squad Dinner"
- **After 7 days:** Final gentle reminder

Notifications come from the app, not from the payer. This is the critical psychological difference.

**Requirements:**
- HTTPS (Vercel provides this)
- VAPID keys (generated with `web-push`)
- Service worker registered on the shared bill page
- PWA installed on iOS for push to work (iOS Safari 16.4+)

### Layer 3: Social Pressure Page (Passive, Always On)

The shared bill page itself shows who has and hasn't paid. Every time anyone opens the link, they see:

```
✅ Bomb       ฿210.60  ⚡ First to pay
✅ Punn       ฿210.60
⏳ Pluek      ฿245.70  [Pay ฿245.70]
```

Nobody wants to be the last name on the list.

### What If Someone Ignores Everything?

If someone doesn't have an account, doesn't allow push notifications, and ignores the link — no app on earth can reach them. Khunthong can't either. Splitwise can't. That's a people problem, not a technology problem.

**Our app removes every excuse:** "I didn't know how much I owed" (it's on the page), "I don't have the account number" (QR is right there), "I forgot" (push notification + OG preview).

---

## 12. VAT & Service Charge Calculation Engine

This runs in the shared `packages/shared` so it's used identically on frontend (preview) and backend (final calculation).

### The Algorithm

```ts
// packages/shared/src/utils/calculateSplit.ts

interface BillItem {
  id: string
  name: string
  totalPrice: number  // quantity * unitPrice
}

interface ItemClaim {
  billItemId: string
  memberId: string
}

interface BillTotals {
  subtotal: number
  vatRate: number          // 0.07
  vatAmount: number
  serviceChargeRate: number // 0.10
  serviceChargeAmount: number
  totalAmount: number
}

interface MemberSplit {
  memberId: string
  itemsSubtotal: number
  proportion: number       // Their % of subtotal
  vatShare: number
  serviceChargeShare: number
  totalAmount: number
  items: { name: string; shareAmount: number }[]
}

function calculateSplit(
  items: BillItem[],
  claims: ItemClaim[],
  totals: BillTotals,
  memberIds: string[]
): MemberSplit[] {

  // Step 1: Calculate each member's item subtotal
  const memberSubtotals = new Map<string, number>()
  const memberItems = new Map<string, { name: string; shareAmount: number }[]>()

  for (const item of items) {
    const claimers = claims.filter(c => c.billItemId === item.id)
    const sharePerPerson = item.totalPrice / claimers.length

    for (const claim of claimers) {
      const current = memberSubtotals.get(claim.memberId) || 0
      memberSubtotals.set(claim.memberId, current + sharePerPerson)

      const currentItems = memberItems.get(claim.memberId) || []
      currentItems.push({ name: item.name, shareAmount: sharePerPerson })
      memberItems.set(claim.memberId, currentItems)
    }
  }

  // Step 2: Calculate proportions and distribute VAT/service
  const hiddenCosts = totals.vatAmount + totals.serviceChargeAmount
  const splits: MemberSplit[] = []

  let runningTotal = 0

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]
    const itemsSubtotal = memberSubtotals.get(memberId) || 0
    const proportion = totals.subtotal > 0 ? itemsSubtotal / totals.subtotal : 0

    const vatShare = totals.vatAmount * proportion
    const serviceChargeShare = totals.serviceChargeAmount * proportion

    let totalAmount: number

    if (i === memberIds.length - 1) {
      // Last person gets the remainder (absorbs rounding error, always < ฿1)
      totalAmount = totals.totalAmount - runningTotal
    } else {
      totalAmount = Math.floor((itemsSubtotal + vatShare + serviceChargeShare) * 100) / 100
      runningTotal += totalAmount
    }

    splits.push({
      memberId,
      itemsSubtotal,
      proportion,
      vatShare,
      serviceChargeShare,
      totalAmount,
      items: memberItems.get(memberId) || []
    })
  }

  return splits
}
```

### Rounding Strategy

- Round each person's total **down** to 2 decimal places (satang)
- The **payer** (last person in the array, excluded from splits) absorbs the rounding error
- Rounding error is always less than ฿1 (usually 1-2 satang)

---

## 13. Shared Bill Page (The Product)

**URL:** `yourapp.com/bill/{shareToken}`
**Auth:** NONE. Publicly accessible. SSR with Next.js for fast load + OG image.
**This page IS the product for 80% of users.**

### One Link, Everyone Sees the Same Page

The payer drops ONE link in the group chat. Everyone clicks the same URL. The landing page shows everyone:

```
┌─────────────────────────────────┐
│  🍕 ISE Squad Dinner             │
│  Feb 25 · Boom is collecting     │
│                                  │
│  Total: ฿666.90                  │
│  ─────────────────────────────── │
│                                  │
│  ✅ Bomb       ฿210.60  ⚡       │
│                                  │
│  ⏳ Pluek      ฿245.70           │
│     [Pay ฿245.70]                │
│                                  │
│  ⏳ Punn       ฿210.60           │
│     [Pay ฿210.60]                │
│                                  │
│  ─────────────────────────────── │
│  1 of 3 paid                     │
│                                  │
│  [See Full Breakdown]            │
└─────────────────────────────────┘
```

### When Someone Taps [Pay ฿245.70]

A bottom sheet / inline expansion appears — **no navigation, no redirect:**

```
┌─────────────────────────────────┐
│  ⏳ Pluek      ฿245.70           │
│  ┌───────────────────────────┐  │
│  │   ████████████████████    │  │
│  │   ██  PromptPay QR  ██   │  │
│  │   ████████████████████    │  │
│  └───────────────────────────┘  │
│  Scan to pay Boom ฿245.70       │
│  via PromptPay                   │
│                                  │
│  What you had:                   │
│  · Som Tum          ฿120.00     │
│  · Chang Beer x1    ฿90.00      │
│  · + VAT/service    ฿35.70      │
│                                  │
│  [I've Paid ✓]     [Close]      │
└─────────────────────────────────┘
```

### "See Full Breakdown"

Expands to show the complete calculation:

```
Subtotal:        ฿570.00
VAT 7%:          ฿39.90
Service 10%:     ฿57.00
Total:           ฿666.90

Boom (payer):
  Pad Thai x1    ฿90.00
  Chang x1       ฿90.00
  Items total:   ฿180.00 (31.58%)
  VAT share:     ฿12.60
  Service share:  ฿18.00
  Total:         ฿210.60

Pluek:
  Som Tum        ฿120.00
  Chang x1       ฿90.00
  Items total:   ฿210.00 (36.84%)
  ...
```

Full transparency. Every baht accounted for.

---

## 14. Wow Factors & Micro-Interactions

Ranked by impact-to-effort ratio:

### Must Build (Total: ~4 days)

| Feature | Effort | Description |
|---------|--------|-------------|
| Dynamic OG Preview | 4 hrs | `opengraph-image.tsx` — link previews show bill name + paid count. THIS is the reminder system. |
| LINE LIFF Share | 3-4 days | Native LINE sharing with rich Flex Messages. **THE differentiator for Thai market.** |
| Web Share API | 30 min | Native share sheet (fallback for non-LINE sharing). Falls back to clipboard on desktop. |
| PWA Install | 2 hrs | `manifest.json` + service worker. App installs to home screen. Required for iOS push. |
| Sonner Toasts | 1 hr | Promise-based toasts for slip verification, payment confirmation, error states. |
| Haptic Feedback | 15 min | `navigator.vibrate()` on "I've Paid", payment confirm, errors. Android only, degrades on iOS. |
| Confetti on Full Payment | 30 min | `canvas-confetti` explosion when all members confirmed. Respect `prefers-reduced-motion`. |
| "First to Pay" Badge | 20 min | ⚡ tag next to first confirmed payment. Compare `claimedAt` timestamps. |

### High-Impact Polish (Total: ~3-4 days)

| Feature | Effort | Description |
|---------|--------|-------------|
| Automated Slip Verification | 2 days | `html5-qrcode` + `promptparse` + OpenVerifySlip API. Complete automated payment verification pipeline. **No competitor has this.** |
| Real-Time Live Updates | 1 day | PartyKit WebSocket rooms. Payment claims and confirmations appear instantly for all viewers. Incredible for demo. |
| Motion Animations | 1-2 days | `motion` library for drag-to-claim items, smooth list reordering, payment status transitions, swipe gestures. |
| View Transitions | 2 hrs | Native browser View Transition API. Bill cards morph into detail views. App feels like native mobile. |
| Paste Receipt from Clipboard | 1 hr | Clipboard API paste handler. Friends can Ctrl+V / Cmd+V a receipt screenshot directly. |
| URL State with nuqs | 2-3 hrs | Dashboard filters, bill view states stored in URL. Every view is shareable and bookmarkable. |

### Nice-to-Have (If Time Permits)

| Feature | Effort | Description |
|---------|--------|-------------|
| Web Push Notifications | 1 day | Automated payment reminders for friends who opted in. Requires VAPID setup + service worker. |
| Lottie Animations | 4 hrs | Premium micro-animations for payment success, receipt scanning, empty states using DotLottie. |
| Voice Input | 4 hrs | Web Speech API for dictating menu items in Thai. Great for noisy restaurants. |
| Client-Side OCR Preview | 1 day | Tesseract.js instant preview while server AI processes receipt. Progressive feedback. |
| Gamification Elements | 2-3 days | "Fastest Payer" leaderboard, payment streaks, group statistics. Behavioral nudges for prompt payment. |

---

## 15. API Endpoints

### Auth

```
POST   /api/auth/register          # Email/password registration
POST   /api/auth/login             # Email/password login
GET    /api/auth/google            # Google OAuth redirect
GET    /api/auth/google/callback   # Google OAuth callback
GET    /api/auth/apple             # Apple Sign-In redirect
GET    /api/auth/apple/callback    # Apple callback
GET    /api/auth/line              # LINE Login redirect
GET    /api/auth/line/callback     # LINE callback
POST   /api/auth/logout
GET    /api/auth/me                # Current user
```

### Groups

```
GET    /api/groups                 # List user's groups
POST   /api/groups                 # Create group
GET    /api/groups/:id             # Get group details + members
POST   /api/groups/:id/members     # Add member to group (just name for guests)
DELETE /api/groups/:id/members/:memberId
```

### Bills

```
GET    /api/bills                  # List bills (filterable by group)
POST   /api/bills                  # Create bill (with items)
GET    /api/bills/:id              # Get bill details (authenticated payer view)
PATCH  /api/bills/:id              # Update bill
DELETE /api/bills/:id

# Public endpoint (no auth, uses shareToken)
GET    /api/bills/shared/:token    # Get bill for shared page (public data only)
```

### Items & Claims

```
POST   /api/bills/:id/items        # Add items to bill
PATCH  /api/bills/:id/items/:itemId
DELETE /api/bills/:id/items/:itemId
POST   /api/bills/:id/claims       # Set item claims (who had what)
GET    /api/bills/:id/split        # Calculate and return the split
```

### Payments

```
# Public (shared page actions)
POST   /api/bills/shared/:token/claim-payment    # Friend claims "I've Paid" { memberId, slipImageUrl? }
POST   /api/bills/shared/:token/push-subscribe    # Friend subscribes to push notifications

# Automated Slip Verification
POST   /api/payments/verify-slip                  # Upload slip → extract QR → verify via OpenVerifySlip API
                                                  # Returns: { verified, amount, sendingBank, transRef }

# Authenticated (payer actions)
POST   /api/payments/:id/confirm   # Payer confirms payment
POST   /api/payments/:id/reject    # Payer rejects payment
```

### OCR (AI Team's Endpoint)

```
POST   /api/ocr/receipt            # Upload receipt image → returns extracted items
                                   # Lead dev provides endpoint structure
                                   # AI team implements the extraction logic
```

### Push Notifications

```
POST   /api/push/subscribe         # Save push subscription
POST   /api/push/send              # Internal: trigger push notification
```

### LINE LIFF

```
GET    /api/liff/share/:token      # Generate Flex Message payload for Share Target Picker
GET    /api/liff/profile            # Get LINE profile for logged-in LIFF user
```

---

## 16. Sprint Plan

### Week 1-2: Foundation

**Goal:** Register, login, hit API endpoints. Both apps deployed.

- [ ] Monorepo setup (Turborepo + pnpm workspaces)
- [ ] Next.js + Tailwind + shadcn/ui boilerplate
- [ ] Hono server + health check endpoint
- [ ] Drizzle ORM + PostgreSQL on Railway
- [ ] Database schema + initial migration
- [ ] Auth: Google OAuth (primary — get one working first)
- [ ] Basic user CRUD
- [ ] Deploy: Vercel (frontend), Railway (backend)
- [ ] CI: GitHub Actions for lint + type check

### Week 3-4: Core Bill Splitting

**Goal:** Create group, add bill, claim items, see split.

- [ ] Create/join groups
- [ ] Add/remove group members (guests with just names)
- [ ] Create bill manually (no OCR yet)
- [ ] Bill items CRUD
- [ ] Item claiming UI (tap items → assign to people)
- [ ] Calculation engine (split items + distribute VAT/service proportionally)
- [ ] Payment breakdown view
- [ ] Payment status tracking (4-state system)

### Week 5-6: Shared Link + PromptPay QR (The Magic)

**Goal:** Full flow: scan receipt → split → share link → friend sees QR → pays.

- [ ] Generate share token per bill
- [ ] Build public shared bill page (SSR with Next.js, no auth)
- [ ] PromptPay QR generation (`promptparse` + `qrcode`)
- [ ] Dynamic OG image (`opengraph-image.tsx`)
- [ ] Web Share API integration
- [ ] "I've Paid" claim flow
- [ ] Payer confirm/reject flow
- [ ] PWA manifest + service worker
- [ ] OCR integration (AI team provides endpoint, lead dev connects UI)
- [ ] Receipt upload + review/edit extracted items UI
- [ ] `browser-image-compression` for slip/receipt uploads
- [ ] `nuqs` for dashboard URL state management
- [ ] `sonner` toast notifications throughout app
- [ ] Clipboard API paste handler for receipt images

### Week 7: Polish + Wow Factors + Verification

**Goal:** App feels complete, polished, and pushes boundaries.

- [ ] Automated slip verification pipeline (`html5-qrcode` + `promptparse` + OpenVerifySlip API)
- [ ] `motion` animations: drag-to-claim items, payment transitions, list reordering
- [ ] View Transition API for page navigations
- [ ] PartyKit real-time updates (live payment status for all bill viewers)
- [ ] Confetti on full payment + Lottie celebration animation
- [ ] Haptic feedback
- [ ] "First to Pay" badge
- [ ] Expense history per group
- [ ] Financial summary dashboard (total spent, total owed)
- [ ] Loading states, error handling, empty states
- [ ] Mobile responsiveness audit

### Week 8: LINE Integration + Testing + Demo Prep

**Goal:** LINE LIFF integration. Rock-solid demo. Ship it.

- [ ] LINE Login channel setup in LINE Developers Console
- [ ] LIFF app registration
- [ ] Share Target Picker with Flex Message design
- [ ] Apple Sign-In + LINE Login (additional auth providers)
- [ ] End-to-end testing
- [ ] Bug fixes
- [ ] Web Push notifications (if time permits)
- [ ] Demo script and presentation
- [ ] Edge case testing (empty bills, single person, large groups)
- [ ] Performance audit (Lighthouse)
- [ ] Final deployment check

---

## 17. Team Roles

| Role | People | Responsibility |
|------|--------|---------------|
| Lead Developer | Techin (Boom) | Architecture, frontend, backend, deployment |
| Developer 2 | TBD (if available) | Assist with frontend or backend tasks |
| AI Engineers | 2 team members | OCR/receipt scanning, transfer slip reading |
| UI/UX Designer | 1-2 people | Figma mockups BEFORE coding (work 1-2 weeks ahead) |
| QA/Testing | 1-2 people | Test features as shipped, file bugs |
| Report Writer | 1-2 people | Milestone reports, documentation, diagrams |
| Demo/Presentation | 1-2 people | Final presentation and demo script |
| Data/Research | 1-2 people | User feedback, validate features |

**Critical:** UI/UX designs screens in Figma first to avoid redesign waste. Designer should be 1-2 weeks ahead of development.

---

## 18. Open Items & Future Features

### V2 Features

- EasySlip API upgrade (duplicate detection, higher limits, production SLA)
- Guest-to-user account conversion (claim history)
- Debt simplification across multiple bills
- Export expense reports (PDF/CSV)
- Multi-currency support
- "Split Equally" shortcut (skip item claiming)
- Money coach / spending insights
- Gamification: payment streaks, "Fastest Payer" leaderboard, group statistics
- Web NFC API for tap-to-share bill links (Android Chrome only)
- Food image recognition (INMU iFood / LogMeal API) for auto-detecting menu items
- Recurring bill templates (weekly lunch groups)

### Design Decisions Still Needed

- Exact color palette and brand identity (UI/UX designer)
- App name display format (PlaDukKhlongToei vs. shorter name)
- Onboarding flow for new payers (PromptPay ID input)
- Error states and edge case UX (receipt upload fails, QR won't load, etc.)

### Receipt Collection for OCR Testing

**Action item for ALL team members:** Start collecting receipt photos NOW. Take a photo every time you eat out. Different restaurants, different formats, different levels of crumpled and blurry. Aim for 20-30 real Thai receipts as a test dataset for the AI team.

---

## Appendix: Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/pladuk

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
JWT_SECRET=

# Push Notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:your@email.com

# App
NEXT_PUBLIC_APP_URL=https://pladuk.app
NEXT_PUBLIC_API_URL=https://api.pladuk.app

# OCR (AI Team)
OCR_API_KEY=
OCR_API_URL=

# Slip Verification
OPENVERIFYSLIP_API_KEY=

# LINE LIFF
NEXT_PUBLIC_LIFF_ID=
LIFF_CHANNEL_SECRET=

# PartyKit (Real-Time)
NEXT_PUBLIC_PARTYKIT_HOST=pladuk.your-username.partykit.dev
```

---

*This PRD represents all decisions made during the planning phase. Every library and API has been individually verified for production readiness, active maintenance, and npm health. It is designed to be dropped into an IDE alongside AI coding assistants (Claude, Gemini, Cursor) to provide full context for implementation.*

*Last updated: February 28, 2026 — Added 15+ boundary-pushing tools including automated slip verification, LINE LIFF integration, real-time multiplayer via PartyKit, production animations, and native browser APIs.*