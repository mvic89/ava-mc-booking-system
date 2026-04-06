import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PAYMENT_REGISTRY } from '@/lib/payments/registry';
import {
  getStoredConfig,
  saveStoredConfig,
  initDealerConfig,
  getProviderFieldStatuses,
} from '@/lib/payments/config-store';
import { writeEnvLocal } from '@/lib/env/writer';

// ─── Supabase helpers ─────────────────────────────────────────────────────────

interface SupabasePaymentConfig {
  provider_id:  string;
  active:       boolean;
  config:       Record<string, unknown>;
}

async function readFromSupabase(dealershipId: string): Promise<SupabasePaymentConfig[] | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from('payment_configs')
      .select('provider_id, active, config')
      .eq('dealership_id', dealershipId);
    if (error || !data) return null;
    return data as SupabasePaymentConfig[];
  } catch {
    return null;
  }
}

async function saveToSupabase(
  dealershipId:    string,
  enabledProviders: string[],
  primaryFinancing: string,
  credentials:     Record<string, Record<string, string>>,
): Promise<void> {
  const sb = getSupabaseAdmin();

  // Upsert all providers currently in the registry
  const upserts = PAYMENT_REGISTRY.map(p => ({
    dealership_id: dealershipId,
    provider_id:   p.id,
    active:        enabledProviders.includes(p.id),
    config:        {
      credentials:      credentials[p.id] ?? {},
      primaryFinancing: p.category === 'financing' ? primaryFinancing : undefined,
    },
  }));

  await sb.from('payment_configs').upsert(upserts, { onConflict: 'dealership_id,provider_id' });

  // Store primaryFinancing + meta in a special _settings row
  await sb.from('payment_configs').upsert([{
    dealership_id: dealershipId,
    provider_id:   '_settings',
    active:        false,
    config:        { primaryFinancing },
  }], { onConflict: 'dealership_id,provider_id' });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const dealershipId = req.nextUrl.searchParams.get('dealershipId');
    const dealerId     = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
    const dealerName   = req.nextUrl.searchParams.get('dealerName') ?? 'AVA MC AB';

    // Try Supabase first (when UUID available)
    if (dealershipId) {
      const rows = await readFromSupabase(dealershipId);
      if (rows && rows.length > 0) {
        const settingsRow  = rows.find(r => r.provider_id === '_settings');
        const primaryFin   = (settingsRow?.config?.primaryFinancing as string) ?? '';
        const enabledIds   = rows.filter(r => r.active && r.provider_id !== '_settings').map(r => r.provider_id);

        const providerStatuses = PAYMENT_REGISTRY.map(p => {
          const row         = rows.find(r => r.provider_id === p.id);
          const stored      = (row?.config?.credentials ?? {}) as Record<string, string>;
          const fieldStatus: Record<string, string> = {};
          for (const v of p.requiredEnvVars) {
            fieldStatus[v] = stored[v]?.trim() ? 'configured' : process.env[v]?.trim() ? 'env' : 'empty';
          }
          return { id: p.id, fieldStatus, envVarDefaults: p.envVarDefaults ?? {} };
        });

        return NextResponse.json({
          dealerId,
          dealerName,
          enabledProviders: enabledIds,
          primaryFinancing: primaryFin,
          providers:        providerStatuses,
        });
      }
    }

    // Fall back to file store
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

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealershipId?:     string;
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

    // 1. Save to file store (keeps getCredential() working for payment processing routes)
    saveStoredConfig({
      dealerId:         body.dealerId,
      dealerName:       body.dealerName ?? existing.dealerName,
      enabledProviders: body.enabledProviders,
      primaryFinancing: body.primaryFinancing,
      credentials:      mergedCredentials,
      updatedAt:        new Date().toISOString(),
    });

    // 2. Save to Supabase payment_configs (makes it realtime + DB-backed)
    if (body.dealershipId) {
      await saveToSupabase(
        body.dealershipId,
        body.enabledProviders,
        body.primaryFinancing,
        mergedCredentials,
      );
    }

    // 3. Write credentials + URL defaults to .env.local
    const envUpdates: Record<string, string> = {};
    for (const fields of Object.values(mergedCredentials)) {
      for (const [k, v] of Object.entries(fields)) {
        if (v?.trim()) envUpdates[k] = v.trim();
      }
    }
    for (const p of PAYMENT_REGISTRY) {
      for (const [k, v] of Object.entries(p.envVarDefaults ?? {})) {
        if (!envUpdates[k]) envUpdates[k] = v;
      }
    }
    writeEnvLocal(envUpdates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[settings/payments POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
