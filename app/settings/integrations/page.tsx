'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { INTEGRATION_REGISTRY } from '@/lib/integrations/registry';
import type { IntegrationDef } from '@/lib/integrations/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldStatus = 'configured' | 'env' | 'empty';
type TestStatus  = 'idle' | 'testing' | 'ok' | 'failed';

interface IntegrationState {
  enabled:        boolean;
  expanded:       boolean;
  credentials:    Record<string, string>;
  testStatus:     TestStatus;
  testMessage:    string;
  fieldStatus:    Record<string, FieldStatus>;
  envVarDefaults: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFieldLabel(envVar: string, integrationId: string): string {
  const prefix   = integrationId.toUpperCase().replace(/-/g, '_') + '_';
  const stripped = envVar.startsWith(prefix) ? envVar.slice(prefix.length) : envVar;
  return stripped.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function isSecretField(envVar: string): boolean {
  return /PASSWORD|SECRET|KEY|TOKEN|PASSPHRASE/.test(envVar.toUpperCase());
}

function isUrlField(envVar: string): boolean {
  return envVar.toUpperCase().endsWith('_URL');
}

const CATEGORY_META: Record<string, { label: string; icon: string; desc: string }> = {
  accounting:    { label: 'Bokföring',      icon: '📊', desc: 'Fortnox — auto-fakturering och bokföring när avtal signeras' },
  registry:      { label: 'Fordonsregister', icon: '🚗', desc: 'Transportstyrelsen — fordonsuppgifter och digitalt ägarbyte' },
  marketplace:   { label: 'Annonsering',    icon: '📢', desc: 'Blocket — publicera och ta bort fordonsannonser automatiskt' },
  insurance:     { label: 'Försäkring',     icon: '🛡', desc: 'MC-försäkring direkt i kassan — offerter och direktbindning' },
  communication: { label: 'Kommunikation',  icon: '✉️', desc: 'E-post och SMS-notiser till kunder och personal' },
  crm:           { label: 'CRM',            icon: '🤝', desc: 'Kundrelationshantering och leadspårning' },
};

const CATEGORIES = ['accounting', 'registry', 'marketplace', 'insurance'];

function FieldStatusPip({ status }: { status: FieldStatus }) {
  if (status === 'configured') return <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ saved</span>;
  if (status === 'env')        return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">ENV</span>;
  return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">⚠ not set</span>;
}

function ConfiguredCount({ integration, fieldStatus }: { integration: IntegrationDef; fieldStatus: Record<string, FieldStatus> }) {
  const total   = integration.requiredEnvVars.filter(v => !v.endsWith('_URL')).length;
  if (total === 0) return null;
  const done    = Object.entries(fieldStatus).filter(([k, s]) => !k.endsWith('_URL') && s !== 'empty').length;
  const all     = done === total;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${all ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
      {done}/{total} configured
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsSettingsPage() {
  const router = useRouter();

  const [loading,          setLoading]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [saveResult,       setSaveResult]       = useState<'idle' | 'ok' | 'error'>('idle');
  const [dealerId,         setDealerId]         = useState('ava-mc');
  const [dealerName,       setDealerName]       = useState('AVA MC AB');
  const [integrationStates, setIntegrationStates] = useState<Record<string, IntegrationState>>({});
  const [showPasswords,    setShowPasswords]    = useState<Record<string, boolean>>({});
  const [restartBanner,    setRestartBanner]    = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/auth/login'); return; }
    const user = JSON.parse(raw);
    const id   = (user.dealershipName ?? user.dealership ?? 'ava-mc')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const name = user.dealershipName ?? user.dealership ?? 'AVA MC AB';
    setDealerId(id);
    setDealerName(name);
    loadConfig(id, name);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadConfig = useCallback(async (id: string, name: string) => {
    try {
      const res  = await fetch(`/api/settings/integrations?dealerId=${encodeURIComponent(id)}&dealerName=${encodeURIComponent(name)}`);
      const data = await res.json();

      const states: Record<string, IntegrationState> = {};
      for (const i of INTEGRATION_REGISTRY) {
        const item          = data.integrations?.find((x: { id: string }) => x.id === i.id);
        const envVarDefaults = item?.envVarDefaults ?? {};
        const fieldStatus   = item?.fieldStatus ?? {};
        const credentials: Record<string, string> = {};
        for (const envVar of i.requiredEnvVars) {
          if (isUrlField(envVar) && (fieldStatus[envVar] ?? 'empty') === 'empty' && envVarDefaults[envVar]) {
            credentials[envVar] = envVarDefaults[envVar];
          }
        }
        states[i.id] = {
          enabled:        data.enabledIntegrations?.includes(i.id) ?? false,
          expanded:       false,
          credentials,
          testStatus:     'idle',
          testMessage:    '',
          fieldStatus,
          envVarDefaults,
        };
      }
      setIntegrationStates(states);
    } catch (e) {
      console.error('Failed to load integration config', e);
    } finally {
      setLoading(false);
    }
  }, []);

  function toggleIntegration(id: string) {
    const current   = integrationStates[id];
    if (!current) return;
    const nowEnabled = !current.enabled;
    setIntegrationStates(prev => ({
      ...prev,
      [id]: { ...prev[id], enabled: nowEnabled, expanded: nowEnabled ? true : prev[id].expanded },
    }));
  }

  function toggleExpand(id: string) {
    setIntegrationStates(prev => ({
      ...prev,
      [id]: { ...prev[id], expanded: !prev[id].expanded },
    }));
  }

  function updateCredential(integrationId: string, field: string, value: string) {
    setIntegrationStates(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        credentials: { ...prev[integrationId].credentials, [field]: value },
        testStatus:  'idle',
      },
    }));
  }

  async function testIntegration(integrationId: string) {
    setIntegrationStates(prev => ({
      ...prev,
      [integrationId]: { ...prev[integrationId], testStatus: 'testing', testMessage: '' },
    }));
    try {
      const res  = await fetch(`/api/settings/integrations/${integrationId}/test`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealerId, credentials: integrationStates[integrationId].credentials }),
      });
      const data = await res.json();
      setIntegrationStates(prev => ({
        ...prev,
        [integrationId]: {
          ...prev[integrationId],
          testStatus:  data.success ? 'ok' : 'failed',
          testMessage: data.message ?? '',
        },
      }));
    } catch {
      setIntegrationStates(prev => ({
        ...prev,
        [integrationId]: { ...prev[integrationId], testStatus: 'failed', testMessage: 'Network error' },
      }));
    }
  }

  async function saveAll() {
    setSaving(true);
    setSaveResult('idle');
    try {
      const enabledIntegrations = Object.entries(integrationStates)
        .filter(([, s]) => s.enabled)
        .map(([id]) => id);

      const credentials: Record<string, Record<string, string>> = {};
      for (const [id, state] of Object.entries(integrationStates)) {
        const filled = Object.entries(state.credentials).filter(([, v]) => v.trim());
        if (filled.length > 0) credentials[id] = Object.fromEntries(filled);
      }

      const res = await fetch('/api/settings/integrations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealerId, dealerName, enabledIntegrations, credentials }),
      });

      if (!res.ok) throw new Error('Save failed');
      setSaveResult('ok');
      setRestartBanner(true);
      setTimeout(() => setSaveResult('idle'), 4000);
      await loadConfig(dealerId, dealerName);
    } catch {
      setSaveResult('error');
      setTimeout(() => setSaveResult('idle'), 4000);
    } finally {
      setSaving(false);
    }
  }

  const enabledCount = Object.values(integrationStates).filter(s => s.enabled).length;

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1">
        <div className="brand-top-bar" />

        <div className="p-6 max-w-4xl">

          {/* Header */}
          <div className="flex items-start justify-between mb-6 animate-fade-up">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">Settings</Link>
                {' / '}Integrations
              </p>
              <h1 className="text-2xl font-black text-[#0b1524]">Integrations</h1>
              <p className="text-sm text-slate-500 mt-1">
                Connect Fortnox, Transportstyrelsen, Blocket, and insurance providers.
                Credentials are stored server-side and never exposed in responses.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {saveResult === 'ok' && (
                <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 animate-fade-up">
                  ✓ Saved successfully
                </span>
              )}
              {saveResult === 'error' && (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                  ✗ Save failed — try again
                </span>
              )}
              <span className="text-xs text-slate-400">{enabledCount} integration{enabledCount !== 1 ? 's' : ''} enabled</span>
              <button
                onClick={saveAll}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e05a20] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          </div>

          {/* Restart banner */}
          {restartBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5 animate-fade-up flex items-start gap-3">
              <span className="text-lg shrink-0">ℹ️</span>
              <div className="flex-1 text-xs text-amber-800 space-y-1">
                <p className="font-bold">Credentials written to .env.local</p>
                <p>API calls work immediately via the config store. Restart the dev server (<code className="font-mono bg-amber-100 px-1 rounded">npm run dev</code>) for <code className="font-mono bg-amber-100 px-1 rounded">process.env</code> to update.</p>
              </div>
              <button onClick={() => setRestartBanner(false)} className="text-amber-400 hover:text-amber-700 text-lg leading-none shrink-0">×</button>
            </div>
          )}

          {/* Integration categories */}
          {CATEGORIES.map(category => {
            const items = INTEGRATION_REGISTRY.filter(i => i.category === category);
            const meta  = CATEGORY_META[category];
            return (
              <div key={category} className="mb-6 animate-fade-up">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{meta.icon}</span>
                  <div>
                    <h2 className="text-sm font-black text-[#0b1524] uppercase tracking-wide">{meta.label}</h2>
                    <p className="text-xs text-slate-400">{meta.desc}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map(integration => {
                    const state    = integrationStates[integration.id];
                    if (!state) return null;
                    const hasFields = integration.requiredEnvVars.filter(v => !v.endsWith('_URL')).length > 0;
                    const allFilled = hasFields && integration.requiredEnvVars
                      .filter(v => !v.endsWith('_URL'))
                      .every(v => state.fieldStatus[v] !== 'empty');

                    return (
                      <div
                        key={integration.id}
                        className={`bg-white rounded-xl border transition-all duration-200 ${
                          state.enabled ? 'border-[#FF6B2C]/30 shadow-sm' : 'border-slate-100'
                        }`}
                      >
                        {/* Card header */}
                        <div
                          className={`flex items-center gap-3 p-4 ${hasFields ? 'cursor-pointer' : ''}`}
                          onClick={() => hasFields && toggleExpand(integration.id)}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                            state.enabled ? 'bg-[#FF6B2C]/10' : 'bg-slate-50'
                          }`}>
                            {integration.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-slate-900">{integration.name}</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Live</span>
                              {state.enabled && (
                                <ConfiguredCount integration={integration} fieldStatus={state.fieldStatus} />
                              )}
                              {state.enabled && allFilled && (
                                <span className="text-[10px] font-bold text-green-600">✓ ready</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{integration.description}</p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                            {integration.docsUrl && (
                              <a
                                href={integration.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-slate-400 hover:text-[#FF6B2C] transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                Docs ↗
                              </a>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); toggleIntegration(integration.id); }}
                              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                                state.enabled ? 'bg-[#FF6B2C]' : 'bg-slate-200'
                              }`}
                            >
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
                                state.enabled ? 'left-5' : 'left-0.5'
                              }`} />
                            </button>
                          </div>

                          {hasFields && (
                            <svg
                              className={`w-4 h-4 text-slate-300 transition-transform duration-200 shrink-0 ${state.expanded ? 'rotate-180' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </div>

                        {/* Credential form */}
                        {state.expanded && (
                          <div className="border-t border-slate-50 px-4 pb-4 pt-3">
                            {hasFields ? (
                              <>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Credentials</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                  {integration.requiredEnvVars.map(envVar => {
                                    const label    = toFieldLabel(envVar, integration.id);
                                    const isUrl    = isUrlField(envVar);
                                    const isSecret = !isUrl && isSecretField(envVar);
                                    const status   = state.fieldStatus[envVar] ?? 'empty';
                                    const showKey  = `${integration.id}:${envVar}`;
                                    const shown    = showPasswords[showKey];

                                    return (
                                      <div key={envVar}>
                                        <div className="flex items-center justify-between mb-1">
                                          <label className="text-xs font-semibold text-slate-600">{label}</label>
                                          {isUrl ? (
                                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">URL</span>
                                          ) : (
                                            <FieldStatusPip status={status} />
                                          )}
                                        </div>
                                        <div className="relative">
                                          <input
                                            type={isSecret && !shown ? 'password' : 'text'}
                                            value={state.credentials[envVar] ?? ''}
                                            onChange={e => updateCredential(integration.id, envVar, e.target.value)}
                                            placeholder={
                                              isUrl
                                                ? (state.envVarDefaults[envVar] ?? envVar)
                                                : status !== 'empty'
                                                  ? '••••••••  (leave blank to keep existing)'
                                                  : envVar
                                            }
                                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 font-mono placeholder:font-sans placeholder:text-slate-300"
                                          />
                                          {isSecret && (
                                            <button
                                              type="button"
                                              onClick={() => setShowPasswords(p => ({ ...p, [showKey]: !p[showKey] }))}
                                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                            >
                                              {shown ? (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                              ) : (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Test connection */}
                                <div className="flex items-center gap-3 flex-wrap">
                                  <button
                                    onClick={() => testIntegration(integration.id)}
                                    disabled={state.testStatus === 'testing'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b1524] hover:bg-[#1a2a42] text-white text-xs font-bold transition-colors disabled:opacity-60"
                                  >
                                    {state.testStatus === 'testing' ? (
                                      <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Testing…</>
                                    ) : 'Test Connection'}
                                  </button>

                                  {state.testStatus === 'ok' && (
                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">
                                      ✓ {state.testMessage}
                                    </span>
                                  )}
                                  {state.testStatus === 'failed' && (
                                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                                      ✗ {state.testMessage}
                                    </span>
                                  )}
                                </div>

                                {/* API routes reference */}
                                {integration.apiRoutes && integration.apiRoutes.length > 0 && (
                                  <div className="mt-4 pt-3 border-t border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">API Routes</p>
                                    <div className="space-y-1">
                                      {integration.apiRoutes.map(route => (
                                        <div key={`${route.method}:${route.path}`} className="flex items-center gap-2 text-[10px]">
                                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                            route.method === 'GET'    ? 'bg-blue-100 text-blue-700' :
                                            route.method === 'POST'   ? 'bg-green-100 text-green-700' :
                                            route.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                                            'bg-slate-100 text-slate-600'
                                          }`}>
                                            {route.method}
                                          </span>
                                          <code className="font-mono text-slate-600">{route.path}</code>
                                          <span className="text-slate-400 truncate">{route.description}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-slate-400">No credentials required.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer note */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1 mt-2 mb-10">
            <p className="font-bold">🔒 Security note</p>
            <p>Credentials are stored server-side in <code className="font-mono bg-blue-100 px-1 rounded">data/integration-configs.json</code> and never exposed in API responses. Fields marked <strong>ENV</strong> are already configured via environment variables. For production, use encrypted secrets management.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
