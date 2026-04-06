'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';
import { computeLeadScore } from '@/lib/leads';
import { emit } from '@/lib/realtime';
import type { ActivityType } from '@/app/api/leads/[id]/activity/route';

// ── Types ──────────────────────────────────────────────────────────────────────

interface LeadDetail {
  id:              number;
  name:            string;
  bike:            string;
  value:           number;
  costPrice:       number;
  status:          string;
  stage:           string;
  email:           string;
  phone:           string;
  personnummer:    string;
  createdAt:       string;
  notes:           string;
  salesPersonName: string;
  source:          string;
  leadScore:       number;
  lostReason:      string | null;
  stageChangedAt:  string | null;
  closedAt:        string | null;
}

interface Activity {
  id:        number;
  leadId:    number;
  type:      ActivityType;
  content:   string;
  meta:      Record<string, unknown> | null;
  createdBy: string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  new:             'Ny',
  contacted:       'Kontaktad',
  testride:        'Provkörning',
  negotiating:     'Förhandling',
  pending_payment: 'Betalning pågår',
  closed:          'Avslutad',
};

const STAGE_ORDER = ['new', 'contacted', 'testride', 'negotiating', 'pending_payment', 'closed'];

const STAGE_COLORS: Record<string, string> = {
  new:             '#FF6B2C',
  contacted:       '#f59e0b',
  testride:        '#8b5cf6',
  negotiating:     '#3b82f6',
  pending_payment: '#f97316',
  closed:          '#10b981',
};

const ACTIVITY_CFG: Record<ActivityType, { icon: string; color: string; label: string }> = {
  note:         { icon: '📝', color: '#64748b', label: 'Anteckning'      },
  call:         { icon: '📞', color: '#10b981', label: 'Samtal'          },
  email:        { icon: '✉️',  color: '#3b82f6', label: 'E-post'          },
  meeting:      { icon: '🤝', color: '#8b5cf6', label: 'Möte'            },
  stage_change: { icon: '→',  color: '#FF6B2C', label: 'Statusändring'   },
  score_update: { icon: '⭐', color: '#f59e0b', label: 'Poänguppdatering' },
  reminder:     { icon: '⏰', color: '#ef4444', label: 'Påminnelse'      },
  lost:         { icon: '❌', color: '#ef4444', label: 'Förlorad affär'  },
};

const LOST_REASONS = [
  'Pris — för dyrt',
  'Konkurrent — valde annat märke',
  'Konkurrent — valde annan återförsäljare',
  'Inte längre intresserad',
  'Budget — inte råd just nu',
  'Tog tid — kan återkomma',
  'Köpte begagnat istället',
  'Annan anledning',
];

const OVERDUE_DAYS: Record<string, number> = {
  new: 2, contacted: 3, testride: 5, negotiating: 7, pending_payment: 14, closed: 999,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return { text: 'text-emerald-700', bg: 'bg-emerald-50', bar: '#10b981', ring: 'ring-emerald-200' };
  if (s >= 40) return { text: 'text-amber-700',   bg: 'bg-amber-50',   bar: '#f59e0b', ring: 'ring-amber-200'   };
  return              { text: 'text-red-700',      bg: 'bg-red-50',     bar: '#ef4444', ring: 'ring-red-200'     };
}

function scoreLabel(s: number) {
  if (s >= 70) return 'Varm lead 🔥';
  if (s >= 40) return 'Medelmåttig 🌡';
  return 'Kall lead ❄️';
}

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return 'Just nu';
  if (m < 60)   return `${m}m sedan`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h sedan`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d sedan`;
  return new Date(ts).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

function daysAgo(ts: string | null) {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const cfg    = scoreColor(score);
  const radius = 28;
  const circ   = 2 * Math.PI * radius;
  const dash   = (score / 100) * circ;
  return (
    <div className={`relative flex flex-col items-center justify-center w-20 h-20 rounded-full ring-2 ${cfg.ring} ${cfg.bg}`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={cfg.bar} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className={`relative text-xl font-black tabular-nums ${cfg.text}`}>{score}</span>
      <span className={`relative text-[9px] font-bold ${cfg.text} -mt-0.5`}>/ 100</span>
    </div>
  );
}

// ── Activity item ─────────────────────────────────────────────────────────────

function ActivityItem({ act }: { act: Activity }) {
  const cfg = ACTIVITY_CFG[act.type] ?? ACTIVITY_CFG.note;
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 bg-slate-100">
          {cfg.icon}
        </div>
        <div className="w-px flex-1 bg-slate-100 mt-1 group-last:hidden" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          {act.createdBy && (
            <span className="text-xs text-slate-400">av {act.createdBy}</span>
          )}
          <span className="text-xs text-slate-300 ml-auto shrink-0">{relativeTime(act.createdAt)}</span>
        </div>
        {act.content && (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{act.content}</p>
        )}
        {act.meta && typeof act.meta.from === 'string' && typeof act.meta.to === 'string' && (
          <p className="text-xs text-slate-400 mt-0.5">
            {STAGE_LABELS[act.meta.from] ?? act.meta.from} → {STAGE_LABELS[act.meta.to] ?? act.meta.to}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id     = (params?.id as string) || '';

  const [lead,           setLead]           = useState<LeadDetail | null>(null);
  const [activities,     setActivities]     = useState<Activity[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [activityType,   setActivityType]   = useState<ActivityType>('note');
  const [activityText,   setActivityText]   = useState('');
  const [addingActivity, setAddingActivity] = useState(false);
  const [showLostModal,  setShowLostModal]  = useState(false);
  const [lostReason,     setLostReason]     = useState(LOST_REASONS[0]);
  const [lostCustom,     setLostCustom]     = useState('');
  const [closingLost,    setClosingLost]    = useState(false);
  const [movingStage,    setMovingStage]    = useState(false);
  const [user,           setUser]           = useState<{ name?: string; dealershipId?: string } | null>(null);

  const dealershipIdRef = useRef<string | null>(null);

  const loadActivities = useCallback(async (lid: string, did: string) => {
    const res = await fetch(`/api/leads/${lid}/activity?dealershipId=${encodeURIComponent(did)}`);
    if (res.ok) {
      const json = await res.json() as { activities: Activity[] };
      setActivities(json.activities);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { name?: string; dealershipId?: string };
    setUser(u);

    const leadId      = Number(id);
    const dealershipId = u.dealershipId ?? getDealershipId() ?? '';
    dealershipIdRef.current = dealershipId;

    if (Number.isNaN(leadId) || !dealershipId) { setLoading(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getSupabaseBrowser() as any)
      .from('leads')
      .select('id,name,bike,value,cost_price,lead_status,stage,email,phone,personnummer,created_at,notes,salesperson_name,source,lead_score,lost_reason,stage_changed_at,closed_at')
      .eq('id', leadId)
      .eq('dealership_id', dealershipId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data) {
          const rv = parseFloat(data.value ?? '0');
          const cp = parseFloat(data.cost_price ?? '0');
          const ld: LeadDetail = {
            id:              data.id,
            name:            data.name            ?? '',
            bike:            data.bike            ?? '',
            value:           rv,
            costPrice:       cp,
            status:          data.lead_status     ?? 'warm',
            stage:           data.stage           ?? 'new',
            email:           data.email           ?? '',
            phone:           data.phone           ?? '',
            personnummer:    data.personnummer     ?? '',
            createdAt:       data.created_at       ?? '',
            notes:           data.notes            ?? '',
            salesPersonName: data.salesperson_name ?? '',
            source:          data.source           ?? 'Walk-in',
            leadScore:       data.lead_score       ?? computeLeadScore({
              verified:  !!data.personnummer,
              notes:     data.notes ?? '',
              stage:     data.stage ?? 'new',
              costPrice: cp,
              rawValue:  rv,
              source:    data.source ?? '',
              email:     data.email ?? '',
              phone:     data.phone ?? '',
            }),
            lostReason:      data.lost_reason      ?? null,
            stageChangedAt:  data.stage_changed_at ?? null,
            closedAt:        data.closed_at        ?? null,
          };
          setLead(ld);
        }
        setLoading(false);
      });

    loadActivities(id, dealershipId);
  }, [id, router, loadActivities]);

  // ── Computed ────────────────────────────────────────────────────────────────

  const score        = lead ? (lead.leadScore || computeLeadScore({
    verified: !!lead.personnummer, notes: lead.notes, stage: lead.stage,
    costPrice: lead.costPrice, rawValue: lead.value, source: lead.source,
    email: lead.email, phone: lead.phone,
  })) : 0;
  const scoreCfg     = scoreColor(score);
  const grossProfit  = lead ? lead.value - lead.costPrice : 0;
  const marginPct    = lead && lead.value > 0 ? Math.round((grossProfit / lead.value) * 100) : 0;
  const daysInStage  = lead ? daysAgo(lead.stageChangedAt) : 0;
  const overdueThresh = lead ? OVERDUE_DAYS[lead.stage] ?? 7 : 7;
  const isOverdue    = lead && lead.stage !== 'closed' && daysInStage >= overdueThresh;
  const isClosed     = lead?.stage === 'closed';
  const isLost       = isClosed && !!lead?.lostReason;
  const stageIdx     = lead ? STAGE_ORDER.indexOf(lead.stage) : 0;

  // ── Add activity ────────────────────────────────────────────────────────────

  async function handleAddActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activityText.trim() || !lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    setAddingActivity(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/activity`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId: did,
          type:         activityType,
          content:      activityText.trim(),
          createdBy:    user?.name ?? '',
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json() as { activity: Activity };
      setActivities(prev => [json.activity, ...prev]);
      setActivityText('');
      toast.success('Aktivitet tillagd');
    } catch {
      toast.error('Kunde inte spara aktivitet');
    } finally {
      setAddingActivity(false);
    }
  }

  // ── Move stage ──────────────────────────────────────────────────────────────

  async function handleStageChange(newStage: string) {
    if (!lead || newStage === lead.stage) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    const prevStage = lead.stage;

    // Prevent moving a lost lead forward unless via explicit close flow
    if (newStage === 'closed') { setShowLostModal(true); return; }

    setMovingStage(true);
    try {
      await fetch(`/api/leads/${lead.id}/status`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did, stage: newStage }),
      });

      // Log activity
      await fetch(`/api/leads/${lead.id}/activity`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId: did,
          type:         'stage_change',
          content:      `Fas ändrad: ${STAGE_LABELS[prevStage]} → ${STAGE_LABELS[newStage]}`,
          meta:         { from: prevStage, to: newStage },
          createdBy:    user?.name ?? '',
        }),
      });

      setLead(prev => prev ? { ...prev, stage: newStage as LeadDetail['stage'], stageChangedAt: new Date().toISOString() } : prev);
      await loadActivities(id, did);
      emit({ type: 'lead:updated', payload: { id, status: lead.status } });
      toast.success(`Fas ändrad till ${STAGE_LABELS[newStage]}`);
    } catch {
      toast.error('Kunde inte uppdatera fas');
    } finally {
      setMovingStage(false);
    }
  }

  // ── Close as lost ───────────────────────────────────────────────────────────

  async function handleCloseLost() {
    if (!lead) return;
    const did = dealershipIdRef.current;
    if (!did) return;
    const reason = lostReason === 'Annan anledning' ? (lostCustom.trim() || 'Annan anledning') : lostReason;
    setClosingLost(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/close`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did, outcome: 'lost', lostReason: reason, createdBy: user?.name ?? '' }),
      });
      if (!res.ok) throw new Error('Failed');
      setLead(prev => prev ? { ...prev, stage: 'closed', lostReason: reason, closedAt: new Date().toISOString() } : prev);
      await loadActivities(id, did);
      setShowLostModal(false);
      emit({ type: 'lead:updated', payload: { id, status: lead.status } });
      toast.success('Lead stängt som förlorat');
    } catch {
      toast.error('Kunde inte stänga lead');
    } finally {
      setClosingLost(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!lead) return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Lead hittades inte.</p>
          <Link href="/sales/leads" className="text-[#FF6B2C] font-semibold hover:underline">← Tillbaka</Link>
        </div>
      </div>
    </div>
  );

  const initials = lead.name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-5 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Pipeline</Link>
            <span>›</span>
            <span className="text-slate-700 font-medium truncate">{lead.name}</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#0f1729] flex items-center justify-center text-sm font-bold text-white shrink-0">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-slate-900">{lead.name}</h1>
                  {lead.personnummer && (
                    <span className="text-[9px] bg-[#0f1729] text-white px-1.5 py-0.5 rounded font-bold tracking-wide">BankID ✓</span>
                  )}
                  {isOverdue && (
                    <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">⏰ {daysInStage}d försenad</span>
                  )}
                  {isLost && (
                    <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Förlorad</span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{lead.bike}</p>
              </div>
            </div>

            {/* Score ring */}
            <ScoreRing score={score} />
          </div>

          {/* Overdue alert */}
          {isOverdue && (
            <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
              <span className="text-base">⏰</span>
              <span className="font-semibold">Påminnelse:</span>
              <span>Denna lead har legat i <strong>{STAGE_LABELS[lead.stage]}</strong> i {daysInStage} dagar — dags att följa upp!</span>
            </div>
          )}
        </div>

        <div className="flex-1 px-5 md:px-8 py-5">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* LEFT COLUMN — info + actions */}
            <div className="xl:col-span-1 space-y-4">

              {/* Lead info */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide text-slate-400">Leadinformation</h2>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Fordon',       value: lead.bike || '—'   },
                    { label: 'Källa',        value: lead.source || '—' },
                    { label: 'Säljare',      value: lead.salesPersonName || '—' },
                    { label: 'Personnummer', value: lead.personnummer || '—' },
                    { label: 'Skapad',       value: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide shrink-0 mt-0.5">{row.label}</span>
                      <span className="text-slate-800 font-medium text-right">{row.value}</span>
                    </div>
                  ))}
                  {lead.email && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">E-post</span>
                      <a href={`mailto:${lead.email}`} className="text-[#FF6B2C] hover:underline font-medium text-sm truncate max-w-40">{lead.email}</a>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Telefon</span>
                      <a href={`tel:${lead.phone}`} className="text-[#FF6B2C] hover:underline font-medium text-sm">{lead.phone}</a>
                    </div>
                  )}
                  {lead.notes && (
                    <div className="pt-2 border-t border-slate-50">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Anteckningar</p>
                      <p className="text-slate-700 text-sm leading-relaxed">{lead.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Value & margin */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400 mb-3">Affärsvärde</h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Försäljningspris</span>
                    <span className="font-bold text-slate-900">{lead.value.toLocaleString('sv-SE')} kr</span>
                  </div>
                  {lead.costPrice > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Inköpspris</span>
                        <span className="text-slate-700">{lead.costPrice.toLocaleString('sv-SE')} kr</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-50 pt-2">
                        <span className="text-slate-500">Bruttovinst</span>
                        <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {grossProfit.toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Marginal</span>
                        <span className={`font-bold ${marginPct >= 15 ? 'text-emerald-600' : marginPct >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                          {marginPct} %
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Lead score breakdown */}
              <div className={`rounded-2xl border p-5 ${scoreCfg.bg} border-slate-100`}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400">Lead Score</h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreCfg.bg} ${scoreCfg.text} border border-current/20`}>
                    {scoreLabel(score)}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-600">
                  {[
                    { label: 'BankID verifierad',     pts: 30,  met: !!lead.personnummer || lead.source === 'BankID'   },
                    { label: 'E-post & telefon',       pts: 10,  met: !!(lead.email && lead.phone) && !lead.personnummer },
                    { label: 'Trade-in intresse',      pts: 20,  met: /inbyte|trade.?in|byta in|byte/i.test(lead.notes) },
                    { label: 'Finansieringsintresse',  pts: 15,  met: /financ|finans|kredit|avbetalning|leasing/i.test(lead.notes) },
                    { label: 'Avtal öppnat',           pts: 25,  met: ['negotiating','pending_payment','closed'].includes(lead.stage) },
                    { label: 'Fasveckling',            pts: '5–20', met: lead.stage !== 'new' },
                    { label: 'Kostnadspris satt',      pts: 5,   met: lead.costPrice > 0 },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={row.met ? 'text-emerald-500' : 'text-slate-300'}>
                          {row.met ? '✓' : '○'}
                        </span>
                        <span className={row.met ? 'text-slate-700' : 'text-slate-400'}>{row.label}</span>
                      </div>
                      <span className={`font-semibold ${row.met ? scoreCfg.text : 'text-slate-300'}`}>+{row.pts}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: scoreCfg.bar }} />
                </div>
              </div>

              {/* Stage pipeline */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400 mb-3">Pipeline-fas</h2>
                <div className="space-y-1.5">
                  {STAGE_ORDER.filter(s => s !== 'closed').map((s, i) => {
                    const isCurrent  = lead.stage === s;
                    const isPast     = stageIdx > i;
                    const color      = STAGE_COLORS[s];
                    return (
                      <button
                        key={s}
                        onClick={() => !isClosed && handleStageChange(s)}
                        disabled={isClosed || movingStage || s === lead.stage}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-sm transition-colors ${
                          isCurrent
                            ? 'font-bold text-white'
                            : isPast
                            ? 'text-slate-400 bg-slate-50 cursor-default'
                            : isClosed
                            ? 'text-slate-300 cursor-default'
                            : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                        }`}
                        style={isCurrent ? { background: color } : {}}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-white' : isPast ? 'bg-slate-200' : 'bg-slate-200'}`}
                          style={!isCurrent && !isPast ? { background: `${color}40` } : {}}
                        />
                        {STAGE_LABELS[s]}
                        {isCurrent && daysInStage > 0 && (
                          <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-normal">
                            {daysInStage}d
                          </span>
                        )}
                        {isPast && <span className="ml-auto text-[10px] text-slate-300">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {!isClosed && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={lead.stage === 'negotiating' ? `/sales/leads/${id}/agreement/payment` : `/sales/leads/${id}/agreement`}
                      className="flex-1 py-2 text-xs font-semibold text-center rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white transition-colors"
                    >
                      {lead.stage === 'negotiating' ? 'Gå till betalning →' : 'Öppna avtal →'}
                    </Link>
                    <button
                      onClick={() => setShowLostModal(true)}
                      className="px-3 py-2 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Förlora
                    </button>
                  </div>
                )}

                {isClosed && isLost && lead.lostReason && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700">
                    <p className="font-semibold mb-0.5">Anledning till förlust:</p>
                    <p>{lead.lostReason}</p>
                  </div>
                )}

                {isClosed && !isLost && (
                  <Link
                    href={`/sales/leads/${id}/agreement/complete`}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    Visa avslutad affär →
                  </Link>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN — activity log */}
            <div className="xl:col-span-2 space-y-4">

              {/* Add activity */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="font-bold text-slate-900 mb-4">Logga aktivitet</h2>

                {/* Type picker */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(['note', 'call', 'email', 'meeting'] as ActivityType[]).map(t => {
                    const cfg = ACTIVITY_CFG[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setActivityType(t)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                          activityType === t
                            ? 'text-white border-transparent'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                        style={activityType === t ? { background: cfg.color, borderColor: cfg.color } : {}}
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleAddActivity} className="flex gap-2">
                  <input
                    value={activityText}
                    onChange={e => setActivityText(e.target.value)}
                    placeholder={
                      activityType === 'call'    ? 'Vad pratades det om? Nästa steg?' :
                      activityType === 'email'   ? 'Ämne och sammanfattning...' :
                      activityType === 'meeting' ? 'Vad bestämdes på mötet?' :
                      'Lägg till en anteckning...'
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={addingActivity || !activityText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
                  >
                    {addingActivity ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    ) : 'Spara'}
                  </button>
                </form>
              </div>

              {/* Timeline */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-bold text-slate-900">Aktivitetslogg</h2>
                  <span className="text-xs text-slate-400">{activities.length} händelser</span>
                </div>

                {activities.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="font-semibold text-slate-600">Inga aktiviteter än</p>
                    <p className="text-sm text-slate-400 mt-1">Logga samtal, e-post och möten ovan för att bygga upp en historik.</p>
                  </div>
                ) : (
                  <div>
                    {/* Auto-generated entry for lead creation */}
                    {[
                      ...activities,
                      {
                        id:        -1,
                        leadId:    lead.id,
                        type:      'stage_change' as ActivityType,
                        content:   `Lead skapad — ${lead.bike || 'okänt fordon'} (${lead.value.toLocaleString('sv-SE')} kr)${lead.salesPersonName ? ` av ${lead.salesPersonName}` : ''}`,
                        meta:      null,
                        createdBy: lead.salesPersonName,
                        createdAt: lead.createdAt,
                      },
                    ].map(act => (
                      <ActivityItem key={act.id} act={act} />
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── Lost deal modal ───────────────────────────────────────────────────── */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">❌</div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Stäng som förlorad affär</h3>
                <p className="text-sm text-slate-500 mt-0.5">Välj en anledning för att hjälpa oss förstå var affärer förloras.</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {LOST_REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setLostReason(r)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    lostReason === r
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {lostReason === r && <span className="mr-1.5">●</span>}{r}
                </button>
              ))}
            </div>

            {lostReason === 'Annan anledning' && (
              <input
                value={lostCustom}
                onChange={e => setLostCustom(e.target.value)}
                placeholder="Beskriv anledningen..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 mb-4"
              />
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowLostModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleCloseLost}
                disabled={closingLost}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {closingLost ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Bekräfta förlust
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
