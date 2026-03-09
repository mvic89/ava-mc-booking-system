# Payments API Integration Guide

When you are ready to replace mock/fake payment data with real APIs, follow this guide exactly.
Each section covers one payment method: what to sign up for, what credentials you need,
how the API call works, and how to handle the callback that unlocks delivery.

---

## Table of Contents

1. [General Architecture](#1-general-architecture)
2. [Database Schema Changes](#2-database-schema-changes)
3. [Financing — Santander (Primary)](#3-financing--santander-primary)
4. [Financing — Svea (Secondary)](#4-financing--svea-secondary)
5. [Swish (Mobile Payments)](#5-swish-mobile-payments)
6. [Card Payments — Nets Easy](#6-card-payments--nets-easy)
7. [Bank Transfer — Bankgiro / Open Banking](#7-bank-transfer--bankgiro--open-banking)
8. [Delivery Lock Logic](#8-delivery-lock-logic)
9. [Multi-Location Setup](#9-multi-location-setup)
10. [Environment Variables](#10-environment-variables)

---

## 1. General Architecture

Every payment method follows the same pattern:

```
Customer/Dealer action
        ↓
POST /api/payments/[method]/initiate
        ↓
External API (Santander / Swish / Nets / Bankgiro)
        ↓
Webhook callback → POST /api/payments/[method]/callback
        ↓
DB update: payment_status = CONFIRMED
        ↓
Delivery lock lifts automatically
```

**Rule:** Delivery is NEVER unlocked manually by a salesperson.
Only a confirmed webhook from the payment provider unlocks it.
Any override requires HQ admin role.

---

## 2. Database Schema Changes

Replace mock data in `app/sales/leads/[id]/payment/page.tsx` with real DB fetches.

Add these tables/columns to your Prisma schema (`prisma/schema.prisma`):

```prisma
model Payment {
  id              String   @id @default(cuid())
  agreementId     String
  locationId      String
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)
  amount          Int           // in öre (SEK × 100)
  reference       String        @unique
  externalId      String?       // provider's transaction/application ID
  payoutConfirmed Boolean       @default(false)
  confirmedAt     DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

enum PaymentMethod {
  FINANCING_SANTANDER
  FINANCING_SVEA
  SWISH
  CARD_NETS
  BANK_TRANSFER
}

enum PaymentStatus {
  PENDING
  PROCESSING
  CONFIRMED
  FAILED
}

model Location {
  id              String  @id @default(cuid())
  name            String
  swishNumber     String  // e.g. "1234567890"
  bankgiro        String  // e.g. "123-4567"
  iban            String
  netsTerminalId  String
  city            String
}
```

**API routes to create:**
- `app/api/payments/initiate/route.ts`
- `app/api/payments/financing/callback/route.ts`
- `app/api/payments/swish/callback/route.ts`
- `app/api/payments/nets/callback/route.ts`
- `app/api/payments/bank/callback/route.ts`

---

## 3. Financing — Santander (Primary)

### Sign up
1. Go to **santanderconsumer.se** → Dealer portal
2. Apply as authorized motorcycle dealer
3. Your account manager will send API credentials once volume agreement is signed
4. Negotiate: volume-based dealer rates, faster approvals, group agreement covering all locations

### What you get
- `SANTANDER_API_KEY`
- `SANTANDER_DEALER_ID`
- `SANTANDER_API_URL` (sandbox + production)

### How it works

**Step 1 — Submit credit application**
```ts
// POST /api/payments/financing/initiate
const res = await fetch(`${process.env.SANTANDER_API_URL}/applications`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.SANTANDER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    dealerId: process.env.SANTANDER_DEALER_ID,
    applicant: {
      personalNumber: customer.personnummer,  // from BankID
      name: customer.name,
      address: customer.address,              // from Roaring.io
    },
    loan: {
      amount: agreement.balanceDue,           // in SEK
      termMonths: 36,
      downPayment: agreement.deposit,
    },
    vehicle: {
      vin: agreement.vin,
      make: 'Kawasaki',
      model: 'Ninja ZX-6R',
      year: 2024,
      price: agreement.vehiclePrice,
    },
  }),
});

const { applicationId, status, monthlyAmount, apr } = await res.json();
// Save applicationId to DB
```

**Step 2 — Poll or receive webhook for approval**
```ts
// Santander sends a webhook to:
// POST /api/payments/financing/callback
// Body: { applicationId, status: "APPROVED" | "DENIED", dealerCommission }

export async function POST(req: Request) {
  const { applicationId, status, dealerCommission } = await req.json();

  await db.payment.update({
    where: { externalId: applicationId },
    data: {
      status: status === 'APPROVED' ? 'PROCESSING' : 'FAILED',
    },
  });
}
```

**Step 3 — Confirm payout (funds arrive in dealer account)**
```ts
// Santander sends a second webhook when funds are transferred:
// POST /api/payments/financing/callback
// Body: { applicationId, event: "PAYOUT_COMPLETE", amount, transferDate }

if (body.event === 'PAYOUT_COMPLETE') {
  await db.payment.update({
    where: { externalId: body.applicationId },
    data: {
      status: 'CONFIRMED',
      payoutConfirmed: true,
      confirmedAt: new Date(),
    },
  });
  // This triggers the delivery lock to lift
}
```

### Dealer commission
Santander pays dealer commission (typically 1.5–3% of financed amount) separately.
Store in `Payment.dealerCommission` and feed into salesperson commission calculation.

---

## 4. Financing — Svea (Secondary)

Use when customer is denied by Santander or requests alternative.

### Sign up
1. Go to **svea.com/foretag/finansiering**
2. Apply as a dealer partner
3. You receive `SVEA_API_KEY` and `SVEA_MERCHANT_ID`

### API
Svea's API is very similar to Santander. Base URL: `https://api.svea.com/payments`

```ts
// POST https://api.svea.com/payments/v1/financing/applications
headers: {
  'Authorization': `Bearer ${process.env.SVEA_API_KEY}`,
  'MerchantId': process.env.SVEA_MERCHANT_ID,
}
```

The request/response shape is nearly identical to Santander.
Webhook endpoint: `POST /api/payments/financing/callback?provider=svea`

**Key difference:** Svea tends to accept more borderline applications.
Always try Santander first — better dealer rates. Fall back to Svea automatically
if Santander returns `status: "DENIED"`.

---

## 5. Swish (Mobile Payments)

### Sign up
1. Go to **swish.nu** → Register as Swish Handel (merchant)
2. You need: Swedish company, Bankgiro number, BankID for verification
3. Each location gets its own Swish merchant number (10 digits)
4. You receive M2M (machine-to-machine) certificates — a `.p12` file per merchant

### Certificate setup
```bash
# Place certificates in /certs/ (already gitignored)
certs/
  swish-sthlm.p12      # Stockholm location
  swish-gbg.p12        # Gothenburg location
  swish-malmo.p12      # Malmö location
```

### How it works

**Initiate payment request**
```ts
// POST /api/payments/swish/initiate
import https from 'https';
import fs from 'fs';

const agent = new https.Agent({
  pfx: fs.readFileSync(`./certs/swish-${location}.p12`),
  passphrase: process.env.SWISH_CERT_PASSPHRASE,
});

const res = await fetch(
  'https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests',
  {
    method: 'POST',
    agent,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payeeAlias: location.swishNumber,       // from DB: locations.swishNumber
      amount: agreement.balanceDue,
      currency: 'SEK',
      payerAlias: customer.phone,             // customer's phone number
      message: `Betalning ${agreement.agreementNumber}`,
      callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/swish/callback`,
    }),
  }
);

// Response: 201 Created, Location header contains paymentId
const paymentId = res.headers.get('Location')?.split('/').pop();
```

**Callback (auto-confirm)**
```ts
// POST /api/payments/swish/callback
// Swish calls this when customer approves or declines in their app

export async function POST(req: Request) {
  const body = await req.json();
  // body.status: "PAID" | "DECLINED" | "ERROR"
  // body.paymentReference: unique Swish reference
  // body.amount: amount paid

  if (body.status === 'PAID') {
    await db.payment.update({
      where: { externalId: body.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });
    // Delivery lock lifts automatically
  }
}
```

### Sandbox / test
Use `https://mss.cpc.getswish.net/swish-cpcapi/api/v2` (same URL, test certificates)
Download test certs from **developers.swish.nu**

---

## 6. Card Payments — Nets Easy

### Sign up
1. Go to **nets.eu/payments/easy** → Create merchant account
2. Select: Automotive / Dealer category
3. Order AXEPT terminal hardware (one per location) — delivered pre-configured
4. You receive `NETS_SECRET_KEY`, `NETS_CHECKOUT_KEY`, terminal serial numbers

### Terminal setup
Each location's terminal ID is stored in `locations.netsTerminalId`.
Terminals communicate with Nets Cloud — no local server needed.

### How it works

**Create payment (cloud-initiated)**
```ts
// POST /api/payments/card/initiate
const res = await fetch('https://api.dibspayment.eu/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': process.env.NETS_SECRET_KEY,
    'Content-Type': 'application/json',
    'CommercePlatformTag': 'BikeMeNow-DMS',
  },
  body: JSON.stringify({
    order: {
      items: [
        {
          reference: agreement.vin,
          name: agreement.vehicle,
          quantity: 1,
          unit: 'pcs',
          unitPrice: agreement.balanceDue * 100,  // in øre
          grossTotalAmount: agreement.balanceDue * 100,
          netTotalAmount: agreement.balanceDue * 100,
        },
      ],
      amount: agreement.balanceDue * 100,
      currency: 'SEK',
      reference: agreement.agreementNumber,
    },
    checkout: {
      integrationType: 'UnscheduledSubscription',
      terminalId: location.netsTerminalId,       // from DB
      returnUrl: `${BASE_URL}/sales/leads/${id}/payment?status=complete`,
    },
    notifications: {
      webHooks: [
        {
          eventName: 'payment.checkout.completed',
          url: `${BASE_URL}/api/payments/nets/callback`,
          authorization: process.env.NETS_WEBHOOK_SECRET,
        },
      ],
    },
  }),
});

const { paymentId } = await res.json();
```

**Callback**
```ts
// POST /api/payments/nets/callback
// Header: Authorization = NETS_WEBHOOK_SECRET

export async function POST(req: Request) {
  const body = await req.json();
  // body.event.name: "payment.checkout.completed"
  // body.data.payment.paymentId
  // body.data.payment.summary.chargedAmount

  if (body.event.name === 'payment.checkout.completed') {
    await db.payment.update({
      where: { externalId: body.data.payment.paymentId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
  }
}
```

### Reporting
Nets provides a unified dashboard across all terminals.
Daily settlement exports can be configured to push to Fortnox automatically
via Nets' accounting integrations.

---

## 7. Bank Transfer — Bankgiro / Open Banking

### Option A — Bankgiro (BGMAX file, standard)

**Sign up**
1. Register company Bankgiro at **bankgirot.se** (one per location)
2. Enable "BGMAX" electronic file delivery to your SFTP server
3. Bankgirot sends a file once per banking day with all incoming transfers

**Reference format**
Use `BKE{agreementId}` as the OCR reference (e.g. `BKE20240089`).
This allows automatic matching in the BGMAX parser.

**Parse BGMAX file**
```ts
// Run daily via cron job: GET /api/payments/bank/reconcile
// Or set up SFTP listener

import { parseBGMAX } from '@/lib/bgmax-parser'; // build this parser

const transactions = parseBGMAX(fileContents);

for (const tx of transactions) {
  if (tx.reference.startsWith('BKE')) {
    const agreementId = tx.reference.replace('BKE', '');
    await db.payment.update({
      where: { agreementId, method: 'BANK_TRANSFER' },
      data: {
        status: 'CONFIRMED',
        confirmedAt: tx.date,
      },
    });
    // Delivery lock lifts
  }
}
```

**BGMAX file format documentation:**
https://www.bankgirot.se/globalassets/dokument/tekniska-manualer/bankgirots-tekniska-manual-bgmax-eng.pdf

---

### Option B — Open Banking via Tink (Real-time, recommended)

Tink (acquired by Visa) provides PSD2 Open Banking APIs for real-time payment confirmation.
Much faster than waiting for daily BGMAX files.

**Sign up**
1. Go to **tink.com** → Apply as a business
2. You receive `TINK_CLIENT_ID` and `TINK_CLIENT_SECRET`

```ts
// POST /api/payments/bank/initiate
// Initiates a Tink payment initiation (PIS — Payment Initiation Service)

const token = await fetch('https://api.tink.com/api/1/oauth/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: process.env.TINK_CLIENT_ID,
    client_secret: process.env.TINK_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'payment:read,payment:write',
  }),
});

// Create payment order → customer authorizes in their bank app
// Tink calls your webhook when payment clears (usually within seconds)
```

---

## 8. Delivery Lock Logic

This is enforced server-side. Never trust client state alone.

```ts
// lib/delivery.ts

export async function isDeliveryUnlocked(agreementId: string): Promise<boolean> {
  const payment = await db.payment.findFirst({
    where: { agreementId },
  });

  if (!payment) return false;

  // Financing: payout must be confirmed (not just approved)
  if (
    payment.method === 'FINANCING_SANTANDER' ||
    payment.method === 'FINANCING_SVEA'
  ) {
    return payment.payoutConfirmed === true;
  }

  // All other methods: status must be CONFIRMED
  return payment.status === 'CONFIRMED';
}
```

```ts
// app/api/delivery/[agreementId]/route.ts
// Called before any delivery action is taken

export async function GET(req: Request, { params }: { params: { agreementId: string } }) {
  const unlocked = await isDeliveryUnlocked(params.agreementId);

  if (!unlocked) {
    return Response.json(
      { error: 'DELIVERY_LOCKED', message: 'Payment not confirmed' },
      { status: 403 }
    );
  }

  return Response.json({ status: 'UNLOCKED' });
}
```

**HQ override:** Only a user with `role: 'HQ_ADMIN'` can bypass the lock.
Log every override to the audit log with timestamp, reason, and user ID.

---

## 9. Multi-Location Setup

Each location stores its own payment credentials in the DB.

```ts
// When processing a payment, always fetch location details first:
const location = await db.location.findUnique({
  where: { id: agreement.locationId },
});

// Use:
// location.swishNumber     → Swish merchant number
// location.bankgiro        → Bankgiro for bank transfer
// location.netsTerminalId  → Nets terminal to charge
// location.iban            → IBAN for bank transfer details shown to customer
```

**Revenue split:** Always tag revenue to the location that made the sale.
This feeds the per-location P&L dashboard in Analytics.

---

## 10. Environment Variables

Add all of these to `.env.local` (never commit to git):

```bash
# ── Santander ────────────────────────────────────────────────
SANTANDER_API_URL=https://api.santanderconsumer.se/dealer/v1
SANTANDER_API_KEY=your_key_here
SANTANDER_DEALER_ID=your_dealer_id

# ── Svea ─────────────────────────────────────────────────────
SVEA_API_KEY=your_key_here
SVEA_MERCHANT_ID=your_merchant_id

# ── Swish ────────────────────────────────────────────────────
SWISH_CERT_PASSPHRASE=your_cert_passphrase
# Certs go in /certs/ directory (gitignored)

# ── Nets ─────────────────────────────────────────────────────
NETS_SECRET_KEY=your_secret_key
NETS_CHECKOUT_KEY=your_checkout_key
NETS_WEBHOOK_SECRET=your_webhook_secret

# ── Tink (Open Banking) ──────────────────────────────────────
TINK_CLIENT_ID=your_client_id
TINK_CLIENT_SECRET=your_client_secret

# ── App ──────────────────────────────────────────────────────
NEXT_PUBLIC_BASE_URL=https://yourdomain.se
```

---

## Quick Reference — Go-Live Checklist

- [ ] Santander dealer agreement signed
- [ ] Svea partner account approved
- [ ] Swish Handel registered (one number per location)
- [ ] Swish M2M certificates placed in `/certs/`
- [ ] Nets Easy account created, terminals ordered
- [ ] Bankgiro numbers registered (one per location)
- [ ] BGMAX SFTP or Tink Open Banking configured
- [ ] All webhook endpoints deployed and tested
- [ ] `NEXT_PUBLIC_BASE_URL` set to production domain (webhooks won't work on localhost)
- [ ] Delivery lock logic tested end-to-end
- [ ] Fortnox accounting sync verified per payment method
- [ ] HQ admin override audit logging confirmed working
