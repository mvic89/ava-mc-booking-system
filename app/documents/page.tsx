'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';
import { getInvoices, type Invoice } from '@/lib/invoices';
import { getAgreements, type Agreement } from '@/lib/agreements';
import { useAutoRefresh } from '@/lib/realtime';

// ── Document model ────────────────────────────────────────────────────────────

type DocType   = 'köpeavtal' | 'faktura' | 'offert';
type DocStatus = 'signerat' | 'betald' | 'skickad' | 'utkast' | 'förfallen' | 'väntande';
type FilterTab = 'alla' | 'köpeavtal' | 'faktura' | 'offert' | 'osignerade';

interface Doc {
  uid:          string;          // unique key
  type:         DocType;
  number:       string;          // INV-2026-001 / AGR-2026-001 / OFR-2026-001
  customer:     string;
  vehicle:      string;
  amount:       number;
  date:         string;          // ISO
  status:       DocStatus;
  bankidSigned: boolean;         // buyer signature present
  paymentType?: string;
  sourceId:     string | number; // offer.id or invoice.id
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<DocType, { label: string; color: string; bg: string; icon: string }> = {
  köpeavtal: { label: 'Köpeavtal',  color: 'text-[#235971]',   bg: 'bg-[#235971]/10',   icon: '📋' },
  faktura:   { label: 'Faktura',    color: 'text-emerald-700', bg: 'bg-emerald-50',     icon: '🧾' },
  offert:    { label: 'Offert',     color: 'text-[#FF6B2C]',   bg: 'bg-[#FF6B2C]/10',  icon: '📄' },
};

const STATUS_META: Record<DocStatus, { label: string; cls: string }> = {
  signerat:  { label: 'Signerat',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  betald:    { label: 'Betald',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  skickad:   { label: 'Skickad',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  utkast:    { label: 'Utkast',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  förfallen: { label: 'Förfallen', cls: 'bg-red-50 text-red-600 border-red-200' },
  väntande:  { label: 'Väntande',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const TYPE_BORDER: Record<DocType, string> = {
  köpeavtal: 'border-l-[#235971]',
  faktura:   'border-l-emerald-500',
  offert:    'border-l-[#FF6B2C]',
};

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtAmt(n: number): string {
  return n > 0 ? `${n.toLocaleString('sv-SE')} kr` : '—';
}

function offerStatus(o: { status: string; validUntil: string; buyerSignature: string }): DocStatus {
  if (o.buyerSignature) return 'signerat';
  if (o.status === 'accepted') return 'signerat';
  if (o.status === 'sent') return 'skickad';
  if (o.status === 'declined') return 'förfallen';
  if (o.validUntil && new Date(o.validUntil) < new Date()) return 'förfallen';
  return 'utkast';
}

// ── PDF download helper (generates a simple text-based PDF using browser print) ─
function downloadDoc(doc: Doc, toastMsg: string) {
  const lines = [
    `BikeMeNow Dealership System`,
    ``,
    `${TYPE_META[doc.type].label.toUpperCase()} — ${doc.number}`,
    `${'─'.repeat(50)}`,
    `Kund:       ${doc.customer}`,
    `Fordon:     ${doc.vehicle}`,
    `Datum:      ${fmtDate(doc.date)}`,
    `Belopp:     ${fmtAmt(doc.amount)}`,
    `Status:     ${STATUS_META[doc.status].label}`,
    `BankID:     ${doc.bankidSigned ? 'Verifierad ✓' : 'Ej signerat'}`,
    ``,
    `─`.repeat(50),
    `Genererat: ${new Date().toLocaleString('sv-SE')}`,
    `Referens: ${doc.number}`,
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${doc.number}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(toastMsg);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();
  const t = useTranslations('documents');

  const TYPE_LABELS: Record<DocType, string> = useMemo(() => ({
    köpeavtal: t('typeKopeavtal'),
    faktura:   t('typeFaktura'),
    offert:    t('typeOffert'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const STATUS_LABELS: Record<DocStatus, string> = useMemo(() => ({
    signerat:  t('statusSignerat'),
    betald:    t('statusBetald'),
    skickad:   t('statusSkickad'),
    utkast:    t('statusUtkast'),
    förfallen: t('statusForfallen'),
    väntande:  t('statusVantande'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const [ready,     setReady]     = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [filter,    setFilter]    = useState<FilterTab>('alla');
  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState<'date' | 'amount' | 'customer'>('date');
  const [sortDir,   setSortDir]   = useState<'desc' | 'asc'>('desc');
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;

    // Fetch signed agreements from agreements table (live, authoritative)
    const agreements: Agreement[] = await getAgreements();

    // Track which offer IDs already have an agreement so we don't double-count
    const agrOfferIds = new Set(agreements.map(a => a.offerId).filter(Boolean));

    // Fetch offers — only show unsigned/unsent ones (offerter) that haven't been converted yet
    const { data: offerRows } = await sb
      .from('offers')
      .select('id, offer_number, customer_name, vehicle, total_price, status, payment_type, valid_until, buyer_signature, seller_signature, created_at, agreement_ref')
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: false });

    // Fetch invoices
    const invoices: Invoice[] = await getInvoices();

    const result: Doc[] = [];

    // Agreements table → Köpeavtal (fully signed, authoritative source)
    for (const a of agreements) {
      result.push({
        uid:          `agr-${a.id}`,
        type:         'köpeavtal',
        number:       a.agreementNumber,
        customer:     a.customerName || '—',
        vehicle:      a.vehicle || '—',
        amount:       a.totalPrice,
        date:         a.signedAt || a.createdAt,
        status:       'signerat',
        bankidSigned: Boolean(a.buyerSignature),
        paymentType:  a.paymentType,
        sourceId:     a.id,
      });
    }

    // Offers not yet converted to agreements → Offert
    for (const o of (offerRows ?? [])) {
      // Skip offers that already have an agreement record
      if (agrOfferIds.has(o.id as number)) continue;

      const hasBuyer   = Boolean(o.buyer_signature);
      const hasSeller  = Boolean(o.seller_signature);
      const isSigned   = hasBuyer && hasSeller;
      const isAccepted = o.status === 'accepted';

      // If fully signed/accepted but no agreement row yet, show as köpeavtal (fallback)
      if (isSigned || isAccepted) {
        result.push({
          uid:          `offer-${o.id}`,
          type:         'köpeavtal',
          number:       (o.agreement_ref as string) || (o.offer_number as string) || `AGR-${o.id}`,
          customer:     (o.customer_name as string) || '—',
          vehicle:      (o.vehicle as string) || '—',
          amount:       parseFloat(String(o.total_price ?? '0')) || 0,
          date:         (o.created_at as string) || new Date().toISOString(),
          status:       'signerat',
          bankidSigned: hasBuyer,
          paymentType:  (o.payment_type as string) ?? 'cash',
          sourceId:     o.id as number,
        });
      } else {
        result.push({
          uid:          `offer-${o.id}`,
          type:         'offert',
          number:       (o.offer_number as string) || `OFR-${o.id}`,
          customer:     (o.customer_name as string) || '—',
          vehicle:      (o.vehicle as string) || '—',
          amount:       parseFloat(String(o.total_price ?? '0')) || 0,
          date:         (o.created_at as string) || new Date().toISOString(),
          status:       offerStatus({ status: o.status, validUntil: o.valid_until ?? '', buyerSignature: o.buyer_signature ?? '' }),
          bankidSigned: hasBuyer,
          paymentType:  (o.payment_type as string) ?? 'cash',
          sourceId:     o.id as number,
        });
      }
    }

    // Invoices → Faktura
    for (const inv of invoices) {
      result.push({
        uid:          `inv-${inv.id}`,
        type:         'faktura',
        number:       inv.id,
        customer:     inv.customerName || '—',
        vehicle:      inv.vehicle || '—',
        amount:       inv.totalAmount,
        date:         inv.issueDate,
        status:       inv.status === 'paid' ? 'betald' : 'väntande',
        bankidSigned: false,
        paymentType:  inv.paymentMethod,
        sourceId:     inv.id,
      });
    }

    // Sort by date desc by default
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setDocs(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    setReady(true);
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(loadData);

  // ── Filtering + sorting ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = docs;

    if (filter === 'köpeavtal') list = list.filter(d => d.type === 'köpeavtal');
    else if (filter === 'faktura')   list = list.filter(d => d.type === 'faktura');
    else if (filter === 'offert')    list = list.filter(d => d.type === 'offert');
    else if (filter === 'osignerade') list = list.filter(d => d.type !== 'faktura' && !d.bankidSigned);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.customer.toLowerCase().includes(q) ||
        d.vehicle.toLowerCase().includes(q)  ||
        d.number.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date')     cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount')   cmp = a.amount - b.amount;
      if (sortBy === 'customer') cmp = a.customer.localeCompare(b.customer, 'sv');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [docs, filter, search, sortBy, sortDir]);

  // ── Stats ─────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      total:      docs.length,
      signed:     docs.filter(d => d.bankidSigned).length,
      agreements: docs.filter(d => d.type === 'köpeavtal').length,
      invoices:   docs.filter(d => d.type === 'faktura').length,
      offers:     docs.filter(d => d.type === 'offert').length,
      pending:    docs.filter(d => d.status === 'väntande' || d.status === 'skickad').length,
      thisMonth:  docs.filter(d => d.date.startsWith(thisMonth)).length,
      totalValue: docs.filter(d => d.type === 'faktura' && d.status === 'betald').reduce((s, d) => s + d.amount, 0),
    };
  }, [docs]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const FILTER_TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: 'alla',       label: t('tabAll'),        count: docs.length },
    { id: 'köpeavtal',  label: t('tabAgreements'), count: stats.agreements },
    { id: 'faktura',    label: t('tabInvoices'),   count: stats.invoices },
    { id: 'offert',     label: t('tabOffers'),     count: stats.offers },
    { id: 'osignerade', label: t('tabUnsigned'),   count: docs.filter(d => d.type !== 'faktura' && !d.bankidSigned).length },
  ];

  if (!ready) return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-100 px-6 md:px-10 pt-6 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{t('breadcrumb')}</p>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-sm font-bold rounded-full">{docs.length}</span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{t('subtitle')}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Language switcher */}
              <LanguageSwitcher variant="default" />

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 outline-none w-56 transition-all"
                />
              </div>

              <button
                onClick={() => { setFilter('alla'); setSearch(''); setSortBy('date'); setSortDir('desc'); }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
                </svg>
                {t('reset')}
              </button>

              <button
                onClick={loadData}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all"
                title={t('refresh')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('refresh')}
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-5">
            <div className="bg-[#f5f7fa] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('kpiTotal')}</span>
                <span className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-base">📁</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('kpiThisMonth', { n: stats.thisMonth })}</p>
            </div>

            <div className="bg-[#f5f7fa] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('kpiBankID')}</span>
                <span className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-base">🔐</span>
              </div>
              <p className="text-2xl font-bold text-[#235971]">{stats.signed}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#235971] rounded-full" style={{ width: stats.total > 0 ? `${Math.round((stats.signed / stats.total) * 100)}%` : '0%' }} />
                </div>
                <span className="text-xs text-slate-400 shrink-0">{stats.total > 0 ? Math.round((stats.signed / stats.total) * 100) : 0}%</span>
              </div>
            </div>

            <div className="bg-[#f5f7fa] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('kpiPending')}</span>
                <span className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-base">⏳</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('kpiRequiresAction')}</p>
            </div>

            <div className="bg-[#f5f7fa] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('kpiRevenue')}</span>
                <span className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-base">💰</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                {stats.totalValue > 0 ? `${(stats.totalValue / 1000).toFixed(0)}k` : '0'} kr
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{t('kpiPaidInvoices')}</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  filter === tab.id
                    ? 'border-[#FF6B2C] text-[#FF6B2C]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  filter === tab.id ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Document list ───────────────────────────────────────────────────── */}
        <div className="flex-1 px-6 md:px-10 py-6">

          {/* Sort bar */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 mb-4 text-xs text-slate-400">
              <span className="font-medium text-slate-500">{t('docCount', { n: filtered.length })}</span>
              <span className="mx-1">·</span>
              <span>{t('sortLabel')}</span>
              {([['date', t('sortDate')], ['amount', t('sortAmount')], ['customer', t('sortCustomer')]] as [typeof sortBy, string][]).map(([col, lbl]) => (
                <button
                  key={col}
                  onClick={() => toggleSort(col)}
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg transition-colors font-medium ${
                    sortBy === col ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  {lbl}
                  {sortBy === col && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            /* Skeleton */
            <div className="space-y-3">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded w-48" />
                    <div className="h-3 bg-slate-100 rounded w-64" />
                  </div>
                  <div className="h-5 bg-slate-100 rounded-full w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="bg-white rounded-2xl border border-slate-100 py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-3xl">📁</div>
              <p className="text-slate-700 font-semibold text-base">
                {search ? t('emptySearch') : t('emptyNone')}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {search ? t('emptySearchHint') : t('emptyNoneHint')}
              </p>
              {search && (
                <button onClick={() => setSearch('')} className="mt-4 text-xs text-[#FF6B2C] hover:underline">
                  {t('clearSearch')}
                </button>
              )}
            </div>
          ) : (
            /* Document cards */
            <div className="space-y-3">
              {filtered.map(doc => (
                <div
                  key={doc.uid}
                  className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${TYPE_BORDER[doc.type]} shadow-sm hover:shadow-md transition-all group`}
                >
                  <div className="flex items-center gap-4 px-5 py-4">

                    {/* Type icon */}
                    <div className={`w-10 h-10 rounded-xl ${TYPE_META[doc.type].bg} flex items-center justify-center text-lg shrink-0`}>
                      {TYPE_META[doc.type].icon}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-bold text-slate-900">{doc.customer}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_META[doc.type].bg} ${TYPE_META[doc.type].color}`}>
                          {TYPE_LABELS[doc.type]}
                        </span>
                        {doc.bankidSigned && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#235971]/10 text-[#235971] border border-[#235971]/20 flex items-center gap-1">
                            🔐 BankID
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="font-mono text-slate-400">{doc.number}</span>
                        <span>🏍️ {doc.vehicle}</span>
                        <span>📅 {fmtDate(doc.date)}</span>
                        {doc.paymentType && doc.type !== 'faktura' && (
                          <span className="capitalize">
                            {doc.paymentType === 'financing' ? `📊 ${t('paymentFinancing')}` : `💵 ${t('paymentCash')}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-base font-bold text-slate-900">{fmtAmt(doc.amount)}</p>
                      <p className="text-[11px] text-slate-400">{t('inclVat')}</p>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_META[doc.status].cls}`}>
                        {doc.status === 'signerat' || doc.status === 'betald' ? '✓ ' : ''}{STATUS_LABELS[doc.status]}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        title={t('preview')}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => downloadDoc(doc, t('downloaded', { number: doc.number }))}
                        title={t('download')}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      {doc.type !== 'faktura' && (
                        <button
                          onClick={() => {
                            const path = doc.type === 'köpeavtal'
                              ? `/sales/leads/${doc.sourceId}/agreement`
                              : `/sales/leads/${doc.sourceId}/offer`;
                            router.push(path);
                          }}
                          title={t('openInSystem')}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legal footer */}
          <div className="mt-8 p-5 bg-white rounded-2xl border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-base shrink-0">⚖️</div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">{t('legalTitle')}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{t('legalBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Document preview modal ─────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${TYPE_META[previewDoc.type].bg} flex items-center justify-center text-lg`}>
                  {TYPE_META[previewDoc.type].icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{previewDoc.number}</p>
                  <p className={`text-xs font-semibold ${TYPE_META[previewDoc.type].color}`}>{TYPE_LABELS[previewDoc.type]}</p>
                </div>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors text-xl leading-none">×</button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Status + BankID row */}
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_META[previewDoc.status].cls}`}>
                  {previewDoc.status === 'signerat' || previewDoc.status === 'betald' ? '✓ ' : ''}{STATUS_LABELS[previewDoc.status]}
                </span>
                {previewDoc.bankidSigned && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#235971]/10 text-[#235971] border border-[#235971]/20">
                    🔐 {t('previewBankID')}
                  </span>
                )}
              </div>

              {/* Details grid */}
              <div className="space-y-0 divide-y divide-slate-50">
                {[
                  { label: t('previewCustomer'),    value: previewDoc.customer },
                  { label: t('previewVehicle'),     value: previewDoc.vehicle },
                  { label: t('previewDate'),        value: fmtDate(previewDoc.date) },
                  { label: t('previewAmount'),      value: fmtAmt(previewDoc.amount) },
                  { label: t('previewPaymentType'), value: previewDoc.paymentType === 'financing' ? t('paymentFinancing') : previewDoc.paymentType === 'cash' ? t('paymentCash') : previewDoc.paymentType || '—' },
                  { label: t('previewDocId'),       value: previewDoc.number },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-500">{row.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* BankID legal note */}
              {previewDoc.bankidSigned && (
                <div className="bg-[#235971]/5 border border-[#235971]/20 rounded-xl p-3">
                  <p className="text-xs text-[#235971] leading-relaxed">
                    <strong>{t('previewLegalTitle')}</strong> {t('previewLegalNote')}
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">{t('previewArchive')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { downloadDoc(previewDoc, t('downloaded', { number: previewDoc.number })); setPreviewDoc(null); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b1524] hover:bg-[#1a2a42] text-white text-sm font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('download')}
                </button>
                {previewDoc.type !== 'faktura' && (
                  <button
                    onClick={() => {
                      setPreviewDoc(null);
                      router.push(previewDoc.type === 'köpeavtal'
                        ? `/sales/leads/${previewDoc.sourceId}/agreement`
                        : `/sales/leads/${previewDoc.sourceId}/offer`
                      );
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors"
                  >
                    {t('previewOpen')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
