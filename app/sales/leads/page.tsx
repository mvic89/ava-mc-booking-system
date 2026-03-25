'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getLeads, type Lead } from '@/lib/leads';
import { useAutoRefresh } from '@/lib/realtime';

type Status = Lead['status'];
type Stage  = Lead['stage'];

const STATUS_STYLE: Record<Status, { dot: string; text: string; bg: string }> = {
  hot:  { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
  warm: { dot: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
  cold: { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
};

function LeadCard({ lead, statusLabel, stageColor }: { lead: Lead; statusLabel: string; stageColor: string }) {
  const s = STATUS_STYLE[lead.status];
  return (
    <Link
      href={`/sales/leads/${lead.id}/agreement`}
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
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{lead.bike}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot} ${lead.status === 'hot' ? 'animate-pulse-dot' : ''}`} />
            {statusLabel}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
          <span className="text-sm font-bold text-[#0b1524]">{lead.value}</span>
          <span className="text-[11px] text-slate-400">{lead.time}</span>
        </div>
      </div>
    </Link>
  );
}

export default function PipelinePage() {
  const router = useRouter();
  const t = useTranslations('leads');
  const [ready, setReady] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');

  const COLUMNS: { id: Stage; label: string; color: string; bg: string; icon: string }[] = [
    { id: 'new',         label: t('columns.new'),         color: '#FF6B2C', bg: '#fff5f0', icon: '✨' },
    { id: 'contacted',   label: t('columns.contacted'),   color: '#f59e0b', bg: '#fffbeb', icon: '📞' },
    { id: 'testride',    label: t('columns.testRide'),    color: '#8b5cf6', bg: '#f5f3ff', icon: '🏍' },
    { id: 'negotiating', label: t('columns.negotiating'), color: '#3b82f6', bg: '#eff6ff', icon: '💼' },
    { id: 'closed',      label: t('columns.closed'),      color: '#10b981', bg: '#f0fdf4', icon: '🏆' },
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

  const totalValue  = leads.reduce((sum, l) => sum + l.rawValue, 0);
  const closedValue = leads.filter(l => l.stage === 'closed').reduce((sum, l) => sum + l.rawValue, 0);

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
              {closedValue > 0 && (
                <div className="text-right border-l border-slate-100 pl-4">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide leading-none mb-0.5">Avslutat</p>
                  <p className="text-sm font-bold text-emerald-700">{fmt(closedValue)} kr</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kanban board — horizontal scroll */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 p-5 md:p-6 min-w-max">
            {COLUMNS.map(col => {
              const colLeads = filtered.filter(l => l.stage === col.id);
              const colValue = colLeads.reduce((sum, l) => sum + l.rawValue, 0);
              return (
                <div key={col.id} className="w-72 flex flex-col gap-2.5 animate-fade-up">

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
                    ) : (
                      colLeads.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          statusLabel={STATUS_LABELS[lead.status]}
                          stageColor={col.color}
                        />
                      ))
                    )}
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
