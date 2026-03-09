import { NextRequest, NextResponse } from 'next/server';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';
import {
  getStoredConfig,
  saveStoredConfig,
  initDealerConfig,
  getIntegrationFieldStatuses,
} from '@/lib/integrations/config-store';
import { writeEnvLocal } from '@/lib/env/writer';

/**
 * GET /api/settings/integrations?dealerId={id}
 *
 * Returns the dealer's current integration configuration:
 *   - Which integrations are enabled
 *   - For each integration: field status ('configured' | 'env' | 'empty')
 *   - envVarDefaults per integration (for pre-filling URL fields)
 */
export async function GET(req: NextRequest) {
  try {
    const dealerId   = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
    const dealerName = req.nextUrl.searchParams.get('dealerName') ?? 'AVA MC AB';

    const config = getStoredConfig(dealerId) ?? initDealerConfig(dealerId, dealerName);

    const integrationStatuses = INTEGRATION_REGISTRY.map(i => ({
      id:             i.id,
      fieldStatus:    getIntegrationFieldStatuses(dealerId, i.requiredEnvVars, i.id),
      envVarDefaults: i.envVarDefaults ?? {},
    }));

    return NextResponse.json({
      dealerId:             config.dealerId,
      dealerName:           config.dealerName,
      enabledIntegrations:  config.enabledIntegrations,
      updatedAt:            config.updatedAt,
      integrations:         integrationStatuses,
    });
  } catch (error: any) {
    console.error('[settings/integrations GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/settings/integrations
 *
 * Save the dealer's integration configuration.
 *
 * Body: {
 *   dealerId:             string
 *   dealerName?:          string
 *   enabledIntegrations:  string[]
 *   credentials: {
 *     [integrationId]: { [ENV_VAR_NAME]: value }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealerId:             string;
      dealerName?:          string;
      enabledIntegrations:  string[];
      credentials:          Record<string, Record<string, string>>;
    };

    const existing = getStoredConfig(body.dealerId) ??
      initDealerConfig(body.dealerId, body.dealerName ?? body.dealerId);

    // Merge credentials — only overwrite fields with non-empty new values
    const mergedCredentials = { ...existing.credentials };
    for (const [integrationId, fields] of Object.entries(body.credentials ?? {})) {
      if (!mergedCredentials[integrationId]) mergedCredentials[integrationId] = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value.trim()) mergedCredentials[integrationId][key] = value.trim();
      }
    }

    saveStoredConfig({
      dealerId:            body.dealerId,
      dealerName:          body.dealerName ?? existing.dealerName,
      enabledIntegrations: body.enabledIntegrations,
      credentials:         mergedCredentials,
      updatedAt:           new Date().toISOString(),
    });

    // Write credentials + URL defaults to .env.local
    const envUpdates: Record<string, string> = {};
    for (const fields of Object.values(mergedCredentials)) {
      for (const [k, v] of Object.entries(fields)) {
        if (v?.trim()) envUpdates[k] = v.trim();
      }
    }
    for (const i of INTEGRATION_REGISTRY) {
      for (const [k, v] of Object.entries(i.envVarDefaults ?? {})) {
        if (!envUpdates[k]) envUpdates[k] = v;
      }
    }
    writeEnvLocal(envUpdates);

    console.log(`[settings/integrations] Saved for dealer ${body.dealerId} — ${body.enabledIntegrations.length} integration(s) enabled`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[settings/integrations POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
