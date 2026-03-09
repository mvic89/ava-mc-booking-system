# Payment Providers Integration Guide

> **System:** AVA MC Booking System (multi-dealer SaaS)
> **Registry:** `lib/payments/registry.ts` — single source of truth for all providers
> **Config:** `lib/payments/dealer-config.ts` — per-dealer enabled methods
> **Last updated:** 2026-03-02

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How the Registry Works](#2-how-the-registry-works)
3. [Onboarding a New Dealership](#3-onboarding-a-new-dealership)
4. [Adding a New Provider](#4-adding-a-new-provider)
5. [Provider Integrations — Financing](#5-financing-providers)
   - [5.1 Svea Ekonomi](#51-svea-ekonomi----live)
   - [5.2 Santander Consumer Bank](#52-santander-consumer-bank----stub)
   - [5.3 Resurs Bank](#53-resurs-bank----planned)
   - [5.4 Nordea Finans](#54-nordea-finans----planned)
   - [5.5 Ikano Bank](#55-ikano-bank----planned)
   - [5.6 Walley (f.d. Collector)](#56-walley-fd-collector----planned)
6. [Provider Integrations — BNPL](#6-bnpl-providers)
   - [6.1 Klarna](#61-klarna----live)
   - [6.2 Qliro](#62-qliro----planned)
7. [Provider Integrations — Instant Payment](#7-instant-payment-providers)
   - [7.1 Swish](#71-swish----stub)
   - [7.2 Trustly](#72-trustly----planned)
   - [7.3 BankID Pay](#73-bankid-pay----planned)
8. [Provider Integrations — Card Terminal](#8-card-terminal-providers)
   - [8.1 Nets AXEPT (Blipp)](#81-nets-axept----stub)
   - [8.2 Adyen Terminal](#82-adyen-terminal----planned)
   - [8.3 Stripe Terminal](#83-stripe-terminal----planned)
   - [8.4 Bambora Terminal](#84-bambora-terminal----planned)
9. [Provider Integrations — Card Online](#9-card-online-providers)
   - [9.1 Stripe](#91-stripe----planned)
   - [9.2 Adyen](#92-adyen----planned)
   - [9.3 Bambora Online](#93-bambora-online----planned)
10. [Provider Integrations — Bank Transfer](#10-bank-transfer)
    - [10.1 Banköverföring](#101-banköverföring----stub)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Production Checklist](#12-production-checklist)

---

## 1. Architecture Overview

```
lib/
  payments/
    types.ts          ← PaymentProviderDef interface, enums
    registry.ts       ← All 20 providers listed with metadata
    dealer-config.ts  ← Per-dealer: which providers are enabled
    index.ts          ← Helper functions (getEnabledProviders, etc.)
  svea/
    client.ts         ← Svea API calls (Instore + Admin + Checkout)
    auth.ts           ← HMAC + Basic Auth helpers
  klarna/
    client.ts         ← Klarna Payments API calls
  bankid/
    client.ts         ← BankID auth + sign
    ...
  [provider]/
    client.ts         ← one per provider (to be created)

app/api/
  svea/               ← Next.js route handlers for Svea
  klarna/             ← Next.js route handlers for Klarna
  [provider]/         ← one folder per provider (to be created)
```

**Data flow for a payment:**

```
Payment Page
  → reads getEnabledProviders(dealerId)       lib/payments/index.ts
  → renders a tab per provider
  → on submit → POST /api/[provider]/...      app/api/[provider]/
  → route handler calls lib/[provider]/client.ts
  → client.ts calls provider's external API
  → returns result → delivery unlocked
```

---

## 2. How the Registry Works

Every payment provider in the system is described by a `PaymentProviderDef` object in `lib/payments/registry.ts`. This tells the UI everything it needs to know — without touching any component code.

```ts
import { getEnabledProviders, isProviderEnabled, isProviderConfigured } from '@/lib/payments';

// All providers enabled for a dealer (respects status filter)
const providers = getEnabledProviders('ava-mc');

// Check a specific provider
if (isProviderEnabled('ava-mc', 'klarna')) { ... }

// Health check: are all env vars set?
if (isProviderConfigured('svea')) { ... }
```

**Status meanings:**

| Status | Meaning |
|--------|---------|
| `live` | Fully implemented and tested with real credentials |
| `partial` | API client exists, some routes or features missing |
| `stub` | UI tab exists but API calls are mocked/simulated |
| `planned` | In registry, not yet built — hidden from UI by default |

Providers with `planned` status are hidden unless the dealer config has `showPlanned: true`.

---

## 3. Onboarding a New Dealership

**One step:** Add an entry to `lib/payments/dealer-config.ts`.

```ts
{
  dealerId:         'moto-goteborg',
  dealerName:       'Moto Göteborg AB',
  primaryFinancing: 'resurs',         // shown first in financing tab
  enabledProviders: [
    'resurs',       // their preferred financing bank
    'klarna',       // BNPL
    'swish',        // instant payment
    'nets',         // card terminal / blipp
    'bank_transfer',
  ],
  // Optional: dealer has their own Klarna merchant account
  providerOverrides: {
    klarna: {
      KLARNA_API_USERNAME: 'PK99999_dealerspecific',
      KLARNA_API_PASSWORD: 'their_own_secret',
    },
  },
},
```

The payment UI at `/sales/leads/[id]/payment` will automatically render the correct tabs.

> **TODO (DB migration):** Replace `getDealerConfig()` in `dealer-config.ts` with:
> ```sql
> SELECT * FROM dealer_payment_configs WHERE dealer_id = $1
> ```

---

## 4. Adding a New Provider

**Checklist when integrating a brand-new provider:**

```
[ ] 1. Add entry to lib/payments/registry.ts
        — id, name, description, icon, category, capabilities,
          countries, currencies, authMethod, status: 'planned',
          requiredEnvVars, docsUrl

[ ] 2. Add required env vars to .env.example (with comments)

[ ] 3. Create lib/[provider]/client.ts
        — URL helpers (stage + production)
        — Auth helper (Basic Auth / HMAC / OAuth2 / API key)
        — TypeScript interfaces for request/response shapes
        — One exported async function per API operation

[ ] 4. Create app/api/[provider]/ route files
        — One route.ts file per logical endpoint group
        — Each handler: parse body → call client.ts → return JSON

[ ] 5. Add a UI tab component to the payment page
        — Follow the KlarnaTab or SveaInstoreFlow pattern

[ ] 6. Register the provider in registry.ts (update status to 'live')

[ ] 7. Enable for relevant dealers in dealer-config.ts
```

---

## 5. Financing Providers

### 5.1 Svea Ekonomi — ✅ live

**What it does:** Dealer creates an order in the DMS → Svea sends an SMS to the customer's phone → customer opens the link, selects a financing plan, signs with BankID. Funds are held by Svea until the dealer triggers delivery.

**Sign up:** https://www.svea.com/se/sv/foretag/betallosningar/ — apply for Instore + Payment Admin credentials.

**Env vars needed:**
```env
SVEA_INSTORE_USERNAME=your_username
SVEA_INSTORE_PASSWORD=your_password
SVEA_CHECKOUT_MERCHANT_ID=your_merchant_id
SVEA_CHECKOUT_SECRET=your_hmac_secret
SVEA_MERCHANT_NAME=AVA MC AB
# Optional overrides (remove 'stage' for production):
# SVEA_INSTORE_API_URL=https://webpayinstoreapi.svea.com
# SVEA_EXTERNAL_API_URL=https://paymentadminapi.svea.com
# SVEA_CHECKOUT_API_URL=https://checkoutapi.svea.com
```

**Files already created:**
- `lib/svea/auth.ts` — HMAC-SHA512 + Basic Auth helpers
- `lib/svea/client.ts` — all API functions
- `app/api/svea/` — 16 route files covering all endpoints

**Payment flow:**
```
1. Dealer fills in customer phone → POST /api/svea/order
2. Customer receives SMS → opens link → selects plan → signs with BankID
3. Svea calls POST /api/svea/callback → payment confirmed
4. Dealer clicks "Deliver" → POST /api/svea/order/[id]/deliver
5. Funds released to dealer
```

**Go to production:**
1. Remove `stage` from the three base URLs in `.env`
2. Register the callback once: call `registerCallbackSubscription()` from `lib/svea/client.ts`

---

### 5.2 Santander Consumer Bank — 🔶 stub

**What it does:** Consumer financing for vehicle purchases. Popular with Swedish car/motorcycle dealers. Customer applies online or in-store, receives credit decision in seconds.

**Sign up:** https://developer.santanderconsumer.se/ — apply for a Partner ID and API key.

**Env vars needed:**
```env
SANTANDER_API_KEY=your_api_key
SANTANDER_PARTNER_ID=your_partner_id
```

**Implementation steps:**

```
[ ] 1. Read docs at https://developer.santanderconsumer.se/
[ ] 2. Create lib/santander/client.ts
        — POST /v1/applications       Create financing application
        — GET  /v1/applications/{id}  Poll decision (Approved/Pending/Denied)
        — POST /v1/applications/{id}/approve-delivery  Confirm delivery
        — POST /v1/applications/{id}/cancel            Cancel application
[ ] 3. Create app/api/santander/
        — application/route.ts        POST create + GET status
        — application/[id]/deliver/route.ts
        — application/[id]/cancel/route.ts
[ ] 4. Replace mock SantanderTab in payment page with real API calls
[ ] 5. Update registry.ts status to 'live'
```

**Auth:** API key in `Authorization: Bearer {key}` header.

---

### 5.3 Resurs Bank — 📋 planned

**What it does:** Broad financing: instalment plans, revolving credit, co-branded card. Very common in Swedish vehicle retail.

**Sign up:** https://merchant-api.integration.resurs.com/ — contact Resurs for a merchant agreement.

**Env vars needed:**
```env
RESURS_CLIENT_ID=your_client_id
RESURS_CLIENT_SECRET=your_client_secret
# Optional:
# RESURS_API_URL=https://merchant-api.resurs.com  (production)
# RESURS_API_URL=https://merchant-api.integration.resurs.com  (test)
```

**Implementation steps:**

```
[ ] 1. Read Merchant API docs at https://merchant-api.integration.resurs.com/docs/
[ ] 2. Get an OAuth2 access token:
        POST https://merchant-api.integration.resurs.com/oauth2/token
        grant_type=client_credentials
[ ] 3. Create lib/resurs/client.ts
        — POST /v1/stores/{storeId}/checkout  Create checkout + get payment widget URL
        — GET  /v1/payments/{paymentId}        Get payment status
        — POST /v1/payments/{paymentId}/capture  Capture (deliver)
        — POST /v1/payments/{paymentId}/annul    Cancel
        — POST /v1/payments/{paymentId}/credit   Refund
[ ] 4. Create app/api/resurs/ route files
[ ] 5. Create ResursBankTab UI component in payment page
[ ] 6. Enable in dealer-config.ts for dealers that use Resurs
```

**Auth:** OAuth2 Client Credentials — exchange `RESURS_CLIENT_ID` + `RESURS_CLIENT_SECRET` for a Bearer token. Tokens expire in 3600s; cache and refresh automatically.

---

### 5.4 Nordea Finans — 📋 planned

**What it does:** Vehicle loans via Nordea. Requires a partnership agreement with Nordea Finans (separate from retail bank agreement).

**Sign up:** Contact Nordea Finans business team — https://www.nordea.se/foretag/produkter/finans/

**Env vars needed:**
```env
NORDEA_CLIENT_ID=your_client_id
NORDEA_CLIENT_SECRET=your_client_secret
```

**Implementation steps:**

```
[ ] 1. Apply for Nordea Finans partnership (non-trivial — takes weeks)
[ ] 2. Access developer portal at https://developer.nordeaopenbanking.com/
[ ] 3. Create lib/nordea-finans/client.ts
        — POST /v4/loans/applications   Submit loan application
        — GET  /v4/loans/applications/{id}  Poll status
        — POST /v4/loans/applications/{id}/disburse  Disburse when delivered
[ ] 4. Create app/api/nordea-finans/ route files
[ ] 5. Create NordeaFinansTab UI component
```

**Auth:** OAuth2 Client Credentials. Uses `https://api.nordeaopenbanking.com` (production).

---

### 5.5 Ikano Bank — 📋 planned

**What it does:** Consumer credit and instalment plans. Owned by INGKA (IKEA group), active in vehicle financing.

**Sign up:** https://www.ikanobank.se/foretag/ — contact for a store/dealer agreement.

**Env vars needed:**
```env
IKANO_API_KEY=your_api_key
IKANO_STORE_ID=your_store_id
```

**Implementation steps:**

```
[ ] 1. Apply for dealer agreement at ikanobank.se
[ ] 2. Get API documentation from Ikano after agreement signed
[ ] 3. Create lib/ikano/client.ts
        — POST /v1/credit/applications
        — GET  /v1/credit/applications/{id}
        — POST /v1/credit/applications/{id}/activate
        — POST /v1/credit/applications/{id}/cancel
[ ] 4. Create app/api/ikano/ route files
[ ] 5. Create IkanoTab UI component
```

**Auth:** API key in `X-Api-Key` header.

---

### 5.6 Walley (f.d. Collector) — 📋 planned

**What it does:** Checkout widget with invoice, part payment, and account. Previously "Collector Bank". B2C and B2B.

**Sign up:** https://developer.walleygroup.com/ — sign up for a test account.

**Env vars needed:**
```env
WALLEY_STORE_ID=your_store_id
WALLEY_SHARED_KEY=your_shared_key
```

**Implementation steps:**

```
[ ] 1. Sign up at developer.walleygroup.com
[ ] 2. Create lib/walley/client.ts
        Auth: HMAC-SHA256 of (storeId + timestamp + nonce + requestBody) in Authorization header
        — POST /pops/v1.0/walley-checkout/sessions  Create checkout session → iframe snippet
        — GET  /pops/v1.0/walley-checkout/{purchaseId}  Get purchase details
        — POST /pops/v1.0/walley-checkout/{purchaseId}/capture
        — POST /pops/v1.0/walley-checkout/{purchaseId}/cancel
        — POST /pops/v1.0/walley-checkout/{purchaseId}/credit
[ ] 3. Create app/api/walley/ route files
[ ] 4. Create WalleyTab UI component
```

**Auth:** Custom HMAC-SHA256 signature (similar to Svea HMAC but different formula — see Walley docs).

---

## 6. BNPL Providers

### 6.1 Klarna — ✅ live

**What it does:** Pay Now / Pay in 30 days / Pay over time. Klarna JS SDK renders an embedded payment widget inside the payment page.

**Sign up:** https://portal.klarna.com — apply for Klarna Payments API credentials.

**Env vars needed:**
```env
KLARNA_API_URL=https://api.playground.klarna.com  # test; use https://api.klarna.com for prod
KLARNA_API_USERNAME=PK12345_yourusername
KLARNA_API_PASSWORD=your_api_secret
```

**Files already created:**
- `lib/klarna/client.ts` — `createKlarnaSession()`, `createKlarnaOrder()`
- `app/api/klarna/session/route.ts` — POST create session → `client_token`
- `app/api/klarna/order/route.ts` — POST place order after authorization

**Payment flow:**
```
1. POST /api/klarna/session → receive client_token + payment_method_categories
2. Load SDK: <script src="https://x.klarnacdn.net/kp/lib/v1/api.js">
3. Klarna.Payments.init({ client_token })
4. Klarna.Payments.load({ container: '#klarna-container', payment_method_category })
5. Customer fills in Klarna widget
6. Klarna.Payments.authorize() → authorization_token
7. POST /api/klarna/order with authorization_token → order confirmed
```

**Go to production:**
1. Change `KLARNA_API_URL` to `https://api.klarna.com`
2. Add `x.klarnacdn.net` to your CSP `scriptSrc` in `next.config.js`
3. Implement `POST /api/klarna/callback` for capture/fraud webhooks

---

### 6.2 Qliro — 📋 planned

**What it does:** Nordic BNPL with an embedded checkout. Strong in Sweden and Norway.

**Sign up:** https://developers.qliro.com/ — contact Qliro for a merchant agreement.

**Env vars needed:**
```env
QLIRO_API_KEY=your_api_key
QLIRO_MERCHANT_ID=your_merchant_id
# QLIRO_API_URL=https://api.qliro.com  (production; test: https://sandbox.qliro.com)
```

**Implementation steps:**

```
[ ] 1. Get sandbox credentials at developers.qliro.com
[ ] 2. Create lib/qliro/client.ts
        Auth: Basic Auth (merchant_id:api_key, Base64)
        — POST /checkout/v1/orders         Create order → HTML snippet
        — GET  /checkout/v1/orders/{id}    Get order status
        — POST /checkout/v1/orders/{id}/capture  Capture
        — POST /checkout/v1/orders/{id}/cancel
        — POST /checkout/v1/orders/{id}/credit
[ ] 3. Create app/api/qliro/ route files
[ ] 4. Create QliroTab UI component
[ ] 5. Webhook: POST /api/qliro/callback for order status events
```

---

## 7. Instant Payment Providers

### 7.1 Swish — 🔶 stub

**What it does:** Real-time bank payments via the Swish app. Requires Swedish bank account. ~9 million Swedish users. Best for quick in-store payments.

**Sign up:** Via your bank (Handelsbanken, SEB, Swedbank, Nordea, etc.) — apply for Swish for merchants (Swish Handel).

**Env vars needed:**
```env
SWISH_PAYEE_ALIAS=1231181189       # Your Swish number (10 digits)
SWISH_CERT_PATH=./certs/swish.p12  # mTLS certificate from your bank
SWISH_CERT_PASSPHRASE=your_passphrase
# SWISH_API_URL=https://cpc.getswish.net/swish-cpcapi/api/v2  (production)
# SWISH_API_URL=https://mss.cpc.getswish.net/swish-cpcapi/api/v2  (test)
```

**Implementation steps:**

```
[ ] 1. Apply for Swish for merchants (Swish Handel) at your bank
[ ] 2. Download your mTLS certificate (.p12) from the bank
[ ] 3. Create lib/swish/client.ts
        Auth: mTLS — pass cert + passphrase to every fetch call
        — POST /paymentrequests   Create payment request
              Body: { payeeAlias, amount, currency: 'SEK', message }
              Swish sends a push notification to customer's phone
        — GET  /paymentrequests/{id}   Poll status (CREATED→PAID/DECLINED/ERROR)
        — POST /refunds               Create refund
        — GET  /refunds/{id}          Poll refund status
        Example using Node https with pfx:
        const agent = new https.Agent({ pfx: fs.readFileSync(certPath), passphrase });
        fetch(url, { agent })
[ ] 4. Create app/api/swish/ route files
        — payment/route.ts    POST create + GET status
        — refund/route.ts     POST create refund
[ ] 5. Remove mock from SwishTab in payment page — wire real API calls
```

**Notes:**
- Test environment uses a simulator app (Swish Test) instead of the real Swish app
- In production, the customer's phone buzzes instantly — no redirect needed
- Amounts: SEK only, minimum 1 kr, maximum 150 000 kr per transaction

---

### 7.2 Trustly — 📋 planned

**What it does:** Open banking — customer pays directly from their bank account without entering card details. Instant settlement.

**Sign up:** https://eu.developers.trustly.com/ — apply for Trustly for merchants.

**Env vars needed:**
```env
TRUSTLY_API_KEY=your_api_key
TRUSTLY_MERCHANT_ID=your_merchant_id
# TRUSTLY_API_URL=https://api.trustly.com  (production; test: https://test.trustly.com)
```

**Implementation steps:**

```
[ ] 1. Apply at eu.developers.trustly.com
[ ] 2. Create lib/trustly/client.ts
        Auth: Bearer token (OAuth2 client credentials)
        — POST /v1/merchants/{merchantId}/orders  Create order → redirect URL
        — GET  /v1/merchants/{merchantId}/orders/{id}  Get status
        — POST /v1/merchants/{merchantId}/orders/{id}/refunds
[ ] 3. Create app/api/trustly/ route files
[ ] 4. Create TrustlyTab component — opens a redirect or iframe
[ ] 5. Webhook: POST /api/trustly/callback for payment confirmation
```

---

### 7.3 BankID Pay — 📋 planned

**What it does:** Payment authorization using BankID — authentication and payment in one step via Bankgirot (Swedish clearing system). Bridges BankID (already integrated) and real-time bank payments.

**Sign up:** Contact Bankgirot — https://www.bankgirot.se/tjanster/bankid-betalning/

**Env vars needed:**
```env
BANKID_PAY_CLIENT_ID=your_client_id
BANKID_PAY_CLIENT_SECRET=your_client_secret
```

**Implementation steps:**

```
[ ] 1. Apply via Bankgirot for BankID Pay access
[ ] 2. Note: This re-uses the existing lib/bankid/ BankID integration
[ ] 3. Create lib/bankid-pay/client.ts
        — Initiate a payment with BankID signing
        — The existing lib/bankid/client.ts handles the BankID part
        — The Bankgirot part handles the actual fund transfer
[ ] 4. Create app/api/bankid-pay/ route files
```

---

## 8. Card Terminal Providers

### 8.1 Nets AXEPT — 🔶 stub

**What it does:** Physical card reader for in-store contactless (blipp/NFC), chip+PIN, and magnetic stripe payments. Most common terminal brand in Sweden.

**Sign up:** https://nets.eu — apply for Nets Easy (unified API for online + terminal).

**Env vars needed:**
```env
NETS_API_KEY=your_secret_api_key
NETS_MERCHANT_ID=your_merchant_id
NETS_TERMINAL_ID=NETS-STH-001        # unique per physical terminal location
# NETS_API_URL=https://api.dibspayment.eu  (production; test: https://test.api.dibspayment.eu)
```

**Implementation steps:**

```
[ ] 1. Sign up for Nets Easy at nets.eu — select 'automotive/dealership' category
[ ] 2. Each physical location gets a Terminal ID — store per location in DB
[ ] 3. Create lib/nets/client.ts
        Auth: Bearer token (your Nets secret API key)
        — POST /v1/payments             Create a payment → paymentId
        — POST /v1/payments/{id}/charges  Charge (capture) on terminal
              Body: { terminalId: 'NETS-STH-001' }
              Nets sends the amount to the physical terminal
        — GET  /v1/payments/{id}         Poll for chargeId (= payment confirmed)
        — POST /v1/payments/{id}/refunds  Refund a captured payment
        — GET  /v1/payments/{id}/refunds/{refundId}  Poll refund
[ ] 4. Create app/api/nets/ route files
        — payment/route.ts    POST create
        — payment/[id]/charge/route.ts   POST charge to terminal
        — payment/[id]/route.ts          GET status
        — payment/[id]/refund/route.ts   POST refund
[ ] 5. Remove simulation from CardTab in payment page — wire real API
[ ] 6. Webhook: POST /api/nets/callback for async charge/refund events
[ ] 7. Daily settlement report → export to Fortnox
```

**Notes:**
- One AXEPT terminal per physical location
- Terminal must be online (connected to internet) when charging
- Nets Easy can also handle online card payments (same API key)

---

### 8.2 Adyen Terminal — 📋 planned

**What it does:** Enterprise Android/Linux POS terminals. Best for chains with many locations needing unified reporting.

**Sign up:** https://www.adyen.com/pos-payments — contact Adyen sales.

**Env vars needed:**
```env
ADYEN_API_KEY=your_api_key
ADYEN_MERCHANT_ACCOUNT=YourMerchantAccount
ADYEN_TERMINAL_ID=P400Plus-123456789   # per physical terminal
# ADYEN_API_URL=https://checkout-test.adyen.com  (test)
# ADYEN_API_URL=https://checkout-live.adyen.com  (production)
```

**Implementation steps:**

```
[ ] 1. Apply via adyen.com — they assign a Merchant Account
[ ] 2. Create lib/adyen-terminal/client.ts
        Auth: API key in X-API-Key header
        Terminal API uses JSON over HTTPS (or local network for offline mode)
        — POST /v68/terminal/sync  Send a PaymentRequest to a specific terminal
              { SaleToPOIRequest: { MessageHeader, PaymentRequest: { ... } } }
        — POST /v68/terminal/async  For async terminal requests
        — POST /v1/cancel           Cancel an in-progress terminal request
[ ] 3. Create app/api/adyen-terminal/ route files
[ ] 4. Create AdyenTerminalTab UI component
```

---

### 8.3 Stripe Terminal — 📋 planned

**What it does:** Programmable card readers using Stripe's SDK. Best if Stripe is already used for online payments — unified dashboard and reporting.

**Sign up:** https://stripe.com/terminal — enable in your existing Stripe dashboard.

**Env vars needed:**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_LOCATION_ID=tml_loc_...  # created per physical location in Stripe dashboard
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Implementation steps:**

```
[ ] 1. Enable Terminal in Stripe Dashboard → order hardware (BBPOS WisePOS E or similar)
[ ] 2. Create a Location in Stripe for each dealership address
[ ] 3. Create lib/stripe-terminal/client.ts
        Use the official Stripe SDK: npm install stripe
        — POST /v1/terminal/connection_tokens  Get connection token for reader SDK
        — POST /v1/payment_intents             Create PaymentIntent
        — POST /v1/payment_intents/{id}/capture  Capture after card presented
        — POST /v1/refunds                     Refund
[ ] 4. Create app/api/stripe-terminal/ route files
[ ] 5. Create StripeTerminalTab UI component
```

---

### 8.4 Bambora Terminal — 📋 planned

**What it does:** Nordic card terminals (Worldline). Popular in Swedish retail. Same Bambora account can cover both terminal and online.

**Sign up:** https://developer.bambora.com/ — apply for merchant account.

**Env vars needed:**
```env
BAMBORA_API_KEY=your_api_key
BAMBORA_MERCHANT_ID=your_merchant_id
BAMBORA_TERMINAL_ID=T123456
```

**Implementation steps:**

```
[ ] 1. Apply at bambora.com for a Nordic merchant account
[ ] 2. Create lib/bambora-terminal/client.ts
        Auth: API key in Authorization header
        — POST /v1/merchant/{mid}/transactions/native  Send payment to terminal
        — GET  /v1/merchant/{mid}/transactions/{id}    Poll status
        — POST /v1/merchant/{mid}/transactions/{id}/capture
        — POST /v1/merchant/{mid}/transactions/{id}/refund
[ ] 3. Create app/api/bambora-terminal/ route files
[ ] 4. Create BamboraTerminalTab UI component
```

---

## 9. Card Online Providers

### 9.1 Stripe — 📋 planned

**What it does:** Online card payments. Best developer experience in the industry. Great for deposits or remote customers who pay before coming to pick up.

**Sign up:** https://stripe.com — create account, go live after identity verification.

**Env vars needed:**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Implementation steps:**

```
[ ] 1. Install Stripe SDK: npm install stripe @stripe/stripe-js @stripe/react-stripe-js
[ ] 2. Create lib/stripe/client.ts
        import Stripe from 'stripe';
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        — POST /v1/payment_intents           Create PaymentIntent
        — GET  /v1/payment_intents/{id}      Get status
        — POST /v1/payment_intents/{id}/confirm  Confirm
        — POST /v1/refunds                   Refund
[ ] 3. Create app/api/stripe/ route files
        — intent/route.ts         POST create PaymentIntent → client_secret
        — intent/[id]/route.ts    GET status
        — webhook/route.ts        POST Stripe webhook handler
[ ] 4. Create StripeTab UI component using @stripe/react-stripe-js
        — <Elements stripe={stripePromise}><PaymentElement /></Elements>
[ ] 5. Register webhook at stripe.com/dashboard/webhooks
        Listen for: payment_intent.succeeded, payment_intent.payment_failed
```

---

### 9.2 Adyen — 📋 planned

**What it does:** Enterprise-grade payments. Handles card, wallets, local payment methods globally. Good for larger dealership chains.

**Sign up:** https://www.adyen.com — contact sales or sign up for a test account.

**Env vars needed:**
```env
ADYEN_API_KEY=your_api_key
ADYEN_MERCHANT_ACCOUNT=YourMerchantAccount
ADYEN_CLIENT_KEY=your_client_key   # used in the browser-side SDK
ADYEN_WEBHOOK_HMAC=your_webhook_hmac_key
```

**Implementation steps:**

```
[ ] 1. Sign up at adyen.com → get test API key + merchant account
[ ] 2. Install SDK: npm install @adyen/api-library
[ ] 3. Create lib/adyen/client.ts
        — POST /checkout/v71/sessions    Create checkout session → sessionId + sessionData
        — POST /checkout/v71/payments    Process payment
        — POST /checkout/v71/payments/{ref}/captures   Capture
        — POST /checkout/v71/payments/{ref}/reversals  Cancel/refund
[ ] 4. Create app/api/adyen/ route files
[ ] 5. Create AdyenTab UI component using @adyen/adyen-web Drop-in
[ ] 6. Register webhook in Adyen Customer Area
```

---

### 9.3 Bambora Online — 📋 planned

**What it does:** Online card payments via Bambora (Worldline). Same credentials as Bambora Terminal if both are used.

**Sign up:** Same as Bambora Terminal — https://developer.bambora.com/

**Env vars needed:**
```env
BAMBORA_API_KEY=your_api_key
BAMBORA_MERCHANT_ID=your_merchant_id
```

**Implementation steps:**

```
[ ] 1. Create lib/bambora/client.ts
        Auth: base64(merchant_id:api_key) in Authorization: Token header
        — POST /v1/merchant/{mid}/sessions   Create hosted payment page session
        — GET  /v1/merchant/{mid}/transactions/{id}  Check status
        — POST /v1/merchant/{mid}/transactions/{id}/capture
        — POST /v1/merchant/{mid}/transactions/{id}/refund
[ ] 2. Create app/api/bambora/ route files
[ ] 3. Create BamboraOnlineTab UI component
```

---

## 10. Bank Transfer

### 10.1 Banköverföring — 🔶 stub

**What it does:** Customer makes a manual bank transfer using a Bankgiro number and OCR reference. No API needed — just display the payment details and poll for confirmation.

**Sign up:** Open a Bankgiro number at your bank. Optional: set up file-based reporting (BGC Autogiro) for automated reconciliation.

**Env vars needed:**
```env
BANKGIRO_NUMBER=123-4567
BANK_ACCOUNT_IBAN=SE4550000000058398257466
BANK_ACCOUNT_BIC=HANDSESS
```

**Implementation steps:**

```
[ ] 1. Display payment details in the BankTransferTab:
        — Bankgiro: 123-4567
        — OCR reference: AGR-2024-0089  (agreement number)
        — Amount: 119 952 kr
        — Recipient: AVA MC AB
[ ] 2. (Optional) Automate confirmation via BGC file import:
        — Your bank exports a daily BGC file listing received payments by OCR
        — Parse the file in a cron job to auto-confirm matching orders
[ ] 3. (Optional) Trustly can be used as a real-time alternative
        to manual bank transfer — see section 7.2
```

---

## 11. Environment Variables Reference

All variables with their provider and whether they're required for a live integration:

```env
# ── BankID ────────────────────────────────────────────────────────────────────
BANKID_ENV=test                      # 'test' or 'production'
BANKID_PFX_PATH=./certs/test.p12
BANKID_PFX_PASSPHRASE=qwerty123

# ── Roaring.io (address lookup) ───────────────────────────────────────────────
ROARING_CLIENT_ID=your_client_id
ROARING_CLIENT_SECRET=your_client_secret

# ── Svea Ekonomi ──────────────────────────────────────────────────────────────
SVEA_INSTORE_USERNAME=your_username          # Instore API (Basic Auth)
SVEA_INSTORE_PASSWORD=your_password
SVEA_CHECKOUT_MERCHANT_ID=your_merchant_id   # Admin + Checkout API (HMAC)
SVEA_CHECKOUT_SECRET=your_hmac_secret
SVEA_MERCHANT_NAME=AVA MC AB
# SVEA_INSTORE_API_URL=https://webpayinstoreapi.svea.com   (production)
# SVEA_EXTERNAL_API_URL=https://paymentadminapi.svea.com   (production)
# SVEA_CHECKOUT_API_URL=https://checkoutapi.svea.com       (production)

# ── Klarna ────────────────────────────────────────────────────────────────────
KLARNA_API_URL=https://api.playground.klarna.com   # test
KLARNA_API_USERNAME=PK12345_yourusername
KLARNA_API_PASSWORD=your_klarna_secret

# ── Santander ─────────────────────────────────────────────────────────────────
SANTANDER_API_KEY=your_api_key
SANTANDER_PARTNER_ID=your_partner_id

# ── Resurs Bank ───────────────────────────────────────────────────────────────
RESURS_CLIENT_ID=your_client_id
RESURS_CLIENT_SECRET=your_client_secret
# RESURS_API_URL=https://merchant-api.resurs.com   (production)

# ── Walley (Collector) ────────────────────────────────────────────────────────
WALLEY_STORE_ID=your_store_id
WALLEY_SHARED_KEY=your_shared_key

# ── Swish ─────────────────────────────────────────────────────────────────────
SWISH_PAYEE_ALIAS=1231181189
SWISH_CERT_PATH=./certs/swish.p12
SWISH_CERT_PASSPHRASE=your_passphrase

# ── Trustly ───────────────────────────────────────────────────────────────────
TRUSTLY_API_KEY=your_api_key
TRUSTLY_MERCHANT_ID=your_merchant_id

# ── Nets AXEPT ────────────────────────────────────────────────────────────────
NETS_API_KEY=your_secret_api_key
NETS_MERCHANT_ID=your_merchant_id
NETS_TERMINAL_ID=NETS-STH-001

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── Adyen ─────────────────────────────────────────────────────────────────────
ADYEN_API_KEY=your_api_key
ADYEN_MERCHANT_ACCOUNT=YourMerchantAccount
ADYEN_CLIENT_KEY=your_client_key
ADYEN_WEBHOOK_HMAC=your_webhook_hmac

# ── Bambora ───────────────────────────────────────────────────────────────────
BAMBORA_API_KEY=your_api_key
BAMBORA_MERCHANT_ID=your_merchant_id

# ── Qliro ─────────────────────────────────────────────────────────────────────
QLIRO_API_KEY=your_api_key
QLIRO_MERCHANT_ID=your_merchant_id

# ── Ikano Bank ────────────────────────────────────────────────────────────────
IKANO_API_KEY=your_api_key
IKANO_STORE_ID=your_store_id

# ── Nordea Finans ─────────────────────────────────────────────────────────────
NORDEA_CLIENT_ID=your_client_id
NORDEA_CLIENT_SECRET=your_client_secret

# ── Bank Transfer ─────────────────────────────────────────────────────────────
BANKGIRO_NUMBER=123-4567
BANK_ACCOUNT_IBAN=SE4550000000058398257466
BANK_ACCOUNT_BIC=HANDSESS

# ── App ───────────────────────────────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_DOMAIN=localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/ava_mc_booking
```

---

## 12. Production Checklist

For each provider you go live with, verify:

```
[ ] Credentials: production keys (not test/sandbox) set in .env
[ ] Base URLs: stage/sandbox URLs replaced with production URLs
[ ] Certificates: production mTLS certs installed (Swish, BankID)
[ ] Webhooks: callback/webhook URLs registered with the provider
[ ] HTTPS: all webhook endpoints are publicly accessible over HTTPS
[ ] CSP: Content Security Policy updated for any embedded SDKs (Klarna, Adyen)
[ ] Error handling: all API errors surface to the dealer (toast + log)
[ ] Refunds: refund flow tested end-to-end
[ ] Delivery: deliver/capture flow tested (funds actually arrive)
[ ] Reconciliation: daily settlement report tested (Svea /api/v2/reports, Nets, Stripe)
[ ] Fortnox: settlement data exported to accounting system
[ ] Rate limits: polling intervals respect provider limits (Svea: 1 req/5s)
[ ] Retry logic: failed API calls retry with exponential backoff
[ ] Secrets: no credentials committed to git
[ ] Logging: all payment events logged with order reference for audit trail
```

---

*For architecture questions, see `SYSTEM_ARCHITECTURE.md`.*
*For BankID setup, see `BANKID_SETUP.md`.*
*For Roaring.io address lookup, see `ROARING_API_SETUP.md`.*
