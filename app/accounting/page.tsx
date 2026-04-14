
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAutoRefresh } from '@/lib/realtime';
import { getDealershipId } from '@/lib/tenant';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FortnoxStatus {
  tokenConfigured: boolean;
  connected:       boolean;
  companyName:     string | null;
  stats: {
    total:   number;
    synced:  number;
    pending: number;
    failed:  number;
  };
}

interface InvoiceRow {
  id:                     string;
  issue_date:             string;
  customer_name:          string;
  vehicle:                string;
  total_amount:           number;
  payment_method:         string;
  status:                 string;
  fortnox_invoice_number: string | null;
  fortnox_synced_at:      string | null;
  fortnox_sync_error:     string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 0 }) + ' kr';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const t            = useTranslations('accounting');

  const [status,    setStatus]    = useState<FortnoxStatus | null>(null);
  const [invoices,  setInvoices]  = useState<InvoiceRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState<string | 'all' | null>(null);
  const [filter,    setFilter]    = useState('');
  const [tab,       setTab]       = useState<'all' | 'synced' | 'pending' | 'failed'>('all');

  const dealershipId = getDealershipId();

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    if (!dealershipId) return;
    try {
      const res = await fetch(`/api/fortnox/status?dealershipId=${dealershipId}`);
      if (res.ok) setStatus(await res.json());
    } catch { /* non-fatal */ }
  }, [dealershipId]);

  const loadInvoices = useCallback(async () => {
    if (!dealershipId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    const { data } = await sb
      .from('invoices')
      .select('id, issue_date, customer_name, vehicle, total_amount, payment_method, status, fortnox_invoice_number, fortnox_synced_at, fortnox_sync_error')
      .eq('dealership_id', dealershipId)
      .eq('status', 'paid')
      .order('issue_date', { ascending: false })
      .limit(500);
    if (data) setInvoices(data as InvoiceRow[]);
    setLoading(false);
  }, [dealershipId]);

  const refresh = useCallback(async () => {
    await Promise.all([loadStatus(), loadInvoices()]);
  }, [loadStatus, loadInvoices]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw);
    if (u.role !== 'admin') {
      toast.error(t('adminOnly'));
      router.replace('/dashboard');
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(refresh);

  // Handle query params from OAuth redirect
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('Fortnox är nu ansluten! ✓');
      loadStatus();
    }
    const err = searchParams.get('error');
    if (err) toast.error(`Fortnox anslutning misslyckades: ${err}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync handlers ────────────────────────────────────────────────────────────

  async function syncInvoice(invoiceId: string) {
    if (!dealershipId) return;
    setSyncing(invoiceId);
    try {
      const res = await fetch('/api/fortnox/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealershipId, invoiceIds: [invoiceId] }),
      });
      const json = await res.json();
      if (!res.ok || json.failed > 0) {
        toast.error(`Fel: ${json.errors?.[0] ?? json.error ?? 'Okänt fel'}`);
      } else {
        toast.success(`${invoiceId} exporterat till Fortnox ✓`);
      }
      await refresh();
    } catch {
      toast.error('Nätverksfel vid export');
    } finally {
      setSyncing(null);
    }
  }

  async function syncAll() {
    if (!dealershipId) return;
    setSyncing('all');
    try {
      const res = await fetch('/api/fortnox/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealershipId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Okänt fel');
      } else if (json.synced === 0 && json.failed === 0) {
        toast.success('Allt är redan synkat ✓');
      } else {
        toast.success(`${json.synced} fakturor exporterade${json.failed ? `, ${json.failed} misslyckades` : ''}`);
      }
      await refresh();
    } catch {
      toast.error('Nätverksfel vid export');
    } finally {
      setSyncing(null);
    }
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const tabFiltered = invoices.filter(inv => {
    if (tab === 'synced')  return inv.fortnox_invoice_number !== null;
    if (tab === 'pending') return !inv.fortnox_invoice_number && !inv.fortnox_sync_error;
    if (tab === 'failed')  return !inv.fortnox_invoice_number && !!inv.fortnox_sync_error;
    return true;
  });

  const filtered = filter
    ? tabFiltered.filter(inv =>
        inv.id.toLowerCase().includes(filter.toLowerCase()) ||
        inv.customer_name.toLowerCase().includes(filter.toLowerCase()) ||
        inv.vehicle.toLowerCase().includes(filter.toLowerCase()) ||
        (inv.fortnox_invoice_number ?? '').includes(filter)
      )
    : tabFiltered;

  const stats = status?.stats ?? { total: 0, synced: 0, pending: 0, failed: 0 };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">📒 {t('title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
            </div>
            <button
              onClick={syncAll}
              disabled={syncing !== null || !status?.connected}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55a1e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing === 'all' ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>↑</span>
              )}
              {t('exportBtn')}
            </button>
          </div>

          {/* Fortnox Connection Card */}
          <div className={`mt-5 rounded-2xl border p-4 flex items-center justify-between gap-4 flex-wrap
            ${status?.connected
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg
                ${status?.connected ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {status?.connected ? '✓' : '⚡'}
              </div>
              <div>
                <p className={`text-sm font-bold ${status?.connected ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {status === null
                    ? t('checking')
                    : status.connected
                      ? `${t('connected')}${status.companyName ? ` · ${status.companyName}` : ''}`
                      : status.tokenConfigured
                        ? t('tokenInvalid')
                        : t('notConnected')}
                </p>
                <p className={`text-xs mt-0.5 ${status?.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {status?.connected
                    ? `${stats.synced} av ${stats.total} fakturor synkade`
                    : 'Klicka "Anslut" för att auktorisera med OAuth'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!dealershipId) return;
                window.location.href = `/api/fortnox/oauth/authorize?dealershipId=${dealershipId}`;
              }}
              className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors
                ${status?.connected
                  ? 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                  : 'bg-[#FF6B2C] border-transparent text-white hover:bg-[#e55a1e]'}`}
            >
              {status?.connected ? t('reconnect') : t('connect')}
            </button>
          </div>

          {/* Stats bar */}
          <div className="mt-4 flex gap-3 flex-wrap">
            {[
              { key: 'all',     label: 'Total',           value: stats.total,   color: 'bg-slate-100 text-slate-700' },
              { key: 'synced',  label: t('synced'),   value: stats.synced,  color: 'bg-emerald-100 text-emerald-700' },
              { key: 'pending', label: t('pending'),  value: stats.pending, color: 'bg-amber-100 text-amber-700' },
              { key: 'failed',  label: t('failed'),   value: stats.failed,  color: 'bg-red-100 text-red-700' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setTab(s.key as typeof tab)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                  ${s.color} ${tab === s.key ? 'ring-2 ring-offset-1 ring-slate-400' : 'opacity-80 hover:opacity-100'}`}
              >
                <span className="font-black text-sm">{s.value}</span>
                <span>{s.label}</span>
              </button>
            ))}

            {/* Search */}
            <div className="relative ml-auto">
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={t('search')}
                className="w-64 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C]"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {filter && (
              <button onClick={() => setFilter('')} className="text-xs text-slate-400 hover:text-slate-700">{t('showAll')}</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="px-5 md:px-8 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">{t('noInvoices')}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-slate-400">
              <div className="text-5xl mb-4">📒</div>
              <p className="text-sm font-semibold">{t('noInvoices')}</p>
              {tab !== 'all' && (
                <button onClick={() => setTab('all')} className="mt-2 text-xs text-[#FF6B2C] hover:underline">
                  {t('showAll')}
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-215">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      {[t('cols.id'), t('cols.date'), t('cols.customer'), t('cols.vehicle'), t('cols.amount'), t('cols.payment'), t('cols.fortnox'), t('cols.action')].map(h => (
                        <th key={h} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv, i) => {
                      const isSynced  = !!inv.fortnox_invoice_number;
                      const hasFailed = !isSynced && !!inv.fortnox_sync_error;
                      const isSyncing = syncing === inv.id;

                      return (
                        <tr key={inv.id + i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                          {/* Faktura-ID */}
                          <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#0b1524] whitespace-nowrap">
                            {inv.id}
                          </td>

                          {/* Datum */}
                          <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                            {fmtDate(inv.issue_date)}
                          </td>

                          {/* Kund */}
                          <td className="px-5 py-3.5 text-sm font-medium text-slate-700 max-w-40 truncate">
                            {inv.customer_name}
                          </td>

                          {/* Fordon */}
                          <td className="px-5 py-3.5 text-xs text-slate-500 max-w-45 truncate">
                            {inv.vehicle}
                          </td>

                          {/* Belopp */}
                          <td className="px-5 py-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap">
                            {fmtAmount(Number(inv.total_amount))}
                          </td>

                          {/* Betalning */}
                          <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                            {inv.payment_method || '—'}
                          </td>

                          {/* Fortnox status */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {isSynced ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                                <span className="text-emerald-500">✓</span>
                                {inv.fortnox_invoice_number}
                              </span>
                            ) : hasFailed ? (
                              <span
                                title={inv.fortnox_sync_error ?? ''}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg cursor-help"
                              >
                                <span>✗</span> {t('failed')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                ⏳ {t('pending')}
                              </span>
                            )}
                          </td>

                          {/* Åtgärd */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {!isSynced && (
                              <button
                                onClick={() => syncInvoice(inv.id)}
                                disabled={isSyncing || syncing === 'all' || !status?.connected}
                                className="text-xs font-semibold px-3 py-1 rounded-lg bg-[#0b1524] text-white hover:bg-[#1a2d45] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                              >
                                {isSyncing
                                  ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                  : null}
                                Exportera →
                              </button>
                            )}
                            {isSynced && (
                              <span className="text-xs text-slate-300">
                                {inv.fortnox_synced_at ? fmtDate(inv.fortnox_synced_at) : ''}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Visar {filtered.length} av {invoices.length} betalda fakturor
                </p>
                <button onClick={refresh} className="text-xs text-[#FF6B2C] hover:underline font-semibold">
                  {t('update')}
                </button>
              </div>
            </div>
          )}

          {/* Info box — how it works */}
          {!loading && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-2">{t('howItWorks')}</h3>
              <ul className="text-xs text-slate-500 space-y-1.5 list-none">
                <li>
                  <span className="inline-block w-5 text-center">1.</span>
                  Anslut Fortnox via OAuth — du loggar in med ditt Fortnox-konto och auktoriserar appen en gång.
                </li>
                <li>
                  <span className="inline-block w-5 text-center">2.</span>
                  När en försäljning markeras som betald synkas fakturan automatiskt till Fortnox inom sekunder.
                </li>
                <li>
                  <span className="inline-block w-5 text-center">3.</span>
                  Kunder skapas automatiskt i Fortnox med personnummer, adress och kontaktuppgifter.
                </li>
                <li>
                  <span className="inline-block w-5 text-center">4.</span>
                  Använd <strong>Exportera alla osynkade</strong> för att synka historiska fakturor.
                </li>
                <li>
                  <span className="inline-block w-5 text-center">5.</span>
                  Fortnox-fakturanumret visas i tabellen och länkas till köpeavtalet som referens.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
