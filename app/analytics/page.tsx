'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getInvoices } from '@/lib/invoices';
import { getCustomers } from '@/lib/customers';
import { useAutoRefresh } from '@/lib/realtime';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function last6Months() {
  return last12Months().slice(6);
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const t = useTranslations('pages');

  const [invoices,  setInvoices]  = useState(() => getInvoices());
  const [customers, setCustomers] = useState(() => getCustomers());
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }
    setInvoices(getInvoices());
    setCustomers(getCustomers());
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => {
    setInvoices(getInvoices());
    setCustomers(getCustomers());
  });

  // ── Revenue by month (last 12) ─────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const months = last12Months();
    return months.map(({ year, month, label }) => {
      const paid = invoices
        .filter(inv => {
          if (inv.status !== 'paid' || !inv.paidDate) return false;
          const d = new Date(inv.paidDate);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((s, inv) => s + inv.totalAmount, 0);
      const pending = invoices
        .filter(inv => {
          if (inv.status !== 'pending') return false;
          const d = new Date(inv.issueDate);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((s, inv) => s + inv.totalAmount, 0);
      return { label, paid, pending };
    });
  }, [invoices]);

  // ── Invoice count by month (last 6) ───────────────────────────────────────
  const invoicesByMonth = useMemo(() => {
    const months = last6Months();
    return months.map(({ year, month, label }) => {
      const paid = invoices.filter(inv => {
        if (inv.status !== 'paid' || !inv.paidDate) return false;
        const d = new Date(inv.paidDate);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length;
      const pending = invoices.filter(inv => {
        if (inv.status !== 'pending') return false;
        const d = new Date(inv.issueDate);
        return d.getFullYear() === year && d.getMonth() === month;
      }).length;
      return { label, Betalda: paid, Väntande: pending };
    });
  }, [invoices]);

  // ── Payment method distribution ────────────────────────────────────────────
  const paymentMix = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter(inv => inv.status === 'paid').forEach(inv => {
      const key = inv.paymentMethod || 'Okänd';
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [invoices]);

  // ── Customer tag distribution ──────────────────────────────────────────────
  const customerTags = useMemo(() => {
    const map: Record<string, number> = { VIP: 0, Active: 0, New: 0, Inactive: 0 };
    customers.forEach(c => { map[c.tag] = (map[c.tag] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [customers]);

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const totalRevenue  = useMemo(() => invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0), [invoices]);
  const avgOrderValue = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid');
    return paid.length ? Math.round(totalRevenue / paid.length) : 0;
  }, [invoices, totalRevenue]);
  const paidCount    = invoices.filter(i => i.status === 'paid').length;
  const pendingCount = invoices.filter(i => i.status === 'pending').length;
  const convRate     = invoices.length > 0 ? Math.round((paidCount / invoices.length) * 100) : 0;

  const PIE_COLORS = ['#FF6B2C', '#235971', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
  const TAG_COLORS: Record<string, string> = {
    VIP: '#f59e0b', Active: '#10b981', New: '#3b82f6', Inactive: '#94a3b8',
  };

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
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Reports</p>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            📈 {t('analytics.title')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t('analytics.desc')}</p>
        </div>

        <div className="flex-1 px-5 md:px-8 py-6 space-y-6 animate-fade-up">

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total intäkt',    value: `${totalRevenue.toLocaleString('sv-SE')} kr`, sub: `${paidCount} betalda fakturor`,       color: '#FF6B2C' },
              { label: 'Snittordervärde', value: `${avgOrderValue.toLocaleString('sv-SE')} kr`, sub: 'per betald faktura',                 color: '#10b981' },
              { label: 'Konverteringsgrad', value: `${convRate} %`,                             sub: `${paidCount} av ${invoices.length} fakturor`, color: '#8b5cf6' },
              { label: 'Kunder totalt',   value: customers.length.toLocaleString('sv-SE'),     sub: `${customers.filter(c=>c.tag==='VIP').length} VIP · ${customers.filter(c=>c.tag==='Active').length} aktiva`, color: '#235971' },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">{k.label}</p>
                <p className="text-2xl font-black text-slate-900 tabular-nums" style={{ color: k.color }}>{k.value}</p>
                <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Revenue area chart — last 12 months */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h2 className="font-bold text-slate-900 mb-1">Intäktsutveckling — senaste 12 månader</h2>
            <p className="text-xs text-slate-400 mb-5">Betalda och väntande fakturor per månad (kr)</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#FF6B2C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF6B2C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#235971" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#235971" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<KrTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="paid"    name="Betalda"   stroke="#FF6B2C" fill="url(#gradPaid)"    strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="pending" name="Väntande"  stroke="#235971" fill="url(#gradPending)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom row: bar chart + two pie charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Invoice count bar chart */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 p-6">
              <h2 className="font-bold text-slate-900 mb-1">Fakturor per månad</h2>
              <p className="text-xs text-slate-400 mb-5">Senaste 6 månader (antal)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={invoicesByMonth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CountTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Betalda"  fill="#FF6B2C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Väntande" fill="#235971" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Payment method pie */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h2 className="font-bold text-slate-900 mb-1">Betalmetoder</h2>
              <p className="text-xs text-slate-400 mb-4">Fördelning av betalda fakturor</p>
              {paymentMix.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={paymentMix} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={65} innerRadius={38} paddingAngle={3}>
                        {paymentMix.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v} st`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {paymentMix.slice(0, 4).map((m, i) => (
                      <div key={m.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-600 truncate max-w-[110px]">{m.name}</span>
                        </div>
                        <span className="font-semibold text-slate-700 shrink-0">{m.value} st</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-slate-400 text-xs mt-4">Inga betalda fakturor än.</p>
              )}
            </div>

            {/* Customer tag pie */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h2 className="font-bold text-slate-900 mb-1">Kundsegment</h2>
              <p className="text-xs text-slate-400 mb-4">{customers.length} kunder totalt</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={customerTags} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={65} innerRadius={38} paddingAngle={3}>
                    {customerTags.map((entry) => (
                      <Cell key={entry.name} fill={TAG_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [`${v} kunder`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {customerTags.map(tag => (
                  <div key={tag.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: TAG_COLORS[tag.name] ?? '#94a3b8' }} />
                      <span className="text-slate-600">{tag.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700">
                      {tag.value} ({Math.round((tag.value / customers.length) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
