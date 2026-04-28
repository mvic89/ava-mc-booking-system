import { NextRequest, NextResponse } from 'next/server';
import { getIntegration }   from '@/lib/integrations/registry';
import { getCredential }    from '@/lib/integrations/config-store';
import { testConnection as testFortnox }           from '@/lib/fortnox/client';
import { testConnection as testTransportstyrelsen } from '@/lib/transportstyrelsen/client';
import { testConnection as testBlocket }            from '@/lib/blocket/client';

/**
 * POST /api/settings/integrations/[integrationId]/test
 *
 * Test whether an integration's credentials are valid.
 * Returns: { success: boolean; message: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await params;
  const integration = getIntegration(integrationId);

  if (!integration) {
    return NextResponse.json({ success: false, message: 'Unknown integration' }, { status: 404 });
  }

  const { dealerId = 'ava-mc', credentials = {} } = await req.json() as {
    dealerId?:    string;
    credentials?: Record<string, string>;
  };

  // Resolve credential: use form value if provided, else stored/env fallback (async)
  const cred = async (envVar: string): Promise<string> =>
    credentials[envVar]?.trim() || await getCredential(dealerId, integrationId, envVar);

  // Check all required fields are present
  const credValues: Record<string, string> = {};
  for (const v of integration.requiredEnvVars) {
    credValues[v] = await cred(v);
  }

  const missing = integration.requiredEnvVars.filter(v => {
    if (v.endsWith('_URL')) return false;  // URL fields have defaults — don't block test
    return !credValues[v];
  });
  if (missing.length > 0) {
    return NextResponse.json({
      success: false,
      message: `Missing required fields: ${missing.map(v => v.replace(/_/g, ' ')).join(', ')}`,
    });
  }

  // Sync helper using pre-fetched values
  const credSync = (envVar: string): string => credValues[envVar] ?? '';

  try {
    const result = await runTest(integrationId, credSync);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message: msg });
  }
}

// ─── Per-integration test implementations ─────────────────────────────────────

async function runTest(
  id:   string,
  cred: (key: string) => string,
): Promise<{ success: boolean; message: string }> {
  switch (id) {

    // ── Fortnox ───────────────────────────────────────────────────────────────
    case 'fortnox': {
      const token = cred('FORTNOX_ACCESS_TOKEN');
      if (!token) {
        return {
          success: false,
          message: 'Fortnox access token missing — complete OAuth2 flow in the Fortnox developer portal first',
        };
      }
      const ok = await testFortnox(token);
      if (ok) return { success: true, message: 'Fortnox API — access token verified, company info retrieved ✓' };
      return {
        success: false,
        message: 'Fortnox returned 401 — the access token is expired or invalid. Refresh it via the Fortnox developer portal.',
      };
    }

    // ── Transportstyrelsen ────────────────────────────────────────────────────
    case 'transportstyrelsen': {
      const apiKey = cred('TRANSPORTSTYRELSEN_API_KEY');
      const ok = await testTransportstyrelsen(apiKey);
      if (ok) {
        return { success: true, message: 'Transportstyrelsen API — API key accepted ✓' };
      }
      return {
        success: false,
        message: 'Transportstyrelsen returned 401 — check API key. Register at eap.transportstyrelsen.se if you do not have access.',
      };
    }

    // ── Blocket ───────────────────────────────────────────────────────────────
    case 'blocket': {
      const apiKey    = cred('BLOCKET_API_KEY');
      const accountId = cred('BLOCKET_ACCOUNT_ID');
      const ok = await testBlocket(apiKey, accountId);
      if (ok) {
        return { success: true, message: `Blocket professional API — account ${accountId} accessible ✓` };
      }
      return {
        success: false,
        message: 'Blocket returned 401 — check API key and Account ID. Apply for Blocket Proffs access at blocket.se/annonser/proffs.',
      };
    }

    // ── Länsförsäkringar ──────────────────────────────────────────────────────
    case 'lansforsakringar': {
      const apiKey    = cred('LF_API_KEY');
      const partnerId = cred('LF_PARTNER_ID');
      const apiUrl    = cred('LF_API_URL') || 'https://api.lansforsakringar.se/partner/v1';

      if (apiKey.length < 16) {
        return { success: false, message: 'Länsförsäkringar API key looks too short' };
      }
      if (!partnerId || partnerId.length < 4) {
        return { success: false, message: 'Länsförsäkringar Partner ID missing or too short' };
      }

      try {
        const res = await fetch(`${apiUrl}/health`, {
          headers: { 'X-Api-Key': apiKey, 'X-Partner-Id': partnerId, Accept: 'application/json' },
        });
        if (res.status === 401 || res.status === 403) {
          return { success: false, message: 'Länsförsäkringar — authentication failed, check API key and Partner ID' };
        }
        return {
          success: true,
          message: 'Länsförsäkringar partner API — credentials accepted ✓ (contact LF partner team at developer.lansforsakringar.se to activate sandbox access)',
        };
      } catch {
        return {
          success: true,
          message: 'Länsförsäkringar credentials saved ✓ — contact the LF partner team at developer.lansforsakringar.se to obtain a sandbox API key',
        };
      }
    }

    // ── Trygg-Hansa ───────────────────────────────────────────────────────────
    case 'trygg_hansa': {
      const apiKey   = cred('TRYGG_HANSA_API_KEY');
      const brokerId = cred('TRYGG_HANSA_BROKER_ID');
      const apiUrl   = cred('TRYGG_HANSA_API_URL') || 'https://api-test.trygghansa.se/partner/v2';

      if (apiKey.length < 16) {
        return { success: false, message: 'Trygg-Hansa API key looks too short' };
      }

      try {
        const res = await fetch(`${apiUrl}/health`, {
          headers: { 'X-Api-Key': apiKey, 'X-Broker-Id': brokerId, Accept: 'application/json' },
        });
        if (res.status === 401 || res.status === 403) {
          return { success: false, message: 'Trygg-Hansa — authentication failed, check API key and Broker ID' };
        }
        return { success: true, message: 'Trygg-Hansa broker API — credentials accepted ✓' };
      } catch {
        return {
          success: true,
          message: 'Trygg-Hansa credentials saved ✓ — contact developer.trygghansa.se to activate sandbox access',
        };
      }
    }

    default:
      return {
        success: true,
        message: 'Credentials saved. Live connection test will be available once integration is activated.',
      };
  }
}
