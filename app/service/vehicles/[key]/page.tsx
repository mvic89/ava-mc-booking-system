'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { type WorkOrder, WO_STATUS_COLORS, PRIORITY_COLORS } from '@/lib/service';

const STATUS_ICONS: Record<string, string> = {
  created:       '📋',
  in_progress:   '🔧',
  waiting_parts: '📦',
  ready:         '✅',
  completed:     '🏁',
  invoiced:      '🧾',
};

const STATUS_LABELS: Record<string, string> = {
  created:       'Created',
  in_progress:   'In Progress',
  waiting_parts: 'Waiting Parts',
  ready:         'Ready',
  completed:     'Completed',
  invoiced:      'Invoiced',
};

function kr(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('sv-SE', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VehicleHistoryDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key }  = use(params);
  const decoded  = decodeURIComponent(key);
  const router   = useRouter();
  const t        = useTranslations('service');

  const [orders,  setOrders]  = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    const dealershipId = getDealershipId();
    if (!dealershipId) { setLoading(false); return; }

    fetch(`/api/service/vehicles/${encodeURIComponent(decoded)}?dealershipId=${encodeURIComponent(dealershipId)}`)
      .then(async r => {
        const json = await r.json() as { orders?: WorkOrder[]; error?: string };
        if (!r.ok || json.error) { setError(json.error ?? 'Failed to load'); return; }
        setOrders(json.orders ?? []);
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, [router, decoded]);

  // Derived stats
  const totalLabor  = orders.reduce((s, o) => s + (o.labor_cost ?? 0), 0);
  const totalParts  = orders.reduce((s, o) => s + (o.parts_cost ?? 0), 0);
  const totalSpent  = orders.reduce((s, o) => s + (o.total_cost ?? 0), 0);
  const firstOrder  = orders.at(-1);
  const lastOrder   = orders.at(0);
  const vehicleName = firstOrder?.vehicle_name ?? decoded;
  const plate       = firstOrder?.plate ?? '';
  const vin         = firstOrder?.vin ?? '';
  const customerName = firstOrder?.customer_name ?? '';
  const customerPhone = firstOrder?.customer_phone ?? '';

  const completedCount = orders.filter(o => ['completed', 'invoiced'].includes(o.status)).length;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa] dark:bg-slate-900">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <div className="bg-[#0b1524] text-white px-5 md:px-10 pt-6 pb-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-5">
            <Link href="/service" className="hover:text-[#FF6B2C] transition-colors">Service</Link>
            <span>›</span>
            <Link href="/service/vehicles" className="hover:text-[#FF6B2C] transition-colors">Vehicle History</Link>
            <span>›</span>
            <span className="text-slate-300 font-mono">{plate || decoded}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Bike icon */}
            <div className="w-20 h-20 rounded-2xl bg-[#FF6B2C]/15 border border-[#FF6B2C]/20 flex items-center justify-center text-5xl shrink-0">
              🏍️
            </div>

            {/* Vehicle info */}
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2">
                {vehicleName || 'Unknown Vehicle'}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {plate && (
                  <span className="text-sm font-mono font-bold bg-white/10 border border-white/20 text-white px-3 py-1 rounded-lg">
                    {plate}
                  </span>
                )}
                {vin && (
                  <span className="text-xs font-mono text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                    VIN: {vin}
                  </span>
                )}
              </div>

              {/* Customer chip */}
              {customerName && (
                <div className="inline-flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-[#FF6B2C]/20 flex items-center justify-center text-xs font-bold text-[#FF6B2C] shrink-0">
                    {customerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">{customerName}</p>
                    {customerPhone && <p className="text-xs text-slate-400 mt-0.5">{customerPhone}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Quick action */}
            <Link
              href={`/service/orders/new`}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors"
            >
              + New Work Order
            </Link>
          </div>

          {/* Stats bar */}
          {!loading && orders.length > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Work Orders',   value: String(orders.length),           sub: `${completedCount} completed` },
                { label: 'Total Spent',   value: kr(totalSpent),                  sub: `${kr(totalLabor)} labour · ${kr(totalParts)} parts` },
                { label: 'First Visit',   value: firstOrder ? fmtDate(firstOrder.created_at) : '—', sub: '' },
                { label: 'Last Service',  value: lastOrder  ? fmtDate(lastOrder.created_at)  : '—', sub: lastOrder ? (STATUS_LABELS[lastOrder.status] ?? lastOrder.status) : '' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-base font-black text-white">{s.value}</p>
                  {s.sub && <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Timeline body ────────────────────────────────────────────────── */}
        <div className="px-5 md:px-10 py-8 max-w-4xl">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-10 h-10 border-3 border-[#FF6B2C] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm">Loading service history…</p>
            </div>

          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-slate-700 dark:text-slate-200 font-semibold mb-1">Failed to load history</p>
              <p className="text-sm text-slate-400 font-mono bg-red-50 px-3 py-2 rounded-xl mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold"
              >
                Retry
              </button>
            </div>

          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mb-4">📋</div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">No service history yet</h3>
              <p className="text-sm text-slate-400">Work orders for this vehicle will appear here.</p>
              <Link
                href="/service/orders/new"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-bold hover:bg-[#e55a1f] transition-colors"
              >
                + Create Work Order
              </Link>
            </div>

          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  Service Timeline — {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                </h2>
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4.75 top-5 bottom-5 w-0.5 bg-linear-to-b from-[#FF6B2C] via-slate-200 to-slate-100 dark:via-slate-700 dark:to-slate-800" />

                <div className="space-y-5">
                  {orders.map((o, i) => {
                    const statusColor   = WO_STATUS_COLORS[o.status]  ?? 'bg-slate-100 text-slate-500';
                    const priorityColor = PRIORITY_COLORS[o.priority] ?? 'bg-slate-100 text-slate-500';
                    const icon          = STATUS_ICONS[o.status] ?? '🔧';
                    const isLatest      = i === 0;

                    return (
                      <div key={o.id} className="relative flex gap-4 md:gap-6">
                        {/* Timeline dot */}
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 shadow-md transition-all ${
                          isLatest
                            ? 'bg-[#FF6B2C] ring-4 ring-[#FF6B2C]/20'
                            : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600'
                        }`}>
                          {icon}
                        </div>

                        {/* Card */}
                        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-[#FF6B2C]/30 transition-all mb-1 overflow-hidden">

                          {/* Card header */}
                          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/service/orders/${o.id}`}
                                  className="text-sm font-bold text-slate-900 dark:text-white hover:text-[#FF6B2C] transition-colors"
                                >
                                  Work Order #{o.id}
                                </Link>
                                {isLatest && (
                                  <span className="text-[10px] font-bold bg-[#FF6B2C]/10 text-[#FF6B2C] px-2 py-0.5 rounded-full">
                                    LATEST
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {fmtDate(o.created_at, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${priorityColor}`}>
                                {o.priority}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusColor}`}>
                                {icon} {STATUS_LABELS[o.status] ?? o.status}
                              </span>
                            </div>
                          </div>

                          {/* Card body */}
                          <div className="px-5 py-4 space-y-4">
                            {o.description && (
                              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                {o.description}
                              </p>
                            )}

                            {/* Details grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {o.mileage && o.mileage > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Odometer</p>
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{o.mileage.toLocaleString('sv-SE')} km</p>
                                </div>
                              )}
                              {o.assigned_tech && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Technician</p>
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{o.assigned_tech}</p>
                                </div>
                              )}
                              {o.labor_cost > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Labour</p>
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{kr(o.labor_cost)}</p>
                                </div>
                              )}
                              {o.parts_cost > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Parts</p>
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">{kr(o.parts_cost)}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card footer */}
                          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700">
                            <div>
                              {o.completed_at ? (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  ✓ Completed {fmtDate(o.completed_at)}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400">In progress</p>
                              )}
                            </div>
                            {o.total_cost > 0 && (
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white">{kr(o.total_cost)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary footer */}
              <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Lifetime Summary</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-black text-[#FF6B2C]">{orders.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Total visits</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{kr(totalLabor)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Total labour</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{kr(totalSpent)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Total spent</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
