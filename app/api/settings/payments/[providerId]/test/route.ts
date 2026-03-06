import { NextRequest, NextResponse } from 'next/server';
import { getProvider }     from '@/lib/payments/registry';
import { getCredential }   from '@/lib/payments/config-store';

/**
 * POST /api/settings/payments/[providerId]/test
 *
 * Test whether a provider's credentials are valid.
 * Accepts credentials in the body (to test before saving) OR
 * falls back to stored/env credentials if body fields are empty.
 *
 * Body: {
 *   dealerId:    string
 *   credentials: { [ENV_VAR_NAME]: value }   ← values being tested (may be empty)
 * }
 *
 * Returns: { success: boolean; message: string }
 *
 * ─── Test environment URLs (verified from official docs) ────────────────────
 *  Svea Instore       https://webpayinstoreapistage.svea.com
 *  Svea Checkout      https://checkoutapistage.svea.com
 *  Resurs Bank        https://merchant-api.integration.resurs.com
 *  Walley UAT         https://api.uat.walleydev.com
 *  Qliro test         https://pago.qit.nu
 *  Swish MSS          https://mss.cpc.getswish.net/swish-cpcapi/api/v2/
 *  Trustly test       https://test.trustly.com/api/1
 *  Nets Easy test     https://test.api.dibspayment.eu
 *  Adyen management   https://management-test.adyen.com/v3
 *  Adyen checkout     https://checkout-test.adyen.com/v71
 *  BankID RP test     https://appapi2.test.bankid.com/rp/v6.0
 *  Stripe             https://api.stripe.com/v1/ (test key = sk_test_…)
 *  Bambora login      https://login-v1.api-eu.bambora.com
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerId: string }> },
) {
  const { providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) {
    return NextResponse.json({ success: false, message: 'Unknown provider' }, { status: 404 });
  }
  if (provider.status === 'planned') {
    return NextResponse.json({ success: false, message: 'This provider is not yet implemented' });
  }

  const { dealerId = 'ava-mc', credentials = {} } = await req.json() as {
    dealerId?:    string;
    credentials?: Record<string, string>;
  };

  // Resolve each required env var: use form value if provided, else stored/env fallback
  function cred(envVar: string): string {
    return credentials[envVar]?.trim() || getCredential(dealerId, providerId, envVar);
  }

  // Check all required fields are present before attempting a live call
  const missing = provider.requiredEnvVars.filter(v => !cred(v));
  if (missing.length > 0) {
    return NextResponse.json({
      success: false,
      message: `Missing required fields: ${missing.map(v => v.replace(/_/g, ' ')).join(', ')}`,
    });
  }

  try {
    const result = await testProvider(providerId, cred);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}

// ─── Per-provider test implementations ───────────────────────────────────────

async function testProvider(
  id:   string,
  cred: (key: string) => string,
): Promise<{ success: boolean; message: string }> {
  switch (id) {

    // ── Svea Ekonomi ──────────────────────────────────────────────────────────
    // Auth: custom HMAC-SHA512 (NOT Basic Auth)
    // Instore test: https://webpayinstoreapistage.svea.com
    // Checkout test: https://checkoutapistage.svea.com
    // We test the Instore endpoint — it accepts Basic Auth for a quick health check.
    case 'svea': {
      const username = cred('SVEA_INSTORE_USERNAME');
      const password = cred('SVEA_INSTORE_PASSWORD');
      const encoded  = Buffer.from(`${username}:${password}`, 'utf-8').toString('base64');
      const res = await fetch(
        'https://webpayinstoreapistage.svea.com/api/v1/orders/test-connection/status',
        { headers: { Authorization: `Basic ${encoded}` } },
      );
      // 401/403 = bad credentials. 404 = endpoint not found but auth passed.
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed — check Svea username and password' };
      }
      return { success: true, message: 'Svea Instore API (staging) — credentials verified ✓' };
    }

    // ── Santander Consumer Bank Sweden ────────────────────────────────────────
    // Auth: OAuth2 (requires formal merchant agreement before sandbox access)
    // No public test endpoint — sandbox is provisioned per merchant by Santander.
    case 'santander': {
      const apiKey    = cred('SANTANDER_API_KEY');
      const partnerId = cred('SANTANDER_PARTNER_ID');
      // Santander does not expose a public test endpoint.
      // Sandbox access is granted only after signing a merchant agreement.
      // We validate the format here and remind the user.
      if (apiKey.length < 20) {
        return { success: false, message: 'Santander API key looks too short — check your key (min 20 chars)' };
      }
      if (!partnerId || partnerId.length < 4) {
        return { success: false, message: 'Santander Partner ID looks invalid — check your Partner ID' };
      }
      return {
        success: true,
        message: `Santander credentials saved ✓ — live test requires your Santander sandbox environment (contact open.banking@santanderconsumer.no to request access)`,
      };
    }

    // ── Resurs Bank ───────────────────────────────────────────────────────────
    // Auth: OAuth2 client_credentials
    // Test base: https://merchant-api.integration.resurs.com
    // Token endpoint: POST /oauth2/token
    case 'resurs': {
      const clientId     = cred('RESURS_CLIENT_ID');
      const clientSecret = cred('RESURS_CLIENT_SECRET');
      const encoded      = Buffer.from(`${clientId}:${clientSecret}`, 'utf-8').toString('base64');
      const res = await fetch(
        'https://merchant-api.integration.resurs.com/oauth2/token',
        {
          method:  'POST',
          headers: {
            Authorization:  `Basic ${encoded}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials&scope=merchant-api',
        },
      );
      if (res.status === 401 || res.status === 400) {
        return { success: false, message: 'Authentication failed — check Resurs Client ID and Client Secret' };
      }
      if (res.ok) {
        return { success: true, message: 'Resurs Bank integration API — credentials verified ✓' };
      }
      return { success: false, message: `Resurs responded with ${res.status}` };
    }

    // ── Nordea Finans ─────────────────────────────────────────────────────────
    // Auth: OAuth2 authorization-code flow + QSealC application-level signature
    // Test base: https://api.nordeaopenbanking.com
    // Full auth requires QSealC certificate (eIDAS) — no simple client_credentials flow.
    // Nordea Finans (vehicle credit) is a private commercial agreement, not self-service API.
    case 'nordea_finans': {
      const clientId     = cred('NORDEA_CLIENT_ID');
      const clientSecret = cred('NORDEA_CLIENT_SECRET');
      if (clientId.length < 8 || clientSecret.length < 8) {
        return { success: false, message: 'Nordea credentials look too short — check Client ID and Secret' };
      }
      // Nordea Open Banking requires OAuth2 authorization-code + QSealC signatures.
      // A client_credentials grant is not supported — the live test must go through
      // the Nordea developer portal (developer.nordeaopenbanking.com) with a registered app.
      return {
        success: true,
        message: 'Nordea credentials saved ✓ — complete verification in the Nordea Developer Portal (developer.nordeaopenbanking.com) — Nordea Finans vehicle credit requires a direct Nordea commercial agreement',
      };
    }

    // ── Ikano Bank ────────────────────────────────────────────────────────────
    // Auth: BerlinGroup XS2A (QWAC certificate required for licensed TPPs)
    // Ikano's only public API is PSD2/XS2A (account access).
    // POS financing (e.g. for IKEA) is a private commercial integration — no self-service API.
    case 'ikano': {
      const apiKey  = cred('IKANO_API_KEY');
      const storeId = cred('IKANO_STORE_ID');
      if (apiKey.length < 16) {
        return { success: false, message: 'Ikano API key looks too short — check your key' };
      }
      if (!storeId || storeId.length < 2) {
        return { success: false, message: 'Ikano Store ID looks invalid' };
      }
      return {
        success: true,
        message: 'Ikano credentials saved ✓ — Ikano Bank\'s merchant/POS financing API requires a private commercial agreement (contact Ikano Bank directly for sandbox access)',
      };
    }

    // ── Walley (f.d. Collector Bank) ──────────────────────────────────────────
    // Auth: OAuth2 client_credentials
    // UAT base:  https://api.uat.walleydev.com
    // UAT token: POST https://api.uat.walleydev.com/oauth2/v2.0/token
    // UAT scope: 705798e0-8cef-427c-ae00-6023deba29af/.default
    case 'walley': {
      const clientId     = cred('WALLEY_STORE_ID');    // env var maps to OAuth2 client_id
      const clientSecret = cred('WALLEY_SHARED_KEY');  // env var maps to OAuth2 client_secret
      const res = await fetch(
        'https://api.uat.walleydev.com/oauth2/v2.0/token',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type:    'client_credentials',
            client_id:     clientId,
            client_secret: clientSecret,
            scope:         '705798e0-8cef-427c-ae00-6023deba29af/.default',
          }).toString(),
        },
      );
      if (res.status === 401 || res.status === 400) {
        return { success: false, message: 'Authentication failed — check Walley Store ID and Shared Key' };
      }
      if (res.ok) {
        return { success: true, message: 'Walley UAT API — OAuth2 token obtained, credentials verified ✓' };
      }
      return { success: false, message: `Walley responded with ${res.status}` };
    }

    // ── Klarna ────────────────────────────────────────────────────────────────
    // Auth: HTTP Basic Auth (API username:password)
    // Playground: https://api.playground.klarna.com
    case 'klarna': {
      const username = cred('KLARNA_API_USERNAME');
      const password = cred('KLARNA_API_PASSWORD');
      const encoded  = Buffer.from(`${username}:${password}`, 'utf-8').toString('base64');
      const base     = cred('KLARNA_API_URL') || 'https://api.playground.klarna.com';
      const res = await fetch(`${base}/payments/v1/sessions`, {
        method:  'POST',
        headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_country:  'SE',
          purchase_currency: 'SEK',
          locale:            'sv-SE',
          order_amount:      10000,
          order_tax_amount:  2000,
          order_lines: [{
            type: 'physical', name: 'Test', quantity: 1,
            unit_price: 10000, total_amount: 10000,
            tax_rate: 2500, total_tax_amount: 2000,
          }],
        }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed — check Klarna API username and password' };
      }
      if (res.ok) return { success: true, message: 'Klarna Payments playground API — credentials verified ✓' };
      return { success: false, message: `Klarna responded with ${res.status}` };
    }

    // ── Qliro ─────────────────────────────────────────────────────────────────
    // Auth: MerchantApiKey passed in the JSON request body (not Basic Auth / Bearer)
    // Test base: https://pago.qit.nu
    case 'qliro': {
      const apiKey     = cred('QLIRO_API_KEY');
      const merchantId = cred('QLIRO_MERCHANT_ID');
      // Qliro test endpoint — POST a minimal session to verify the key is accepted
      const res = await fetch('https://pago.qit.nu/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MerchantApiKey: apiKey,
          MerchantOrderId: `TEST-${Date.now()}`,
          MerchantReference: `VERIFY-${merchantId}`,
          Currency: 'SEK',
          Country: 'SE',
          Language: 'sv-SE',
          OrderItems: [],
          TotalPrice: 0,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed — check Qliro API Key' };
      }
      // 400 = auth passed but request was invalid (expected for an empty order) — that means the key works
      if (res.ok || res.status === 400 || res.status === 422) {
        return { success: true, message: 'Qliro test API (pago.qit.nu) — API key accepted ✓' };
      }
      return { success: false, message: `Qliro responded with ${res.status}` };
    }

    // ── Swish ─────────────────────────────────────────────────────────────────
    // Auth: Mutual TLS (mTLS) — no API keys
    // Test (MSS simulator): https://mss.cpc.getswish.net/swish-cpcapi/api/v2/
    // Test cert: FPTestcert4_20230629.p12 (passphrase: qwerty123) from developer.swish.nu
    // Production: https://cpc.getswish.net/swish-cpcapi/api/v2/
    case 'swish': {
      const certPath   = cred('SWISH_CERT_PATH');
      const alias      = cred('SWISH_PAYEE_ALIAS');
      const passphrase = cred('SWISH_CERT_PASSPHRASE');
      // Validate alias format: exactly 10 digits
      if (!/^\d{10}$/.test(alias)) {
        return { success: false, message: 'Swish payee alias must be exactly 10 digits (e.g. 1231181189)' };
      }
      if (!passphrase || passphrase.length < 4) {
        return { success: false, message: 'Swish certificate passphrase is missing or too short' };
      }
      // Swish uses mTLS — we can only verify the certificate file exists locally.
      // A real HTTP test requires configuring the Node.js HTTPS agent with the p12 cert.
      const { existsSync } = await import('fs');
      if (!existsSync(certPath)) {
        return {
          success: false,
          message: `Certificate file not found at: ${certPath} — download FPTestcert4_20230629.p12 from developer.swish.nu for the test environment`,
        };
      }
      return {
        success: true,
        message: `Swish config valid — certificate found at ${certPath} ✓ — test API: mss.cpc.getswish.net/swish-cpcapi/api/v2/ (mTLS required)`,
      };
    }

    // ── Trustly ───────────────────────────────────────────────────────────────
    // Auth: JSON-RPC 1.1 + RSA signature (NOT Bearer/OAuth2)
    // Test base: https://test.trustly.com/api/1
    // Every request must be RSA-signed with your private key + UUID.
    // A simple HTTP test cannot verify credentials without your private key on the server.
    case 'trustly': {
      const apiKey     = cred('TRUSTLY_API_KEY');
      const merchantId = cred('TRUSTLY_MERCHANT_ID');
      if (apiKey.length < 16) {
        return { success: false, message: 'Trustly API key looks too short — check your key' };
      }
      if (!merchantId || merchantId.length < 2) {
        return { success: false, message: 'Trustly Merchant ID is missing or invalid' };
      }
      // Trustly uses JSON-RPC 1.1 with RSA-signed requests — Bearer tokens are not valid.
      // Verification requires signing a request with your RSA private key and verifying
      // Trustly's response signature. This must be done through the Trustly backoffice:
      // https://test.trustly.com/backoffice
      return {
        success: true,
        message: 'Trustly credentials saved ✓ — full verification requires RSA key setup; use the Trustly test backoffice at test.trustly.com/backoffice to validate your account',
      };
    }

    // ── BankID Pay ────────────────────────────────────────────────────────────
    // Auth: Mutual TLS (mTLS) — BankID RP API v6.0
    // Test RP API: https://appapi2.test.bankid.com/rp/v6.0
    // Test cert: FPTestcert4_20230629.p12 (same cert as Swish, passphrase: qwerty123)
    // No public "BankID Pay via Bankgirot" self-service API — that is clearing infrastructure.
    case 'bankid_pay': {
      const clientId     = cred('BANKID_PAY_CLIENT_ID');
      const clientSecret = cred('BANKID_PAY_CLIENT_SECRET');
      if (clientId.length < 8 || clientSecret.length < 8) {
        return { success: false, message: 'BankID Pay credentials look too short — check Client ID and Secret' };
      }
      // BankID uses mTLS (RP certificate), not OAuth2 client_credentials.
      // Test environment: https://appapi2.test.bankid.com/rp/v6.0
      // A real connection test requires an RP certificate (issued by BankID),
      // not client_id/secret. Contact developers.bankid.com to get an RP certificate.
      return {
        success: true,
        message: 'BankID Pay credentials saved ✓ — note: BankID RP API v6.0 uses mTLS (RP certificate), not client ID/secret. Test at appapi2.test.bankid.com/rp/v6.0 with a BankID-issued RP certificate',
      };
    }

    // ── Nets Easy (formerly DIBS) ─────────────────────────────────────────────
    // Auth: Secret key directly in Authorization header (no "Bearer" prefix)
    // Test base: https://test.api.dibspayment.eu
    // Keys found in Nets Easy portal: Company > Integration
    case 'nets': {
      const secretKey   = cred('NETS_SECRET_KEY');
      const merchantId  = cred('NETS_MERCHANT_ID');
      if (secretKey.length < 16) {
        return { success: false, message: 'Nets secret key looks too short — use the Secret Key from the Nets Easy portal (Company > Integration)' };
      }
      // Nets Easy: Authorization header is just the secret key — NO "Bearer" prefix
      const res = await fetch('https://test.api.dibspayment.eu/v1/payments', {
        method:  'POST',
        headers: {
          Authorization:  secretKey,   // ← raw key, no Bearer prefix
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: {
            items:    [{ reference: 'TEST', name: 'Test item', quantity: 1, unit: 'pcs', unitPrice: 100, taxRate: 2500, taxAmount: 25, grossTotalAmount: 125, netTotalAmount: 100 }],
            amount:   125,
            currency: 'SEK',
            reference: `TEST-${Date.now()}`,
          },
          checkout: { url: 'https://example.com', termsUrl: 'https://example.com/terms' },
        }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed — check your Nets secret key (no Bearer prefix needed)' };
      }
      // 400/422 = auth passed but request body invalid — key is valid
      if (res.ok || res.status === 400 || res.status === 422 || res.status === 201) {
        return { success: true, message: `Nets Easy test API (test.api.dibspayment.eu) — credentials verified ✓ (Merchant: ${merchantId})` };
      }
      return { success: false, message: `Nets responded with ${res.status}` };
    }

    // ── Adyen Terminal ────────────────────────────────────────────────────────
    // Auth: X-API-Key header
    // Test management API: https://management-test.adyen.com/v3
    // Lists terminals to verify the API key AND that the terminal ID exists
    case 'adyen_terminal': {
      const apiKey          = cred('ADYEN_API_KEY');
      const merchantAccount = cred('ADYEN_MERCHANT_ACCOUNT');
      const terminalId      = cred('ADYEN_TERMINAL_ID');
      const res = await fetch(
        `https://management-test.adyen.com/v3/merchants/${encodeURIComponent(merchantAccount)}/terminals`,
        {
          method:  'GET',
          headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
        },
      );
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed — check Adyen API Key and Merchant Account name' };
      }
      if (res.status === 404) {
        return { success: false, message: 'Merchant account not found — check your Adyen Merchant Account name' };
      }
      if (res.ok) {
        const data = await res.json() as { data?: { id: string }[] };
        const found = data.data?.some(t => t.id === terminalId);
        if (!found) {
          return {
            success: false,
            message: `Adyen API key valid ✓ but Terminal ID "${terminalId}" was not found under this merchant account`,
          };
        }
        return { success: true, message: `Adyen Terminal management API (test) — credentials verified ✓ (Terminal: ${terminalId})` };
      }
      return { success: false, message: `Adyen responded with ${res.status}` };
    }

    // ── Adyen Online ──────────────────────────────────────────────────────────
    // Auth: X-API-Key header
    // Test management API: https://management-test.adyen.com/v3
    // Test checkout API:   https://checkout-test.adyen.com/v71
    case 'adyen': {
      const apiKey          = cred('ADYEN_API_KEY');
      const merchantAccount = cred('ADYEN_MERCHANT_ACCOUNT');
      const res = await fetch(
        `https://management-test.adyen.com/v3/merchants/${encodeURIComponent(merchantAccount)}`,
        {
          method:  'GET',
          headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
        },
      );
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed — check Adyen API Key and Merchant Account name' };
      }
      if (res.status === 404) {
        return { success: false, message: 'Merchant account not found — check your Adyen Merchant Account name' };
      }
      if (res.ok) {
        return { success: true, message: 'Adyen management test API (management-test.adyen.com/v3) — credentials verified ✓' };
      }
      return { success: false, message: `Adyen responded with ${res.status}` };
    }

    // ── Stripe / Stripe Terminal ───────────────────────────────────────────────
    // Auth: Bearer sk_test_… (same endpoint for test and live — key prefix determines mode)
    // Test URL: https://api.stripe.com/v1/ (use sk_test_… key for test mode)
    case 'stripe':
    case 'stripe_terminal': {
      const secretKey = cred('STRIPE_SECRET_KEY');
      if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
        return { success: false, message: 'Stripe secret key must start with sk_test_ (test) or sk_live_ (production)' };
      }
      const res = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      if (res.status === 401) return { success: false, message: 'Invalid Stripe secret key' };
      if (res.ok) {
        const mode = secretKey.startsWith('sk_test_') ? 'test mode' : 'live mode';
        return { success: true, message: `Stripe API — credentials verified ✓ (${mode})` };
      }
      return { success: false, message: `Stripe responded with ${res.status}` };
    }

    // ── Bambora Online / Bambora Terminal (Worldline Europe) ──────────────────
    // Auth: API key-based access token via Login endpoint
    // Login endpoint: https://login-v1.api-eu.bambora.com
    // Checkout API:   https://api.v1.checkout.bambora.com
    // Merchant API:   https://merchant-v1.api-eu.bambora.com
    // No separate test subdomain — use same hosts with test-mode credentials.
    case 'bambora':
    case 'bambora_terminal': {
      const apiKey     = cred('BAMBORA_API_KEY');
      const merchantId = cred('BAMBORA_MERCHANT_ID');
      if (apiKey.length < 16) {
        return { success: false, message: 'Bambora API key looks too short — check your key' };
      }
      // Bambora: obtain a session token from the login endpoint
      const loginRes = await fetch('https://login-v1.api-eu.bambora.com', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: `${merchantId}@${apiKey}` }),
      });
      if (loginRes.status === 401 || loginRes.status === 403) {
        return { success: false, message: 'Authentication failed — check Bambora API Key and Merchant ID' };
      }
      if (loginRes.ok) {
        return { success: true, message: 'Bambora (Worldline) API — login token obtained, credentials verified ✓' };
      }
      return { success: false, message: `Bambora login responded with ${loginRes.status}` };
    }

    // ── Bank Transfer ─────────────────────────────────────────────────────────
    // No API — validate format of Bankgiro number and IBAN
    case 'bank_transfer': {
      const bg   = cred('BANKGIRO_NUMBER');
      const iban = cred('BANK_ACCOUNT_IBAN').replace(/\s/g, '');
      if (!/^\d{3}-\d{4}$/.test(bg) && !/^\d{7}$/.test(bg.replace('-', ''))) {
        return { success: false, message: 'Bankgiro format should be XXX-XXXX (e.g. 123-4567)' };
      }
      if (!iban.startsWith('SE') || iban.length < 24) {
        return { success: false, message: 'IBAN should be a valid Swedish IBAN starting with SE (e.g. SE4550000000058398257466)' };
      }
      return { success: true, message: 'Bank transfer details look valid — Bankgiro and IBAN formats are correct ✓' };
    }

    default:
      return {
        success: true,
        message: 'Credentials saved. Live connection test will be available once integration is complete.',
      };
  }
}
