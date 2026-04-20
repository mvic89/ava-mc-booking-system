'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getInvoices, type Invoice } from '@/lib/invoices';
import { getCustomers, type Customer } from '@/lib/customers';
import { getLeads, type Lead } from '@/lib/leads';
import { getTargets, type StaffTarget } from '@/lib/targets';
import { useAutoRefresh } from '@/lib/realtime';

// ── Colour palettes ────────────────────────────────────────────────────────────

const BRAND   = '#FF6B2C';
const TEAL    = '#235971';
const PIE_COLORS = [BRAND, TEAL, '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
const TAG_COLORS: Record<string, string> = {
  VIP: '#f59e0b', Active: '#10b981', New: '#3b82f6', Inactive: '#94a3b8',
};
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32'];

// ── Date helpers ───────────────────────────────────────────────────────────────

function monthLabel(d: Date) {
  return d.toLocaleString('sv-SE', { month: 'short', year: '2-digit' });
}
function last12Months() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: monthLabel(d) };
  });
}
function last6Months() { return last12Months().slice(6); }

function kr(n: number) { return `${Math.round(n).toLocaleString('sv-SE')} kr`; }
function pct(n: number) { return `${Math.round(n)} %`; }

// ── Custom tooltips ────────────────────────────────────────────────────────────

function KrTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {Number(p.value).toLocaleString('sv-SE')} kr
        </p>
      ))}
    </div>
  );
}
function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}
function PctTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value} %
        </p>
      ))}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color = BRAND }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ── Live dot ───────────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'leaderboard' | 'grossprofit' | 'sourceroi';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'overview',    icon: '📊', label: 'Översikt'      },
  { id: 'leaderboard', icon: '🏆', label: 'Topplista'     },
  { id: 'grossprofit', icon: '💰', label: 'Marginanalys'  },
  { id: 'sourceroi',   icon: '🎯', label: 'Källanalys'    },
];

export default function AnalyticsPage() {
  const router = useRouter();

  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [targets,   setTargets]   = useState<StaffTarget[]>([]);
  const [ready,     setReady]     = useState(false);
  const [tab,       setTab]       = useState<Tab>('overview');
  const [sending,   setSending]   = useState(false);

  const loadAll = useCallback(() => {
    Promise.all([getInvoices(), getCustomers(), getLeads(), getTargets(new Date().getFullYear())]).then(([inv, cust, lds, tgt]) => {
      setInvoices(inv);
      setCustomers(cust);
      setLeads(lds as Lead[]);
      setTargets(tgt as StaffTarget[]);
    });
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw);
    const allowed = ['admin', 'sales_manager', 'accountant'];
    if (!allowed.includes(u.role)) {
      toast.error('Du har inte behörighet till Analytics.');
      router.replace('/dashboard');
      return;
    }
    Promise.all([getInvoices(), getCustomers(), getLeads(), getTargets(new Date().getFullYear())]).then(([inv, cust, lds, tgt]) => {
      setInvoices(inv);
      setCustomers(cust);
      setLeads(lds as Lead[]);
      setTargets(tgt as StaffTarget[]);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(loadAll);

  // ── Closed leads ──────────────────────────────────────────────────────────────
  const closedLeads = useMemo(() => leads.filter(l => l.stage === 'closed'), [leads]);
  const closedWithCost = useMemo(() => closedLeads.filter(l => l.costPrice > 0), [closedLeads]);

  // ── Overview KPIs ─────────────────────────────────────────────────────────────
  const paidInvoices   = useMemo(() => invoices.filter(i => i.status === 'paid'),    [invoices]);
  const totalRevenue   = useMemo(() => paidInvoices.reduce((s, i) => s + i.totalAmount, 0), [paidInvoices]);
  const avgOrderValue  = useMemo(() => paidInvoices.length ? Math.round(totalRevenue / paidInvoices.length) : 0, [totalRevenue, paidInvoices]);
  const pendingCount   = invoices.filter(i => i.status === 'pending').length;
  const convRate       = invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 0;
  const totalGross     = useMemo(() => closedWithCost.reduce((s, l) => s + l.grossProfit, 0), [closedWithCost]);
  const avgMargin      = useMemo(() => closedWithCost.length ? Math.round(closedWithCost.reduce((s, l) => s + l.marginPct, 0) / closedWithCost.length) : 0, [closedWithCost]);

  // ── Revenue by month ──────────────────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    return last12Months().map(({ year, month, label }) => {
      const paid = invoices
        .filter(i => i.status === 'paid' && i.paidDate && new Date(i.paidDate).getFullYear() === year && new Date(i.paidDate).getMonth() === month)
        .reduce((s, i) => s + i.totalAmount, 0);
      const pending = invoices
        .filter(i => i.status === 'pending' && new Date(i.issueDate).getFullYear() === year && new Date(i.issueDate).getMonth() === month)
        .reduce((s, i) => s + i.totalAmount, 0);
      return { label, paid, pending };
    });
  }, [invoices]);

  // ── Invoices by month ─────────────────────────────────────────────────────────
  const invoicesByMonth = useMemo(() => {
    return last6Months().map(({ year, month, label }) => ({
      label,
      Betalda:   invoices.filter(i => i.status === 'paid'    && i.paidDate  && new Date(i.paidDate).getFullYear() === year  && new Date(i.paidDate).getMonth() === month).length,
      Väntande:  invoices.filter(i => i.status === 'pending' && new Date(i.issueDate).getFullYear() === year && new Date(i.issueDate).getMonth() === month).length,
    }));
  }, [invoices]);

  // ── Payment mix ───────────────────────────────────────────────────────────────
  const paymentMix = useMemo(() => {
    const map: Record<string, number> = {};
    paidInvoices.forEach(i => { const k = i.paymentMethod || 'Okänd'; map[k] = (map[k] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [paidInvoices]);

  // ── Customer segments ─────────────────────────────────────────────────────────
  const customerTags = useMemo(() => {
    const map: Record<string, number> = { VIP: 0, Active: 0, New: 0, Inactive: 0 };
    customers.forEach(c => { map[c.tag] = (map[c.tag] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [customers]);

  // ────────────────────────────────────────────────────────────────────────────
  // TAB 2 — LEADERBOARD
  // ────────────────────────────────────────────────────────────────────────────

  const leaderboard = useMemo(() => {
    const map: Record<string, {
      name: string; totalLeads: number; closedLeads: number;
      revenue: number; grossProfit: number;
    }> = {};
    leads.forEach(l => {
      const name = l.salesPersonName || 'Okänd säljare';
      if (!map[name]) map[name] = { name, totalLeads: 0, closedLeads: 0, revenue: 0, grossProfit: 0 };
      map[name].totalLeads++;
      if (l.stage === 'closed') {
        map[name].closedLeads++;
        map[name].revenue     += l.rawValue;
        map[name].grossProfit += l.grossProfit;
      }
    });
    return Object.values(map)
      .map(s => ({
        ...s,
        convRate:     s.totalLeads > 0 ? Math.round((s.closedLeads / s.totalLeads) * 100) : 0,
        avgDealValue: s.closedLeads > 0 ? Math.round(s.revenue / s.closedLeads) : 0,
        marginPct:    s.revenue > 0 ? Math.round((s.grossProfit / s.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [leads]);

  // Annual targets keyed by salesperson name (periodMonth === 0)
  const targetsMap = useMemo(() => {
    const map: Record<string, { leadsTarget: number; revenueTarget: number }> = {};
    targets.filter(t => t.periodMonth === 0).forEach(t => {
      map[t.staffName] = { leadsTarget: t.leadsTarget, revenueTarget: t.revenueTarget };
    });
    return map;
  }, [targets]);

  // ────────────────────────────────────────────────────────────────────────────
  // TAB 3 — GROSS PROFIT / MARGIN ANALYSIS
  // ────────────────────────────────────────────────────────────────────────────

  // Monthly gross profit (last 12 months, from closed leads)
  const grossByMonth = useMemo(() => {
    return last12Months().map(({ year, month, label }) => {
      const profit = closedWithCost.filter(l => {
        const d = new Date(l.closedAt ?? l.stageChangedAt ?? '');
        return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
      }).reduce((s, l) => s + l.grossProfit, 0);
      const revenue = closedLeads.filter(l => {
        const d = new Date(l.closedAt ?? l.stageChangedAt ?? '');
        return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
      }).reduce((s, l) => s + l.rawValue, 0);
      return { label, Bruttovinst: Math.max(0, profit), Intäkt: revenue };
    });
  }, [closedWithCost, closedLeads]);

  // Gross profit by bike brand
  const profitByBrand = useMemo(() => {
    const map: Record<string, { revenue: number; grossProfit: number; count: number }> = {};
    closedLeads.forEach(l => {
      const brand = l.bike.split(' ')[0] || 'Okänd';
      if (!map[brand]) map[brand] = { revenue: 0, grossProfit: 0, count: 0 };
      map[brand].revenue     += l.rawValue;
      map[brand].grossProfit += l.grossProfit;
      map[brand].count++;
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        Intäkt:     v.revenue,
        Bruttovinst: v.grossProfit,
        count:      v.count,
        margin:     v.revenue > 0 ? Math.round((v.grossProfit / v.revenue) * 100) : 0,
      }))
      .filter(b => b.Intäkt > 0)
      .sort((a, b) => b.Intäkt - a.Intäkt)
      .slice(0, 10);
  }, [closedLeads]);

  // Margin % distribution buckets
  const marginBuckets = useMemo(() => {
    const buckets = [
      { label: '0–5 %',  min: 0,  max: 5,  count: 0 },
      { label: '5–10 %', min: 5,  max: 10, count: 0 },
      { label: '10–15%', min: 10, max: 15, count: 0 },
      { label: '15–20%', min: 15, max: 20, count: 0 },
      { label: '20%+',   min: 20, max: Infinity, count: 0 },
    ];
    closedWithCost.forEach(l => {
      const b = buckets.find(b => l.marginPct >= b.min && l.marginPct < b.max);
      if (b) b.count++;
    });
    return buckets.map(({ label, count }) => ({ label, Affärer: count }));
  }, [closedWithCost]);

  // Inventory turnover: avg days in pipeline by brand
  const turnoverByBrand = useMemo(() => {
    const map: Record<string, { totalDays: number; count: number }> = {};
    closedLeads.forEach(l => {
      const closeTs = l.closedAt ?? l.stageChangedAt;
      if (!closeTs) return;
      const days = Math.floor((new Date(closeTs).getTime() - new Date(l.time ? 0 : 0).getTime()) / 86_400_000);
      // Use daysInStage as proxy for time-to-close for legacy leads without closedAt
      const daysToClose = l.closedAt
        ? Math.max(0, Math.floor((new Date(l.closedAt).getTime() - Date.now() + l.daysInStage * 86_400_000) / 86_400_000))
        : l.daysInStage;
      const brand = l.bike.split(' ')[0] || 'Okänd';
      if (!map[brand]) map[brand] = { totalDays: 0, count: 0 };
      map[brand].totalDays += Math.max(0, daysToClose);
      map[brand].count++;
    });
    return Object.entries(map)
      .filter(([, v]) => v.count > 0)
      .map(([brand, v]) => ({
        brand,
        avgDays: Math.round(v.totalDays / v.count),
        count:   v.count,
      }))
      .sort((a, b) => a.avgDays - b.avgDays)
      .slice(0, 10);
  }, [closedLeads]);

  // Best deal (highest gross profit single lead)
  const bestDeal = useMemo(() => closedWithCost.reduce<Lead | null>((best, l) => !best || l.grossProfit > best.grossProfit ? l : best, null), [closedWithCost]);

  // ────────────────────────────────────────────────────────────────────────────
  // TAB 4 — SOURCE ROI
  // ────────────────────────────────────────────────────────────────────────────

  const sourceStats = useMemo(() => {
    const map: Record<string, { total: number; closed: number; revenue: number; grossProfit: number }> = {};
    leads.forEach(l => {
      // leads don't expose source directly but customers do — fallback to 'Walk-in'
      // We read source from the lead object (stored in DB as source column via CreateLeadInput)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const src = (l as any).source || 'Walk-in';
      if (!map[src]) map[src] = { total: 0, closed: 0, revenue: 0, grossProfit: 0 };
      map[src].total++;
      if (l.stage === 'closed') {
        map[src].closed++;
        map[src].revenue     += l.rawValue;
        map[src].grossProfit += l.grossProfit;
      }
    });
    return Object.entries(map)
      .map(([source, v]) => ({
        source,
        total:        v.total,
        closed:       v.closed,
        convRate:     v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
        revenue:      v.revenue,
        grossProfit:  v.grossProfit,
        avgDealValue: v.closed > 0 ? Math.round(v.revenue / v.closed) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [leads]);

  // Revenue by source (pie)
  const sourceRevenuePie = useMemo(
    () => sourceStats.filter(s => s.revenue > 0).map(s => ({ name: s.source, value: s.revenue })),
    [sourceStats],
  );

  // ── Scheduled report handler ──────────────────────────────────────────────────
  async function sendReport() {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    setSending(true);
    try {
      const res = await fetch('/api/reports/weekly', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealershipId: u.dealershipId, email: u.email }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Kunde inte skicka rapport');
      toast.success('Veckoresumé skickad till ' + u.email);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fel vid utskick');
    } finally {
      setSending(false);
    }
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Reports</p>
              <h1 className="text-2xl font-bold text-slate-900">📈 Analytics & Rapporter</h1>
              <p className="text-sm text-slate-400 mt-1">Realtidsdata från försäljning, leads och kunder</p>
            </div>
            <LiveDot />
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-5 border-b border-slate-100 -mb-6 pb-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-[#FF6B2C] text-[#FF6B2C] bg-orange-50/60'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: OVERVIEW ─────────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="flex-1 px-5 md:px-8 py-6 space-y-6">

            {/* Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard label="Total intäkt"      value={kr(totalRevenue)}   sub={`${paidInvoices.length} betalda fakturor`}               color={BRAND}    />
              <KPICard label="Snittordervärde"   value={kr(avgOrderValue)}  sub="per betald faktura"                                       color="#10b981"  />
              <KPICard label="Konverteringsgrad" value={pct(convRate)}      sub={`${paidInvoices.length} av ${invoices.length} fakturor`}  color="#8b5cf6"  />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Bruttovinst"     value={kr(totalGross)}   sub={`${closedWithCost.length} affärer med kostnad`}  color="#10b981"  />
              <KPICard label="Snittmarginal"   value={pct(avgMargin)}   sub="per avslutad affär med kostnad"                  color={avgMargin >= 15 ? '#10b981' : avgMargin >= 5 ? '#f59e0b' : '#ef4444'} />
              <KPICard label="Kunder totalt"   value={String(customers.length)} sub={`${customers.filter(c=>c.tag==='VIP').length} VIP · ${customers.filter(c=>c.tag==='Active').length} aktiva`} color={TEAL} />
              <KPICard label="Väntande fakturor" value={String(pendingCount)} sub="ej betalda ännu"                            color="#f59e0b"  />
            </div>

            {/* Revenue area chart */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <SectionHeader title="Intäktsutveckling — senaste 12 månader" sub="Betalda och väntande fakturor per månad (kr)" />
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={BRAND} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={TEAL} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<KrTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="paid"    name="Betalda"  stroke={BRAND} fill="url(#gradPaid)"    strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="pending" name="Väntande" stroke={TEAL}  fill="url(#gradPending)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Invoice bar */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Fakturor per månad" sub="Senaste 6 månader (antal)" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={invoicesByMonth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CountTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Betalda"  fill={BRAND} radius={[4,4,0,0]} />
                    <Bar dataKey="Väntande" fill={TEAL}  radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Payment mix pie */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Betalmetoder" sub="Fördelning av betalda fakturor" />
                {paymentMix.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={paymentMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                          {paymentMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`${v} st`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-1">
                      {paymentMix.slice(0, 4).map((m, i) => (
                        <div key={m.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-slate-600 truncate max-w-28">{m.name}</span>
                          </div>
                          <span className="font-semibold text-slate-700">{m.value} st</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-slate-400 text-xs mt-4">Inga betalda fakturor än.</p>}
              </div>

              {/* Customer segments pie */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Kundsegment" sub={`${customers.length} kunder totalt`} />
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={customerTags} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                      {customerTags.map((e) => <Cell key={e.name} fill={TAG_COLORS[e.name] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, name: any) => [`${v} kunder`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {customerTags.map(tag => (
                    <div key={tag.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: TAG_COLORS[tag.name] ?? '#94a3b8' }} />
                        <span className="text-slate-600">{tag.name}</span>
                      </div>
                      <span className="font-semibold text-slate-700">{tag.value} ({customers.length > 0 ? Math.round((tag.value/customers.length)*100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Scheduled reports card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">📧 Schemalagda rapporter</h2>
                  <p className="text-sm text-slate-500 mt-1 max-w-xl">
                    Varje måndag kl 08:00 skickas en veckoresumé med intäkter, leads, konvertering och toppaffärer
                    automatiskt till admin-e-posten via Vercel Cron + SMTP.
                    Du kan också skicka en testrapport direkt till din e-post.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Konfigurera SMTP under Inställningar → Integrationer. Kräver <code className="bg-slate-100 px-1 rounded">CRON_SECRET</code> env-variabel för automatisk utskickning.
                  </p>
                </div>
                <button
                  onClick={sendReport}
                  disabled={sending}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {sending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '📤'}
                  {sending ? 'Skickar…' : 'Skicka testrapport'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ── TAB: LEADERBOARD ──────────────────────────────────────────────────── */}
        {tab === 'leaderboard' && (
          <div className="flex-1 px-5 md:px-8 py-6 space-y-6">

            {/* Top 3 podium cards */}
            {leaderboard.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {leaderboard.slice(0, 3).map((s, i) => (
                    <div key={s.name} className={`bg-white rounded-2xl border p-5 ${i === 0 ? 'border-amber-200 ring-2 ring-amber-100' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                          <p className="text-xs text-slate-400">#{i + 1} totalt</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Intäkt</span>
                          <span className="font-bold text-slate-900">{kr(s.revenue)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Avslut</span>
                          <span className="font-semibold text-slate-700">{s.closedLeads} av {s.totalLeads} leads</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Konvertering</span>
                          <span className={`font-bold ${s.convRate >= 50 ? 'text-emerald-600' : s.convRate >= 25 ? 'text-amber-600' : 'text-red-600'}`}>{pct(s.convRate)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Snittaffär</span>
                          <span className="font-semibold text-slate-700">{kr(s.avgDealValue)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Bruttovinst</span>
                          <span className="font-semibold text-emerald-600">{kr(s.grossProfit)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Revenue bar chart */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <SectionHeader title="Intäkt per säljare" sub="Totalt från avslutade affärer" />
                  <ResponsiveContainer width="100%" height={Math.max(200, leaderboard.length * 42)}>
                    <BarChart data={leaderboard} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={120} />
                      <Tooltip content={<KrTooltip />} />
                      <Bar dataKey="revenue" name="Intäkt" fill={BRAND} radius={[0,4,4,0]}>
                        {leaderboard.map((_, i) => <Cell key={i} fill={i < 3 ? RANK_COLORS[i] : BRAND} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Full leaderboard table */}
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900">Fullständig topplista</h2>
                    {Object.keys(targetsMap).length > 0 && (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">Mål vs utfall ({new Date().getFullYear()})</span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-6 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Rank</th>
                          <th className="text-left px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Säljare</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Leads</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Avslut</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Konv.</th>
                          <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Intäkt</th>
                          {Object.keys(targetsMap).length > 0 && (
                            <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Intäkt %</th>
                          )}
                          <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Bruttovinst</th>
                          <th className="text-right px-6 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Snittaffär</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((s, i) => {
                          const tgt = targetsMap[s.name];
                          const revPct = tgt?.revenueTarget ? Math.round((s.revenue / tgt.revenueTarget) * 100) : null;
                          return (
                            <tr key={s.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 text-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}`}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-900">{s.name}</td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                {s.totalLeads}
                                {tgt?.leadsTarget ? <span className="text-slate-300 ml-1">/ {tgt.leadsTarget}</span> : null}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">{s.closedLeads}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-semibold ${s.convRate >= 50 ? 'text-emerald-600' : s.convRate >= 25 ? 'text-amber-600' : 'text-red-600'}`}>{pct(s.convRate)}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                {kr(s.revenue)}
                                {tgt?.revenueTarget ? <span className="block text-xs text-slate-300 font-normal">mål: {kr(tgt.revenueTarget)}</span> : null}
                              </td>
                              {Object.keys(targetsMap).length > 0 && (
                                <td className="px-4 py-3 text-right">
                                  {revPct !== null ? (
                                    <span className={`font-bold text-sm ${revPct >= 100 ? 'text-emerald-600' : revPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {revPct}%
                                    </span>
                                  ) : <span className="text-slate-300 text-xs">—</span>}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right font-semibold text-emerald-600">{kr(s.grossProfit)}</td>
                              <td className="px-6 py-3 text-right text-slate-600">{kr(s.avgDealValue)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                <p className="text-4xl mb-3">🏆</p>
                <p className="font-semibold text-slate-700">Inga säljare ännu</p>
                <p className="text-sm text-slate-400 mt-1">Säljarnamn registreras automatiskt på nya leads framöver.</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: GROSS PROFIT / MARGIN ────────────────────────────────────────── */}
        {tab === 'grossprofit' && (
          <div className="flex-1 px-5 md:px-8 py-6 space-y-6">

            {/* Margin KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Total bruttovinst" value={kr(totalGross)}   sub={`${closedWithCost.length} affärer med kostnad`}     color="#10b981" />
              <KPICard label="Snittmarginal"      value={pct(avgMargin)}  sub="genomsnitt per affär"                               color={avgMargin >= 15 ? '#10b981' : '#f59e0b'} />
              <KPICard label="Bästa affär"        value={bestDeal ? kr(bestDeal.grossProfit) : '—'} sub={bestDeal ? bestDeal.bike : 'n/a'} color={BRAND} />
              <KPICard label="Avslutade totalt"   value={String(closedLeads.length)} sub={`${closedWithCost.length} med kostnadspris`}     color={TEAL} />
            </div>

            {/* Monthly gross profit + revenue */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <SectionHeader title="Bruttovinst per månad — senaste 12 månader" sub="Intäkt vs bruttovinst (kr)" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={grossByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barSize={12} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<KrTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Intäkt"      fill={TEAL}    radius={[4,4,0,0]} />
                  <Bar dataKey="Bruttovinst" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Gross profit by brand */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Intäkt per märke (topp 10)" sub="Avslutade affärer, sorterade på intäkt" />
                {profitByBrand.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, profitByBrand.length * 36)}>
                    <BarChart data={profitByBrand} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<KrTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Intäkt"      fill={TEAL}    radius={[0,4,4,0]} />
                      <Bar dataKey="Bruttovinst" fill="#10b981" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-slate-400 text-xs mt-4">Inga avslutade affärer med märkesdata.</p>}
              </div>

              {/* Margin distribution */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Marginfördelning" sub="Antal affärer per marginalintervall" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={marginBuckets} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CountTooltip />} />
                    <Bar dataKey="Affärer" radius={[4,4,0,0]}>
                      {marginBuckets.map((_, i) => (
                        <Cell key={i} fill={i <= 1 ? '#ef4444' : i <= 2 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-400 mt-3">Grönt = marginal ≥ 10 % · Gult = 5–10 % · Rött = under 5 %</p>
              </div>
            </div>

            {/* Inventory turnover */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <SectionHeader title="Inventariecirkulation — genomsnittlig tid i pipeline" sub="Snittdagar från lead-skapande till avslut, per märke (kortare = bättre)" />
              {turnoverByBrand.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(160, turnoverByBrand.length * 38)}>
                    <BarChart data={turnoverByBrand} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" d" />
                      <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip formatter={(v: any) => [`${v} dagar`, 'Snitt pipeline']} />
                      <Bar dataKey="avgDays" name="Snitt dagar" radius={[0,4,4,0]}>
                        {turnoverByBrand.map((e, i) => (
                          <Cell key={i} fill={e.avgDays <= 14 ? '#10b981' : e.avgDays <= 30 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {turnoverByBrand.map(b => (
                      <div key={b.brand} className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{b.brand}</span>: {b.avgDays} d snitt ({b.count} affärer)
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Grönt ≤ 14 d · Gult ≤ 30 d · Rött {'>'} 30 d</p>
                </>
              ) : (
                <p className="text-slate-400 text-sm">Inga avslutade affärer att visa ännu.</p>
              )}
            </div>

          </div>
        )}

        {/* ── TAB: SOURCE ROI ───────────────────────────────────────────────────── */}
        {tab === 'sourceroi' && (
          <div className="flex-1 px-5 md:px-8 py-6 space-y-6">

            {/* Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Leads totalt"    value={String(leads.length)}        sub="alla kanaler"                                    color={BRAND}   />
              <KPICard label="Unika källor"    value={String(sourceStats.length)}  sub="identifierade leadkällor"                        color="#8b5cf6" />
              <KPICard label="Bästa källa"     value={sourceStats[0]?.source ?? '—'} sub={sourceStats[0] ? `${kr(sourceStats[0].revenue)} intäkt` : 'n/a'} color="#10b981" />
              <KPICard label="Snitt konv."     value={leads.length > 0 ? pct(Math.round(closedLeads.length / leads.length * 100)) : '—'} sub="alla källor kombinerat" color={TEAL}   />
            </div>

            {/* Source ROI table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-900">Källanalys — ROI per leadkälla</h2>
                <p className="text-xs text-slate-400 mt-0.5">Leads, konvertering och intäkt uppdelat per källa</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Källa</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Leads</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Avslut</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Konv.</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Total intäkt</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Bruttovinst</th>
                      <th className="text-right px-6 py-3 text-xs text-slate-400 font-semibold uppercase tracking-wide">Snittaffär</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceStats.map((s, i) => (
                      <tr key={s.source} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-semibold text-slate-900">{s.source}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{s.total}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{s.closed}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${s.convRate}%`, background: s.convRate >= 50 ? '#10b981' : s.convRate >= 25 ? '#f59e0b' : '#ef4444' }} />
                            </div>
                            <span className={`font-semibold text-xs ${s.convRate >= 50 ? 'text-emerald-600' : s.convRate >= 25 ? 'text-amber-600' : 'text-red-600'}`}>{pct(s.convRate)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{s.revenue > 0 ? kr(s.revenue) : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{s.grossProfit > 0 ? kr(s.grossProfit) : '—'}</td>
                        <td className="px-6 py-3 text-right text-slate-600">{s.avgDealValue > 0 ? kr(s.avgDealValue) : '—'}</td>
                      </tr>
                    ))}
                    {sourceStats.length === 0 && (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-sm">Inga leads ännu.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Source charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Volume bar */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Leadvolym per källa" sub="Totalt antal leads" />
                <ResponsiveContainer width="100%" height={Math.max(160, sourceStats.length * 38)}>
                  <BarChart data={sourceStats} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="source" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CountTooltip />} />
                    <Bar dataKey="total" name="Leads" radius={[0,4,4,0]}>
                      {sourceStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue by source pie */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <SectionHeader title="Intäkt per källa" sub="Totalt från avslutade affärer" />
                {sourceRevenuePie.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie data={sourceRevenuePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                          {sourceRevenuePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [kr(v as number), '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {sourceRevenuePie.slice(0, 5).map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-slate-600 truncate max-w-28">{s.name}</span>
                          </div>
                          <span className="font-semibold text-slate-700">{kr(s.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-slate-400 text-xs mt-4">Inga avslutade affärer ännu.</p>}
              </div>
            </div>

            {/* Conversion rate bar */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <SectionHeader title="Konverteringsgrad per källa" sub="Procent leads som blivit avslutade affärer" />
              <ResponsiveContainer width="100%" height={Math.max(160, sourceStats.length * 38)}>
                <BarChart data={sourceStats} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit=" %" domain={[0, 100]} />
                  <YAxis type="category" dataKey="source" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<PctTooltip />} />
                  <Bar dataKey="convRate" name="Konvertering" radius={[0,4,4,0]}>
                    {sourceStats.map((s, i) => (
                      <Cell key={i} fill={s.convRate >= 50 ? '#10b981' : s.convRate >= 25 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
