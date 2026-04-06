'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getLeads, computeLeadScore, type Lead } from '@/lib/leads';
import { useAutoRefresh, emit } from '@/lib/realtime';

type Status = Lead['status'];
type Stage  = Lead['stage'];

const STATUS_STYLE: Record<Status, { dot: string; text: string; bg: string }> = {
  hot:  { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
  warm: { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  cold: { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
};

// Stage weights for weighted pipeline forecast
const STAGE_WEIGHT: Record<Stage, number> = {
  new:             0.10,
  contacted:       0.25,
  testride:        0.40,
  negotiating:     0.70,
  pending_payment: 0.90,
  closed:          1.00,
};

// Days before a lead in a stage is considered overdue
const OVERDUE_DAYS: Record<Stage, number> = {
  new:             2,
  contacted:       3,
  testride:        5,
  negotiating:     7,
  pending_payment: 14,
  closed:          999,
};

function leadHref(lead: Lead): string {
  if (lead.stage === 'closed')      return `/sales/leads/${lead.id}`;
  if (lead.stage === 'negotiating') return `/sales/leads/${lead.id}/agreement/payment`;
  return `/sales/leads/${lead.id}/agreement`;
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
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
      urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    }`}>
      ⏰ {days}d
    </span>
  );
}

function ScoreBadge({ lead }: { lead: Lead }) {
  const score = lead.leadScore || computeLeadScore({
    verified: lead.verified, notes: (lead as any).notes ?? '', stage: lead.stage,
    costPrice: lead.costPrice, rawValue: lead.rawValue, source: lead.source,
    email: lead.email, phone: lead.phone,
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
  const color = lead.marginPct >= 15
    ? 'text-emerald-700 bg-emerald-50'
    : lead.marginPct >= 5
    ? 'text-amber-700 bg-amber-50'
    : 'text-red-700 bg-red-50';
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {lead.marginPct}% marginal
    </span>
  );
}

function LeadCard({ lead, statusLabel, stageColor, onStatusChange }: {
  lead: Lead; statusLabel: string; stageColor: string; onStatusChange: (lead: Lead, s: Status) => void;
}) {
  return (
    <Link
      href={leadHref(lead)}
      className="kanban-card group bg-white rounded-xl border border-slate-100 p-4 block hover:shadow-md hover:border-slate-200 transition-all duration-150 relative overflow-hidden"
    >
      {/* Left stage-color accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: stageColor }} />

      <div className="pl-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0b1524] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
              {lead.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-900 truncate">{lead.name}</span>
                {lead.verified && (
                  <span className="text-[9px] bg-[#0b1524] text-white px-1.5 py-0.5 rounded font-bold tracking-wide shrink-0">
                    BankID
                  </span>
                )}
                <OverdueBadge days={lead.daysInStage} stage={lead.stage} />
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{lead.bike}</p>
            </div>
          </div>
          <StatusBadge lead={lead} statusLabel={statusLabel} onStatusChange={onStatusChange} />
        </div>

        {/* Footer */}
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
  lead,
  statusLabel,
  onConfirm,
  confirming,
  onStatusChange,
}: {
  lead: Lead;
  statusLabel: string;
  onConfirm: (lead: Lead) => void;
  confirming: boolean;
  onStatusChange: (lead: Lead, s: Status) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Link
        href={`/sales/leads/${lead.id}/agreement/payment`}
        className="kanban-card group bg-white rounded-xl border border-orange-200 p-4 block hover:shadow-md hover:border-orange-300 transition-all duration-150 relative overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-orange-400" />
        <div className="pl-1">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0b1524] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                {lead.initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 truncate">{lead.name}</span>
                  {lead.verified && (
                    <span className="text-[9px] bg-[#0b1524] text-white px-1.5 py-0.5 rounded font-bold tracking-wide shrink-0">
                      BankID
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{lead.bike}</p>
              </div>
            </div>
            <StatusBadge lead={lead} statusLabel={statusLabel} onStatusChange={onStatusChange} />
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-orange-50">
            <span className="text-sm font-bold text-[#0b1524]">{lead.value}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Betalning pågår
            </span>
          </div>
        </div>
      </Link>

      {/* Confirm button lives outside the Link so it doesn't trigger navigation */}
      <button
        onClick={() => onConfirm(lead)}
        disabled={confirming}
        className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
      >
        {confirming ? (
          <><span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> Bekräftar…</>
        ) : (
          <><span>✓</span> Bekräfta betalning</>
        )}
      </button>
    </div>
  );
}

export default function PipelinePage() {
  const router = useRouter();
  const t = useTranslations('leads');
  const [ready, setReady] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showClosed,   setShowClosed]   = useState(true);
  const [closedLimit,  setClosedLimit]  = useState(5);

  async function handleStatusChange(lead: Lead, newStatus: Status) {
    const raw = localStorage.getItem('user');
    const dealershipId = raw ? (JSON.parse(raw) as { dealershipId?: string }).dealershipId : null;
    if (!dealershipId) return;
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    await fetch(`/api/leads/${lead.id}/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: newStatus }),
    });
  }

  async function handleConfirmPayment(lead: Lead) {
    const raw = localStorage.getItem('user');
    const dealershipId = raw ? (JSON.parse(raw) as { dealershipId?: string }).dealershipId : null;
    if (!dealershipId) return;
    setConfirmingId(lead.id);
    try {
      const res = await fetch('/api/invoice/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId,
          leadId:        String(lead.id),
          customerName:  lead.name,
          vehicle:       lead.bike,
          totalAmount:   lead.rawValue,
          paymentMethod: 'Bekräftad manuellt',
          status:        'paid',
          paidDate:      new Date().toISOString(),
        }),
      });
      if (res.ok) {
        toast.success(`Betalning bekräftad — ${lead.name}`);
        emit({ type: 'lead:updated', payload: { id: String(lead.id), status: lead.status } });
        getLeads().then(setLeads);
      } else {
        toast.error('Kunde inte bekräfta betalningen');
      }
    } catch {
      toast.error('Nätverksfel — försök igen');
    } finally {
      setConfirmingId(null);
    }
  }

  const COLUMNS: { id: Stage; label: string; color: string; bg: string; icon: string }[] = [
    { id: 'new',             label: t('columns.new'),             color: '#FF6B2C', bg: '#fff5f0', icon: '✨' },
    { id: 'contacted',       label: t('columns.contacted'),       color: '#f59e0b', bg: '#fffbeb', icon: '📞' },
    { id: 'testride',        label: t('columns.testRide'),        color: '#8b5cf6', bg: '#f5f3ff', icon: '🏍' },
    { id: 'negotiating',     label: t('columns.negotiating'),     color: '#3b82f6', bg: '#eff6ff', icon: '💼' },
    { id: 'pending_payment', label: t('columns.pendingPayment'),  color: '#f97316', bg: '#fff7ed', icon: '⏳' },
    { id: 'closed',          label: t('columns.closed'),          color: '#10b981', bg: '#f0fdf4', icon: '🏆' },
  ];

  const STATUS_LABELS: Record<Status, string> = {
    hot:  t('status.hot'),
    warm: t('status.warm'),
    cold: t('status.cold'),
  };

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw);
    if (u.role === 'service') {
      toast.error('The Sales Pipeline is not available for Service users.');
      router.replace('/dashboard');
      return;
    }
    getLeads().then(data => { setLeads(data); setReady(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => { getLeads().then(setLeads); });

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const filtered = leads.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.bike.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue    = leads.reduce((sum, l) => sum + l.rawValue, 0);
  const closedValue   = leads.filter(l => l.stage === 'closed').reduce((sum, l) => sum + l.rawValue, 0);
  const closedCount   = leads.filter(l => l.stage === 'closed').length;
  const forecastValue = leads
    .filter(l => l.stage !== 'closed')
    .reduce((sum, l) => sum + l.rawValue * STAGE_WEIGHT[l.stage], 0);
  const overdueCount  = leads.filter(l =>
    l.stage !== 'closed' && l.daysInStage >= OVERDUE_DAYS[l.stage]
  ).length;

  // Always show key stages; hide contacted/testride when empty; toggle 'closed'
  const ALWAYS_SHOW = new Set<Stage>(['new', 'negotiating', 'pending_payment']);
  const visibleColumns = COLUMNS.filter(col => {
    if (col.id === 'closed') return showClosed;
    if (ALWAYS_SHOW.has(col.id)) return true;
    return filtered.some(l => l.stage === col.id);
  });

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-0.5">{t('breadcrumb.sales')}</p>
              <h1 className="text-2xl font-bold text-slate-900">{t('breadcrumb.pipeline')}</h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/30 outline-none w-44 transition-all"
                />
              </div>

              {/* Hide / show closed column toggle */}
              <button
                onClick={() => setShowClosed(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors whitespace-nowrap ${
                  showClosed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {showClosed
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-5 0-9-4-9-7s4-7 9-7 9 4 9 7a6.97 6.97 0 0 1-1.406 4.073M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-3 9-3-3m6 0-3 3" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 2.99 12c0 3 4 7 9 7s9-4 9-7a10.477 10.477 0 0 0-.99-3.777M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                  }
                </svg>
                {showClosed ? `Hide Closed (${closedCount})` : `Show Closed (${closedCount})`}
              </button>

              <Link
                href="/sales/leads/new"
                className="flex items-center gap-1.5 bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('newLead')}
              </Link>
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {COLUMNS.map(col => {
              const count = filtered.filter(l => l.stage === col.id).length;
              return (
                <div
                  key={col.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: `${col.color}15`, color: col.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col.color }} />
                  {col.label}
                  <span className="font-bold">{count}</span>
                </div>
              );
            })}

            {/* Pipeline value stats */}
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

        {/* Kanban board — fills width, columns hide when empty */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-2 p-4 w-full">
            {visibleColumns.map(col => {
              const colLeads = filtered.filter(l => l.stage === col.id);
              const colValue = colLeads.reduce((sum, l) => sum + l.rawValue, 0);
              return (
                <div key={col.id} className="flex-1 min-w-[160px] flex flex-col gap-2.5 animate-fade-up">

                  {/* Column header card */}
                  <div className="bg-white rounded-2xl border border-slate-100 px-3.5 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                          style={{ background: `${col.color}15` }}
                        >
                          {col.icon}
                        </div>
                        <span className="text-sm font-bold text-slate-800">{col.label}</span>
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                          style={{ background: `${col.color}15`, color: col.color }}
                        >
                          {colLeads.length}
                        </span>
                      </div>
                      {colValue > 0 && (
                        <span className="text-xs font-semibold text-slate-500">
                          {fmt(colValue)} kr
                        </span>
                      )}
                    </div>
                    {/* Gradient accent line */}
                    <div
                      className="mt-2.5 h-0.5 rounded-full"
                      style={{ background: `linear-gradient(to right, ${col.color}, ${col.color}20)` }}
                    />
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2">
                    {colLeads.length === 0 ? (
                      <div
                        className="h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1"
                        style={{ borderColor: `${col.color}30` }}
                      >
                        <span className="text-xl" style={{ opacity: 0.25 }}>{col.icon}</span>
                        <span className="text-xs font-medium" style={{ color: `${col.color}70` }}>{t('noLeads')}</span>
                      </div>
                    ) : (() => {
                      const visibleLeads = col.id === 'closed' ? colLeads.slice(0, closedLimit) : colLeads;
                      const remaining    = col.id === 'closed' ? colLeads.length - closedLimit : 0;
                      return (
                        <>
                          {visibleLeads.map(lead =>
                            lead.stage === 'pending_payment' ? (
                              <PendingPaymentCard
                                key={lead.id}
                                lead={lead}
                                statusLabel={STATUS_LABELS[lead.status]}
                                onConfirm={handleConfirmPayment}
                                confirming={confirmingId === lead.id}
                                onStatusChange={handleStatusChange}
                              />
                            ) : (
                              <LeadCard
                                key={lead.id}
                                lead={lead}
                                statusLabel={STATUS_LABELS[lead.status]}
                                stageColor={col.color}
                                onStatusChange={handleStatusChange}
                              />
                            )
                          )}
                          {remaining > 0 && (
                            <button
                              onClick={() => setClosedLimit(l => l + 5)}
                              className="w-full py-2 rounded-xl border border-slate-200 text-xs text-slate-500 font-semibold hover:bg-slate-50 hover:text-slate-700 transition-colors"
                            >
                              Show {Math.min(remaining, 5)} more  •  {remaining} remaining
                            </button>
                          )}
                          {col.id === 'closed' && closedLimit > 5 && (
                            <button
                              onClick={() => setClosedLimit(5)}
                              className="w-full py-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              Show less
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Add lead button */}
                  <Link
                    href="/sales/leads/new"
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-[#FF6B2C] hover:text-[#FF6B2C] transition-colors font-medium"
                  >
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
      </div>
    </div>
  );
}
