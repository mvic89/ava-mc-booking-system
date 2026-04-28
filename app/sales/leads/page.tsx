'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getLeads, computeLeadScore, type Lead } from '@/lib/leads';
import { useAutoRefresh, emit } from '@/lib/realtime';

type Status   = Lead['status'];
type Stage    = Lead['stage'];
type ViewMode = 'board' | 'list';
type SortCol  = 'name' | 'bike' | 'value' | 'score' | 'days' | 'stage' | 'created';

const STATUS_STYLE: Record<Status, { dot: string; text: string; bg: string }> = {
  hot:  { dot: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50'   },
  warm: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  cold: { dot: 'bg-blue-400',  text: 'text-blue-700',  bg: 'bg-blue-50'  },
};

const STAGE_WEIGHT: Record<Stage, number> = {
  new: 0.10, contacted: 0.25, testride: 0.40, offer: 0.55,
  negotiating: 0.70, pending_payment: 0.90, closed: 1.00,
};

const OVERDUE_DAYS: Record<Stage, number> = {
  new: 2, contacted: 3, testride: 5, offer: 7,
  negotiating: 7, pending_payment: 14, closed: 999,
};

const STAGE_ORDER: Stage[] = ['new', 'contacted', 'testride', 'offer', 'negotiating', 'pending_payment', 'closed'];

function leadHref(lead: Lead): string {
  if (lead.stage === 'closed')          return `/sales/leads/${lead.id}`;
  if (lead.stage === 'pending_payment') return `/sales/leads/${lead.id}/payment`;
  if (lead.stage === 'negotiating')     return `/sales/leads/${lead.id}/agreement`;
  if (lead.stage === 'offer')           return `/sales/leads/${lead.id}/offer`;
  if (lead.stage === 'testride')        return `/sales/leads/${lead.id}/testdrive`;
  return `/sales/leads/${lead.id}`;
}

const STATUS_CYCLE: Record<Status, Status> = { hot: 'warm', warm: 'cold', cold: 'hot' };

function StatusBadge({ lead, statusLabel, onStatusChange }: {
  lead: Lead; statusLabel: string; onStatusChange: (lead: Lead, s: Status) => void;
}) {
  const s = STATUS_STYLE[lead.status];
  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onStatusChange(lead, STATUS_CYCLE[lead.status]); }}
      title="Click to change status"
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot} ${lead.status === 'hot' ? 'animate-pulse-dot' : ''}`} />
      {statusLabel}
    </button>
  );
}

function OverdueBadge({ days, stage }: { days: number; stage: Stage }) {
  const threshold = OVERDUE_DAYS[stage];
  if (stage === 'closed' || days < threshold) return null;
  const urgent = days >= threshold * 2;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
      ⏰ {days}d
    </span>
  );
}

function ScoreBadge({ lead }: { lead: Lead }) {
  const score = lead.leadScore || computeLeadScore({
    verified: lead.verified, notes: ((lead as unknown) as Record<string, unknown>).notes as string ?? '',
    stage: lead.stage, costPrice: lead.costPrice, rawValue: lead.rawValue,
    source: lead.source, email: lead.email, phone: lead.phone,
  });
  const color = score >= 70 ? 'text-emerald-700 bg-emerald-50' : score >= 40 ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-100';
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums ${color}`} title="Lead score">
      {score}
    </span>
  );
}

function MarginBadge({ lead }: { lead: Lead }) {
  if (!lead.costPrice || lead.costPrice === 0) return null;
  const color = lead.marginPct >= 15 ? 'text-emerald-700 bg-emerald-50' : lead.marginPct >= 5 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${color}`}>{lead.marginPct}% marginal</span>;
}

function LeadCard({ lead, statusLabel, stageColor, onStatusChange, onDragStart, onDragEnd, isDragging }: {
  lead: Lead; statusLabel: string; stageColor: string;
  onStatusChange: (lead: Lead, s: Status) => void;
  onDragStart: () => void; onDragEnd: () => void; isDragging: boolean;
}) {
  return (
    <Link
      href={leadHref(lead)}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={`kanban-card group bg-white rounded-xl border p-4 block hover:shadow-md transition-all duration-150 relative overflow-hidden cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40 border-slate-300 shadow-lg scale-[0.98]' : 'border-slate-100 hover:border-slate-200'}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: stageColor }} />
      <div className="pl-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0b1524] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
              {lead.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 truncate">{lead.name}</span>
                {lead.verified && <span className="text-[9px] bg-[#0b1524] text-white px-1.5 py-0.5 rounded font-bold tracking-wide shrink-0">BankID</span>}
                <OverdueBadge days={lead.daysInStage} stage={lead.stage} />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{lead.bike}</p>
            </div>
          </div>
          <StatusBadge lead={lead} statusLabel={statusLabel} onStatusChange={onStatusChange} />
        </div>
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-[#0b1524]">{lead.value}</span>
            <MarginBadge lead={lead} />
            <ScoreBadge lead={lead} />
          </div>
          <span className="text-[11px] text-slate-400">{lead.time}</span>
        </div>
      </div>
    </Link>
  );
}

function PendingPaymentCard({
  lead, statusLabel, onConfirm, confirming, onStatusChange, onDragStart, onDragEnd, isDragging,
}: {
  lead: Lead; statusLabel: string; onConfirm: (lead: Lead) => void; confirming: boolean;
  onStatusChange: (lead: Lead, s: Status) => void;
  onDragStart: () => void; onDragEnd: () => void; isDragging: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 transition-opacity duration-150 ${isDragging ? 'opacity-40' : ''}`}
      draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }} onDragEnd={onDragEnd}>
      <Link href={`/sales/leads/${lead.id}/payment`}
        className="kanban-card group bg-white rounded-xl border border-slate-100 p-4 block hover:shadow-md hover:border-slate-200 transition-all duration-150 relative overflow-hidden cursor-grab active:cursor-grabbing">
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-[#FF6B2C]" />
        <div className="pl-1">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0b1524] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">{lead.initials}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 truncate">{lead.name}</span>
                  {lead.verified && <span className="text-[9px] bg-[#0b1524] text-white px-1.5 py-0.5 rounded font-bold tracking-wide shrink-0">BankID</span>}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{lead.bike}</p>
              </div>
            </div>
            <StatusBadge lead={lead} statusLabel={statusLabel} onStatusChange={onStatusChange} />
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
            <span className="text-sm font-bold text-[#0b1524]">{lead.value}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C] animate-pulse" />Betalning pågår
            </span>
          </div>
        </div>
      </Link>
      <button onClick={() => onConfirm(lead)} disabled={confirming}
        className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
        {confirming ? <><span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> Bekräftar…</> : <><span>✓</span> Bekräfta betalning</>}
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router = useRouter();
  const t = useTranslations('leads');

  const [ready,        setReady]        = useState(false);
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [search,       setSearch]       = useState('');
  const [viewMode,     setViewMode]     = useState<ViewMode>('list');
  const [listStage,    setListStage]    = useState<Stage | 'all'>('all');
  const [sortCol,      setSortCol]      = useState<SortCol>('created');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showClosed,   setShowClosed]   = useState(false);
  const [closedLimit,  setClosedLimit]  = useState(5);
  const [draggingId,   setDraggingId]   = useState<number | null>(null);
  const [dragOverCol,  setDragOverCol]  = useState<Stage | null>(null);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async function handleStageChange(leadId: number, newStage: Stage) {
    const raw = localStorage.getItem('user');
    const dealershipId = raw ? (JSON.parse(raw) as { dealershipId?: string }).dealershipId : null;
    if (!dealershipId) return;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
    const res = await fetch(`/api/leads/${leadId}/stage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, stage: newStage }),
    });
    if (!res.ok) { toast.error('Kunde inte flytta affären'); getLeads().then(setLeads); }
    else emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
  }

  async function handleStatusChange(lead: Lead, newStatus: Status) {
    const raw = localStorage.getItem('user');
    const dealershipId = raw ? (JSON.parse(raw) as { dealershipId?: string }).dealershipId : null;
    if (!dealershipId) return;
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    await fetch(`/api/leads/${lead.id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: newStatus }),
    });
  }

  async function handleConfirmPayment(lead: Lead) {
    const raw = localStorage.getItem('user');
    const dealershipId = raw ? (JSON.parse(raw) as { dealershipId?: string }).dealershipId : null;
    if (!dealershipId) return;
    setConfirmingId(lead.id);
    try {
      await fetch('/api/customers/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, dealershipId }),
      });
      const invoiceRes = await fetch('/api/invoice/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId, leadId: String(lead.id), customerName: lead.name,
          vehicle: lead.bike, totalAmount: lead.rawValue,
          paymentMethod: 'Bekräftad manuellt', status: 'paid', paidDate: new Date().toISOString(),
        }),
      });
      if (!invoiceRes.ok) { toast.error('Kunde inte skapa faktura'); return; }
      await fetch(`/api/leads/${lead.id}/stage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, stage: 'closed' }),
      });
      toast.success(`Betalning bekräftad — ${lead.name} → Kund skapad`);
      emit({ type: 'lead:updated', payload: { id: String(lead.id), status: lead.status } });
      getLeads().then(setLeads);
    } catch { toast.error('Nätverksfel — försök igen'); }
    finally { setConfirmingId(null); }
  }

  // ── Config ──────────────────────────────────────────────────────────────────

  const COLUMNS: { id: Stage; label: string; color: string; bg: string; icon: string }[] = [
    { id: 'new',             label: t('columns.new'),            color: '#94a3b8', bg: '#f8fafc', icon: '✨' },
    { id: 'testride',        label: t('columns.testRide'),       color: '#94a3b8', bg: '#f8fafc', icon: '🏍' },
    { id: 'offer',           label: t('columns.offer'),          color: '#FF6B2C', bg: '#fff5f0', icon: '📋' },
    { id: 'negotiating',     label: t('columns.negotiating'),    color: '#FF6B2C', bg: '#fff5f0', icon: '💼' },
    { id: 'pending_payment', label: t('columns.pendingPayment'), color: '#FF6B2C', bg: '#fff5f0', icon: '⏳' },
    { id: 'closed',          label: t('columns.closed'),         color: '#10b981', bg: '#f0fdf4', icon: '✓' },
  ];

  const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
    COLUMNS.map(c => [c.id, c.label])
  ) as Record<Stage, string>;

  const STAGE_COLOR: Record<Stage, string> = Object.fromEntries(
    COLUMNS.map(c => [c.id, c.color])
  ) as Record<Stage, string>;

  const STATUS_LABELS: Record<Status, string> = {
    hot:  t('status.hot'),
    warm: t('status.warm'),
    cold: t('status.cold'),
  };

  // ── Bootstrap ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw);
    if (u.role === 'service') { toast.error('The Sales Pipeline is not available for Service users.'); router.replace('/dashboard'); return; }
    getLeads().then(data => { setLeads(data); setReady(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => { getLeads().then(setLeads); });

  // ── Derived values ───────────────────────────────────────────────────────────

  const filtered = useMemo(() =>
    leads.filter(l =>
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.bike.toLowerCase().includes(search.toLowerCase())
    ), [leads, search]);

  const totalValue    = leads.filter(l => l.stage !== 'closed').reduce((s, l) => s + l.rawValue, 0);
  const closedValue   = leads.filter(l => l.stage === 'closed').reduce((s, l) => s + l.rawValue, 0);
  const closedCount   = leads.filter(l => l.stage === 'closed').length;
  const forecastValue = leads.filter(l => l.stage !== 'closed').reduce((s, l) => s + l.rawValue * STAGE_WEIGHT[l.stage], 0);
  const overdueCount  = leads.filter(l => l.stage !== 'closed' && l.daysInStage >= OVERDUE_DAYS[l.stage]).length;

  const ALWAYS_SHOW = new Set<Stage>(['new', 'contacted', 'testride', 'offer', 'negotiating', 'pending_payment']);
  const visibleColumns = COLUMNS.filter(col => {
    if (col.id === 'closed') return showClosed;
    return ALWAYS_SHOW.has(col.id) || filtered.some(l => l.stage === col.id);
  });

  // ── List view derived ────────────────────────────────────────────────────────

  const listLeads = useMemo(() => {
    const base = listStage === 'all' ? filtered : filtered.filter(l => l.stage === listStage);
    return [...base].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortCol === 'name')  { va = a.name;     vb = b.name; }
      if (sortCol === 'bike')  { va = a.bike;     vb = b.bike; }
      if (sortCol === 'value') { va = a.rawValue; vb = b.rawValue; }
      if (sortCol === 'score') {
        va = a.leadScore || computeLeadScore({ verified: a.verified, notes: '', stage: a.stage, costPrice: a.costPrice, rawValue: a.rawValue, source: a.source, email: a.email, phone: a.phone });
        vb = b.leadScore || computeLeadScore({ verified: b.verified, notes: '', stage: b.stage, costPrice: b.costPrice, rawValue: b.rawValue, source: b.source, email: b.email, phone: b.phone });
      }
      if (sortCol === 'days')    { va = a.daysInStage; vb = b.daysInStage; }
      if (sortCol === 'stage')   { va = STAGE_ORDER.indexOf(a.stage); vb = STAGE_ORDER.indexOf(b.stage); }
      if (sortCol === 'created') { va = a.id; vb = b.id; }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [filtered, listStage, sortCol, sortDir]);

  const fmt = (n: number) => Math.round(n).toLocaleString('sv-SE');

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  function SortTh({ col, children }: { col: SortCol; children: React.ReactNode }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap transition-colors hover:text-[#FF6B2C] ${active ? 'text-[#FF6B2C]' : 'text-slate-500'}`}
      >
        <span className="flex items-center gap-1">
          {children}
          <span className="text-[10px] opacity-60">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
        </span>
      </th>
    );
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-0.5">{t('breadcrumb.sales')}</p>
              <h1 className="text-2xl font-bold text-slate-900">{t('breadcrumb.pipeline')}</h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
                  className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/30 outline-none w-44 transition-all" />
              </div>

              {/* Board / List toggle */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
                <button
                  onClick={() => setViewMode('board')}
                  className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${viewMode === 'board' ? 'bg-[#0b1524] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Board
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-3 py-2 border-l border-slate-200 transition-colors ${viewMode === 'list' ? 'bg-[#0b1524] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Lista
                </button>
              </div>

              {/* Show/hide closed (board only) */}
              {viewMode === 'board' && (
                <button
                  onClick={() => setShowClosed(v => !v)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors whitespace-nowrap ${showClosed ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                >
                  {showClosed ? `Hide Closed (${closedCount})` : `Show Closed (${closedCount})`}
                </button>
              )}

              <Link href="/sales/leads/new"
                className="flex items-center gap-1.5 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('newLead')}
              </Link>
            </div>
          </div>

          {/* Summary pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {COLUMNS.map(col => {
              const count = filtered.filter(l => l.stage === col.id).length;
              const active = viewMode === 'list' && listStage === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => { if (viewMode === 'list') setListStage(active ? 'all' : col.id); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#0b1524] text-white'
                      : viewMode === 'list'
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
                  {col.label}
                  <span className="font-bold" style={{ color: active ? 'white' : undefined }}>{count}</span>
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide leading-none mb-0.5">{t('pipelineValue')}</p>
                <p className="text-sm font-bold text-slate-900">{fmt(totalValue)} kr</p>
              </div>
              {forecastValue > 0 && (
                <div className="text-right border-l border-slate-100 pl-4">
                  <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide leading-none mb-0.5">Prognos</p>
                  <p className="text-sm font-bold text-blue-700">{fmt(Math.round(forecastValue))} kr</p>
                </div>
              )}
              {closedValue > 0 && (
                <div className="text-right border-l border-slate-100 pl-4">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide leading-none mb-0.5">Avslutat</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(closedValue)} kr</p>
                </div>
              )}
              {overdueCount > 0 && (
                <div className="text-right border-l border-slate-100 pl-4">
                  <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide leading-none mb-0.5">Försenade</p>
                  <p className="text-sm font-bold text-red-600">{overdueCount} affärer</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Board view ──────────────────────────────────────────────────── */}
        {viewMode === 'board' && (
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-2 p-4 w-full">
              {visibleColumns.map(col => {
                const colLeads = filtered.filter(l => l.stage === col.id);
                const colValue = colLeads.reduce((s, l) => s + l.rawValue, 0);
                return (
                  <div key={col.id} className="flex-1 min-w-40 flex flex-col gap-2.5 animate-fade-up">
                    {/* Column header */}
                    <div className="bg-white rounded-2xl border border-slate-100 px-3.5 py-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${col.color}15` }}>
                            {col.icon}
                          </div>
                          <span className="text-sm font-bold text-slate-800">{col.label}</span>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center" style={{ background: `${col.color}15`, color: col.color }}>
                            {colLeads.length}
                          </span>
                        </div>
                        {colValue > 0 && <span className="text-xs font-semibold text-slate-500">{fmt(colValue)} kr</span>}
                      </div>
                      <div className="mt-2.5 h-0.5 rounded-full" style={{ background: `linear-gradient(to right, ${col.color}, ${col.color}20)` }} />
                    </div>

                    {/* Drop zone */}
                    <div
                      className="flex flex-col gap-2 min-h-28 rounded-xl transition-colors duration-150"
                      style={dragOverCol === col.id && draggingId !== null ? { background: `${col.color}10`, outline: `2px dashed ${col.color}`, outlineOffset: '2px' } : {}}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(col.id); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                      onDrop={e => {
                        e.preventDefault(); setDragOverCol(null);
                        if (draggingId !== null) {
                          const lead = leads.find(l => l.id === draggingId);
                          if (lead && lead.stage !== col.id) handleStageChange(draggingId, col.id);
                        }
                        setDraggingId(null);
                      }}
                    >
                      {colLeads.length === 0 ? (
                        <div className="h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors duration-150"
                          style={{ borderColor: dragOverCol === col.id ? col.color : `${col.color}30` }}>
                          <span className="text-xl" style={{ opacity: dragOverCol === col.id ? 0.6 : 0.25 }}>{col.icon}</span>
                          <span className="text-xs font-medium" style={{ color: `${col.color}70` }}>
                            {dragOverCol === col.id ? 'Släpp här' : t('noLeads')}
                          </span>
                        </div>
                      ) : (() => {
                        const visibleLeads = col.id === 'closed' ? colLeads.slice(0, closedLimit) : colLeads;
                        const remaining    = col.id === 'closed' ? colLeads.length - closedLimit : 0;
                        return (
                          <>
                            {visibleLeads.map(lead =>
                              lead.stage === 'pending_payment' ? (
                                <PendingPaymentCard key={lead.id} lead={lead} statusLabel={STATUS_LABELS[lead.status]}
                                  onConfirm={handleConfirmPayment} confirming={confirmingId === lead.id}
                                  onStatusChange={handleStatusChange}
                                  onDragStart={() => setDraggingId(lead.id)}
                                  onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                                  isDragging={draggingId === lead.id} />
                              ) : (
                                <LeadCard key={lead.id} lead={lead} statusLabel={STATUS_LABELS[lead.status]}
                                  stageColor={col.color} onStatusChange={handleStatusChange}
                                  onDragStart={() => setDraggingId(lead.id)}
                                  onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                                  isDragging={draggingId === lead.id} />
                              )
                            )}
                            {remaining > 0 && (
                              <button onClick={() => setClosedLimit(l => l + 5)}
                                className="w-full py-2 rounded-xl border border-slate-200 text-xs text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 transition-colors">
                                Show {Math.min(remaining, 5)} more  •  {remaining} remaining
                              </button>
                            )}
                            {col.id === 'closed' && closedLimit > 5 && (
                              <button onClick={() => setClosedLimit(5)} className="w-full py-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                                Show less
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Add lead */}
                    <Link href="/sales/leads/new"
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-[#FF6B2C] hover:text-[#FF6B2C] transition-colors font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {t('addLead')}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── List view ───────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-auto p-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Stage filter tabs */}
              <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-slate-100 overflow-x-auto">
                <button
                  onClick={() => setListStage('all')}
                  className={`px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${listStage === 'all' ? 'border-[#FF6B2C] text-[#FF6B2C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Alla affärer <span className="ml-1 text-slate-400">{filtered.length}</span>
                </button>
                {COLUMNS.map(col => {
                  const count = filtered.filter(l => l.stage === col.id).length;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setListStage(col.id)}
                      className={`px-3 py-2 text-xs font-bold rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${listStage === col.id ? 'border-[#FF6B2C] text-[#FF6B2C]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      {col.icon} {col.label}
                      {count > 0 && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${col.color}15`, color: col.color }}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              {listLeads.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">Inga affärer {listStage !== 'all' ? `i ${STAGE_LABEL[listStage as Stage]}` : ''}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <SortTh col="name">Kund</SortTh>
                        <SortTh col="bike">Fordon</SortTh>
                        <SortTh col="stage">Fas</SortTh>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                        <SortTh col="value">Värde</SortTh>
                        <SortTh col="score">Score</SortTh>
                        <SortTh col="days">Dagar</SortTh>
                        <SortTh col="created">Skapad</SortTh>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {listLeads.map(lead => {
                        const stageColor = STAGE_COLOR[lead.stage] ?? '#94a3b8';
                        const isOverdue  = lead.stage !== 'closed' && lead.daysInStage >= OVERDUE_DAYS[lead.stage];
                        return (
                          <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                            {/* Customer */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#0b1524] flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {lead.initials}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-slate-900">{lead.name}</span>
                                    {lead.verified && <span className="text-[9px] bg-[#0b1524] text-white px-1.5 py-0.5 rounded font-bold">BankID</span>}
                                  </div>
                                  {lead.phone && <p className="text-xs text-slate-400 mt-0.5">{lead.phone}</p>}
                                </div>
                              </div>
                            </td>

                            {/* Bike */}
                            <td className="px-4 py-3 text-sm text-slate-600 max-w-[180px]">
                              <p className="truncate">{lead.bike}</p>
                            </td>

                            {/* Stage */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                                  style={{ background: `${stageColor}15`, color: stageColor }}>
                                  {COLUMNS.find(c => c.id === lead.stage)?.icon} {STAGE_LABEL[lead.stage]}
                                </span>
                                {isOverdue && <OverdueBadge days={lead.daysInStage} stage={lead.stage} />}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              <StatusBadge lead={lead} statusLabel={STATUS_LABELS[lead.status]} onStatusChange={handleStatusChange} />
                            </td>

                            {/* Value */}
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-slate-900">{lead.value}</span>
                              {lead.costPrice > 0 && (
                                <p className="text-[11px] mt-0.5">
                                  <MarginBadge lead={lead} />
                                </p>
                              )}
                            </td>

                            {/* Score */}
                            <td className="px-4 py-3">
                              <ScoreBadge lead={lead} />
                            </td>

                            {/* Days in stage */}
                            <td className="px-4 py-3">
                              <span className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                                {lead.daysInStage}d
                              </span>
                            </td>

                            {/* Created */}
                            <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                              {lead.time}
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3">
                              <Link
                                href={leadHref(lead)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF6B2C] text-white text-xs font-semibold hover:bg-orange-600 whitespace-nowrap"
                              >
                                Öppna →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Footer count */}
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
                    {listLeads.length} affärer{listStage !== 'all' ? ` i ${STAGE_LABEL[listStage as Stage]}` : ' totalt'}
                    {search && ` · filtrerat på "${search}"`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
