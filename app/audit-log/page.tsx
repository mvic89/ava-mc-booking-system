
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAutoRefresh } from '@/lib/realtime';
import { getDealershipId } from '@/lib/tenant';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'leads' | 'customers' | 'invoices' | 'payments' | 'bankid' | 'system';

interface AuditEntry {
  id:        string;
  action:    string;
  entity:    string;
  entityId:  string | null;
  summary:   string;
  details:   string | null;
  ipAddress: string | null;
  createdAt: string;
  tab:       Exclude<TabKey, 'all'>;
  href?:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  LEAD_CREATED:           'bg-emerald-50  text-emerald-700 border border-emerald-200',
  LEAD_STAGE_CHANGED:     'bg-blue-50     text-blue-700    border border-blue-200',
  LEAD_STATUS_CHANGED:    'bg-sky-50      text-sky-700     border border-sky-200',
  CUSTOMER_CREATED:       'bg-violet-50   text-violet-700  border border-violet-200',
  CUSTOMER_UPDATED:       'bg-indigo-50   text-indigo-700  border border-indigo-200',
  INVOICE_CREATED:        'bg-orange-50   text-orange-700  border border-orange-200',
  INVOICE_PAID:           'bg-green-50    text-green-700   border border-green-200',
  BANKID_AUTH:            'bg-[#235971]/10 text-[#235971]  border border-[#235971]/20',
  BANKID_SIGN:            'bg-[#235971]/10 text-[#235971]  border border-[#235971]/20',
  SIGN_AGREEMENT:         'bg-[#235971]/10 text-[#235971]  border border-[#235971]/20',
  AUTHORISATION:          'bg-amber-50    text-amber-700   border border-amber-200',
  PAYMENT:                'bg-purple-50   text-purple-700  border border-purple-200',
  WEBHOOK:                'bg-fuchsia-50  text-fuchsia-700 border border-fuchsia-200',
};

function actionColor(action: string): string {
  const up = action.toUpperCase();
  const key = Object.keys(ACTION_COLORS).find(k => up.includes(k));
  return key ? ACTION_COLORS[key] : 'bg-slate-100 text-slate-600 border border-slate-200';
}

function resolveTab(action: string, entity: string, source: Exclude<TabKey, 'all'>): Exclude<TabKey, 'all'> {
  if (source !== 'system') return source;
  const up = action.toUpperCase();
  const ent = entity.toLowerCase();
  if (up.includes('LEAD') || ent.includes('lead'))         return 'leads';
  if (up.includes('CUSTOMER') || ent.includes('customer')) return 'customers';
  if (up.includes('INVOICE') || ent.includes('invoice'))   return 'invoices';
  if (up.includes('BANKID') || ent.includes('bankid'))     return 'bankid';
  return 'system';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Data loader ───────────────────────────────────────────────────────────────

async function loadAllEntries(): Promise<AuditEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = getSupabaseBrowser() as any;
  const dealershipId = getDealershipId();
  if (!dealershipId) return [];

  // ── 1. Fetch all 6 sources in parallel ────────────────────────────────────
  const [auditRes, leadsRes, customersRes, invoicesRes, bankidCustRes, webhookRes] =
    await Promise.all([
      // audit_logs — filtered by new_data->>'dealership_id'
      sb.from('audit_logs')
        .select('id, action, entity, entity_id, new_data, ip_address, created_at')
        .filter('new_data->>dealership_id', 'eq', dealershipId)
        .order('created_at', { ascending: false })
        .limit(500),

      // leads — reconstruct LEAD_CREATED events
      sb.from('leads')
        .select('id, name, stage, created_at')
        .eq('dealership_id', dealershipId)
        .order('created_at', { ascending: false })
        .limit(300),

      // customers — reconstruct CUSTOMER_CREATED events
      sb.from('customers')
        .select('id, first_name, last_name, source, created_at')
        .eq('dealership_id', dealershipId)
        .order('created_at', { ascending: false })
        .limit(300),

      // invoices — reconstruct INVOICE_CREATED + INVOICE_PAID
      sb.from('invoices')
        .select('id, customer_name, total_amount, status, payment_method, paid_date, issue_date')
        .eq('dealership_id', dealershipId)
        .order('issue_date', { ascending: false })
        .limit(300),

      // customer IDs for this dealership (for bankid_logs lookup)
      sb.from('customers')
        .select('id')
        .eq('dealership_id', dealershipId)
        .limit(1000),

      // webhook_events — all recent (no dealership_id column)
      sb.from('webhook_events')
        .select('id, provider, event_type, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

  // ── 2. Fetch BankID logs for this dealership's customers ──────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerIds: number[] = (bankidCustRes.data ?? []).map((r: any) => r.id as number);
  let bankidEntries: AuditEntry[] = [];
  if (customerIds.length > 0) {
    const { data: bankidRows } = await sb
      .from('customer_bankid_logs')
      .select('id, customer_id, action, status, personal_number, ip_address, created_at')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(300);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bankidEntries = (bankidRows ?? []).map((r: any): AuditEntry => ({
      id:        `bankid-${r.id}`,
      action:    r.action === 'sign_agreement' ? 'BANKID_SIGN' : 'BANKID_AUTH',
      entity:    'customer',
      entityId:  String(r.customer_id),
      summary:   `BankID ${r.action === 'sign_agreement' ? 'signering' : 'verifiering'} — ${r.status} (${r.personal_number ?? '—'})`,
      details:   `Status: ${r.status}${r.personal_number ? ` · PNR: ${r.personal_number}` : ''}`,
      ipAddress: r.ip_address ?? null,
      createdAt: r.created_at,
      tab:       'bankid',
      href:      `/customers/${r.customer_id}`,
    }));
  }

  // ── 3. Build audit_log entries ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditEntries: AuditEntry[] = (auditRes.data ?? []).map((r: any): AuditEntry => {
    const action = String(r.action ?? '');
    const entity = String(r.entity ?? '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nd: Record<string, any> = r.new_data ?? {};

    // Build a human-readable summary from new_data fields
    let summary = action;
    if (nd.name)           summary = nd.name;
    else if (nd.customer_name) summary = nd.customer_name;
    else if (nd.stage)     summary = `Stage → ${nd.stage}`;
    else if (nd.lead_status) summary = `Status → ${nd.lead_status}`;

    let details: string | null = null;
    const detailParts: string[] = [];
    if (nd.vehicle)         detailParts.push(`Fordon: ${nd.vehicle}`);
    if (nd.total_amount)    detailParts.push(`Belopp: ${Number(nd.total_amount).toLocaleString('sv-SE')} kr`);
    if (nd.payment_method)  detailParts.push(`Betalning: ${nd.payment_method}`);
    if (nd.stage)           detailParts.push(`Stage: ${nd.stage}`);
    if (nd.lead_status)     detailParts.push(`Status: ${nd.lead_status}`);
    if (nd.source)          detailParts.push(`Källa: ${nd.source}`);
    if (detailParts.length) details = detailParts.join(' · ');

    let href: string | undefined;
    const entityId = r.entity_id ? String(r.entity_id) : null;
    if (entity === 'lead' && entityId) href = `/sales/leads/${entityId}`;
    if (entity === 'customer' && entityId) href = `/customers/${entityId}`;
    if (entity === 'invoice' && entityId) href = `/invoices`;

    const tab = resolveTab(action, entity, 'system');
    return { id: `al-${r.id}`, action, entity, entityId, summary, details, ipAddress: r.ip_address ?? null, createdAt: r.created_at, tab, href };
  });

  // ── 4. Build reconstructed lead events (LEAD_CREATED) ─────────────────────
  // Use Set to avoid duplicating leads already present in audit_logs
  const auditLeadIds = new Set(
    auditEntries.filter(e => e.entity === 'lead' && e.action === 'LEAD_CREATED').map(e => e.entityId)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadEntries: AuditEntry[] = (leadsRes.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => !auditLeadIds.has(String(r.id)))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any): AuditEntry => ({
      id:        `lead-${r.id}`,
      action:    'LEAD_CREATED',
      entity:    'lead',
      entityId:  String(r.id),
      summary:   String(r.name ?? '—'),
      details:   `Stage: ${r.stage ?? 'new'}`,
      ipAddress: null,
      createdAt: r.created_at,
      tab:       'leads',
      href:      `/sales/leads/${r.id}`,
    }));

  // ── 5. Build reconstructed customer events ─────────────────────────────────
  const auditCustIds = new Set(
    auditEntries.filter(e => e.entity === 'customer' && e.action === 'CUSTOMER_CREATED').map(e => e.entityId)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerEntries: AuditEntry[] = (customersRes.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => !auditCustIds.has(String(r.id)))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any): AuditEntry => ({
      id:        `cust-${r.id}`,
      action:    'CUSTOMER_CREATED',
      entity:    'customer',
      entityId:  String(r.id),
      summary:   `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || '—',
      details:   `Källa: ${r.source ?? 'Manual'}`,
      ipAddress: null,
      createdAt: r.created_at,
      tab:       'customers',
      href:      `/customers/${r.id}`,
    }));

  // ── 6. Build reconstructed invoice events ─────────────────────────────────
  const auditInvIds = new Set(
    auditEntries.filter(e => e.entity === 'invoice').map(e => e.entityId)
  );
  const invoiceEntries: AuditEntry[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (invoicesRes.data ?? []) as any[]) {
    const invId = String(r.id);
    if (!auditInvIds.has(invId)) {
      invoiceEntries.push({
        id:        `inv-${r.id}`,
        action:    'INVOICE_CREATED',
        entity:    'invoice',
        entityId:  invId,
        summary:   String(r.customer_name ?? '—'),
        details:   `${Number(r.total_amount).toLocaleString('sv-SE')} kr · ${r.payment_method ?? '—'}`,
        ipAddress: null,
        createdAt: r.issue_date,
        tab:       'invoices',
        href:      `/invoices`,
      });
    }
    if (r.status === 'paid' && r.paid_date) {
      invoiceEntries.push({
        id:        `invpaid-${r.id}`,
        action:    'INVOICE_PAID',
        entity:    'invoice',
        entityId:  invId,
        summary:   String(r.customer_name ?? '—'),
        details:   `${Number(r.total_amount).toLocaleString('sv-SE')} kr · ${r.payment_method ?? '—'}`,
        ipAddress: null,
        createdAt: r.paid_date,
        tab:       'invoices',
        href:      `/invoices`,
      });
    }
  }

  // ── 7. Build webhook events ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webhookEntries: AuditEntry[] = (webhookRes.data ?? []).map((r: any): AuditEntry => ({
    id:        `wh-${r.id}`,
    action:    String(r.event_type ?? 'WEBHOOK'),
    entity:    String(r.provider ?? 'webhook'),
    entityId:  null,
    summary:   `${r.provider} — ${r.event_type}`,
    details:   (() => {
      try {
        const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
        const amount = p?.amount ?? p?.order?.amount ?? p?.payment?.amount;
        const ref    = p?.order_id ?? p?.orderReference ?? p?.klarna_order_id;
        if (amount || ref) return [ref && `Ref: ${ref}`, amount && `${Number(amount) / 100} kr`].filter(Boolean).join(' · ');
      } catch { /* ignore */ }
      return null;
    })(),
    ipAddress: null,
    createdAt: r.created_at,
    tab:       'payments',
  }));

  // ── 8. Combine and sort ────────────────────────────────────────────────────
  const all: AuditEntry[] = [
    ...auditEntries,
    ...leadEntries,
    ...customerEntries,
    ...invoiceEntries,
    ...bankidEntries,
    ...webhookEntries,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return all;
}

// ── Component ─────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'all',       label: 'Alla',       icon: '📋' },
  { key: 'leads',     label: 'Leads',      icon: '🎯' },
  { key: 'customers', label: 'Kunder',     icon: '👤' },
  { key: 'invoices',  label: 'Fakturor',   icon: '🧾' },
  { key: 'payments',  label: 'Betalning',  icon: '💳' },
  { key: 'bankid',    label: 'BankID',     icon: '🔐' },
  { key: 'system',    label: 'System',     icon: '⚙️'  },
];

export default function AuditLogPage() {
  const t      = useTranslations('pages');
  const router = useRouter();

  const [entries,  setEntries]  = useState<AuditEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [wsLive,   setWsLive]   = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAllEntries();
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw);
    if (u.role !== 'admin') {
      toast.error('Audit-loggen är bara tillgänglig för administratörer.');
      router.replace('/dashboard');
      return;
    }

    refresh();

    // ── Subscribe to audit_logs and webhook_events for real-time updates ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    const dealershipId = getDealershipId();

    const ch = sb
      .channel('audit-log-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const nd = payload.new?.new_data ?? {};
          if (nd.dealership_id && nd.dealership_id !== dealershipId) return;
          // Full reload to get reconstructed summary
          refresh();
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webhook_events' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const r = payload.new;
          const newEntry: AuditEntry = {
            id:        `wh-${r.id}`,
            action:    String(r.event_type ?? 'WEBHOOK'),
            entity:    String(r.provider ?? 'webhook'),
            entityId:  null,
            summary:   `${r.provider} — ${r.event_type}`,
            details:   null,
            ipAddress: null,
            createdAt: r.created_at,
            tab:       'payments',
          };
          setEntries(prev => [newEntry, ...prev]);
          toast.success(`Webhook: ${r.event_type} (${r.provider})`);
        })
      .subscribe((status: string) => { setWsLive(status === 'SUBSCRIBED'); });

    channelRef.current = ch;
    return () => {
      sb.removeChannel(ch);
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(refresh);

  // ── Filter + tab ──────────────────────────────────────────────────────────

  const tabFiltered = activeTab === 'all' ? entries : entries.filter(e => e.tab === activeTab);
  const filtered = filter
    ? tabFiltered.filter(e =>
        e.action.toLowerCase().includes(filter.toLowerCase()) ||
        e.entity.toLowerCase().includes(filter.toLowerCase()) ||
        e.summary.toLowerCase().includes(filter.toLowerCase()) ||
        (e.entityId ?? '').toLowerCase().includes(filter.toLowerCase()) ||
        (e.details  ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : tabFiltered;

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts: Record<TabKey, number> = {
    all:       entries.length,
    leads:     entries.filter(e => e.tab === 'leads').length,
    customers: entries.filter(e => e.tab === 'customers').length,
    invoices:  entries.filter(e => e.tab === 'invoices').length,
    payments:  entries.filter(e => e.tab === 'payments').length,
    bankid:    entries.filter(e => e.tab === 'bankid').length,
    system:    entries.filter(e => e.tab === 'system').length,
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCsv() {
    const rows = [
      ['Tidpunkt', 'Åtgärd', 'Entitet', 'ID', 'Sammanfattning', 'Detaljer', 'IP'],
      ...filtered.map(e => [
        fmtDate(e.createdAt),
        e.action,
        e.entity,
        e.entityId ?? '',
        e.summary,
        e.details ?? '',
        e.ipAddress ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">
                📜 {t('auditLog.title')}
              </h1>
              <p className="text-sm text-slate-500 mt-1">{t('auditLog.desc')}</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* WebSocket live indicator */}
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5
                ${wsLive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block
                  ${wsLive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                {wsLive ? 'Live' : 'Ansluter…'}
              </span>

              <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                {entries.length} poster totalt
              </span>

              <button
                onClick={exportCsv}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#FF6B2C] text-white hover:bg-[#e55a1e] transition-colors"
              >
                ↓ Exportera CSV
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="mt-4 flex gap-1 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                  ${activeTab === tab.key
                    ? 'bg-[#0b1524] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                  ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-white text-slate-500'}`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Sök åtgärd, namn eller ID…"
                className="w-72 pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {filter && (
              <button onClick={() => setFilter('')} className="text-xs text-slate-400 hover:text-slate-700">
                Rensa
              </button>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {filtered.length} poster visas
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 md:px-8 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Laddar händelselogg…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-slate-400">
              <div className="text-5xl mb-4">📜</div>
              <p className="text-sm font-semibold">Inga poster hittades.</p>
              {filter && <p className="text-xs mt-1 text-slate-300">Prova att rensa sökningen.</p>}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {['Tidpunkt', 'Åtgärd', 'Sammanfattning', 'Entitet', 'Detaljer', 'IP'].map(h => (
                        <th key={h} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, i) => (
                      <tr
                        key={e.id + i}
                        className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Tidpunkt */}
                        <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap font-mono">
                          {fmtDate(e.createdAt)}
                        </td>

                        {/* Åtgärd badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${actionColor(e.action)}`}>
                            {e.action}
                          </span>
                        </td>

                        {/* Sammanfattning (with optional link) */}
                        <td className="px-5 py-3.5 font-medium text-slate-700 max-w-[200px]">
                          {e.href ? (
                            <Link href={e.href} className="hover:text-[#FF6B2C] hover:underline transition-colors truncate block">
                              {e.summary}
                            </Link>
                          ) : (
                            <span className="truncate block">{e.summary}</span>
                          )}
                        </td>

                        {/* Entitet + ID */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-xs text-slate-500 capitalize">{e.entity}</span>
                          {e.entityId && (
                            <span className="ml-1.5 text-[10px] font-mono text-slate-300">#{e.entityId}</span>
                          )}
                        </td>

                        {/* Detaljer */}
                        <td className="px-5 py-3.5 text-xs text-slate-400 max-w-[220px] truncate" title={e.details ?? ''}>
                          {e.details ?? '—'}
                        </td>

                        {/* IP */}
                        <td className="px-5 py-3.5 text-[11px] font-mono text-slate-300 whitespace-nowrap">
                          {e.ipAddress ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Visar {filtered.length} av {entries.length} poster
                  {activeTab !== 'all' && ` · Filtrerat: ${TABS.find(t => t.key === activeTab)?.label}`}
                </p>
                <button onClick={refresh} className="text-xs text-[#FF6B2C] hover:underline font-semibold">
                  Uppdatera
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
