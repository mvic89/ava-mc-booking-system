import { NextRequest, NextResponse } from 'next/server';
import { PAYMENT_REGISTRY } from '@/lib/payments/registry';
import {
  getStoredConfig,
  saveStoredConfig,
  initDealerConfig,
  getProviderFieldStatuses,
} from '@/lib/payments/config-store';
import { writeEnvLocal } from '@/lib/env/writer';

/**
 * GET /api/settings/payments?dealerId={id}
 *
 * Returns the dealer's current payment configuration:
 *   - Which providers are enabled
 *   - For each provider: the status of each required credential field
 *     ('configured' | 'env' | 'empty') — NEVER the actual values
 */
export async function GET(req: NextRequest) {
  try {
    const dealerId   = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
    const dealerName = req.nextUrl.searchParams.get('dealerName') ?? 'AVA MC AB';

    const config = getStoredConfig(dealerId) ?? initDealerConfig(dealerId, dealerName);

    const providerStatuses = PAYMENT_REGISTRY.map(p => ({
      id:             p.id,
      fieldStatus:    getProviderFieldStatuses(dealerId, p.requiredEnvVars, p.id),
      envVarDefaults: p.envVarDefaults ?? {},
    }));

    return NextResponse.json({
      dealerId:         config.dealerId,
      dealerName:       config.dealerName,
      enabledProviders: config.enabledProviders,
      primaryFinancing: config.primaryFinancing,
      updatedAt:        config.updatedAt,
      providers:        providerStatuses,
    });
  } catch (error: any) {
    console.error('[settings/payments GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/settings/payments
 *
 * Save the dealer's payment configuration.
 *
 * Body: {
 *   dealerId:         string
 *   dealerName:       string
 *   enabledProviders: string[]
 *   primaryFinancing: string
 *   credentials: {
 *     [providerId]: { [ENV_VAR_NAME]: value }
 *   }
 * }
 *
 * Rules:
 * - Empty string values are ignored (keep existing stored value)
 * - Credentials are merged (not replaced) per provider
 * - Actual values are NEVER returned in the response
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealerId:          string;
      dealerName?:       string;
      enabledProviders:  string[];
      primaryFinancing:  string;
      credentials:       Record<string, Record<string, string>>;
    };

    const existing = getStoredConfig(body.dealerId) ??
      initDealerConfig(body.dealerId, body.dealerName ?? body.dealerId);

    // Merge credentials: only overwrite fields with non-empty new values
    const mergedCredentials = { ...existing.credentials };
    for (const [providerId, fields] of Object.entries(body.credentials ?? {})) {
      if (!mergedCredentials[providerId]) mergedCredentials[providerId] = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value.trim()) mergedCredentials[providerId][key] = value.trim();
      }
    }

    saveStoredConfig({
      dealerId:         body.dealerId,
      dealerName:       body.dealerName ?? existing.dealerName,
      enabledProviders: body.enabledProviders,
      primaryFinancing: body.primaryFinancing,
      credentials:      mergedCredentials,
      updatedAt:        new Date().toISOString(),
    });

    // Write credentials + URL defaults to .env.local so the file stays in sync
    const envUpdates: Record<string, string> = {};
    for (const fields of Object.values(mergedCredentials)) {
      for (const [k, v] of Object.entries(fields)) {
        if (v?.trim()) envUpdates[k] = v.trim();
      }
    }
    // Always ensure URL defaults are present even if admin never touched them
    for (const p of PAYMENT_REGISTRY) {
      for (const [k, v] of Object.entries(p.envVarDefaults ?? {})) {
        if (!envUpdates[k]) envUpdates[k] = v;
      }
    }
    writeEnvLocal(envUpdates);

    console.log(`[settings/payments] Saved config for dealer ${body.dealerId} — ${body.enabledProviders.length} provider(s) enabled`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[settings/payments POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
