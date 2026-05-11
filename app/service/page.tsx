'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import {
  getServiceBookings, getWorkOrders,
  type ServiceBooking, type WorkOrder,
  BOOKING_STATUS_COLORS,
  WO_STATUS_COLORS, PRIORITY_COLORS,
} from '@/lib/service';
import { getInvoices, type Invoice } from '@/lib/invoices';
import { useAutoRefresh } from '@/lib/realtime';

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}
function krFmt(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

const STATUS_ORDER: WorkOrder['status'][] = [
  'created', 'in_progress', 'waiting_parts', 'ready', 'completed', 'invoiced',
];

const STATUS_STEP: Record<WorkOrder['status'], number> = {
  created: 1, in_progress: 2, waiting_parts: 2, ready: 3, completed: 4, invoiced: 5,
};

export default function ServiceDashboard() {
  const router = useRouter();
  const t = useTranslations('service');
  const [bookings,     setBookings]     = useState<ServiceBooking[]>([]);
  const [orders,       setOrders]       = useState<WorkOrder[]>([]);
  const [srvInvoices,  setSrvInvoices]  = useState<Invoice[]>([]);
  const [ready,        setReady]        = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const [b, o, allInv] = await Promise.all([
      getServiceBookings(),
      getWorkOrders(),
      getInvoices(),
    ]);
    setBookings(b);
    setOrders(o);
    setSrvInvoices(allInv.filter(inv => inv.id.startsWith('SRV-')));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    void load();
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [router, load]);

  useAutoRefresh(() => { void load(); });

  const todayBookings  = bookings.filter(b => b.scheduled_at.startsWith(today) && b.status !== 'cancelled');
  const activeOrders   = orders.filter(o => !['completed', 'invoiced'].includes(o.status));
  const waitingParts   = orders.filter(o => o.status === 'waiting_parts');
  const doneToday      = orders.filter(o => o.completed_at?.startsWith(today));
  const readyOrders    = orders.filter(o => o.status === 'ready');

  // Revenue: paid SRV- invoices (authoritative) + completed/invoiced orders with no invoice
  // (the latter covers orders completed before the invoice-creation bug was fixed)
  const srvPaidInvoiceIds = new Set(
    srvInvoices.filter(inv => inv.status === 'paid').map(inv => inv.id)
  );
  const revenue =
    srvInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((s, inv) => s + inv.totalAmount, 0)
    + orders
      .filter(o => ['completed', 'invoiced'].includes(o.status) && !o.invoice_id && (o.total_cost ?? 0) > 0)
      .reduce((s, o) => s + Math.round((o.total_cost ?? 0) * 1.25 * 100) / 100, 0);

  // Pending: unpaid SRV- invoices + active work orders with costs not yet invoiced
  const srvPendingIds = new Set(srvInvoices.map(inv => inv.id));
  const pendingRevenue =
    srvInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((s, inv) => s + inv.totalAmount, 0)
    + activeOrders
      .filter(o => !o.invoice_id && (o.total_cost ?? 0) > 0)
      .reduce((s, o) => s + Math.round((o.total_cost ?? 0) * 1.25 * 100) / 100, 0);

  void srvPaidInvoiceIds; void srvPendingIds; // suppress unused-var lint
  const avgDuration    = todayBookings.length
    ? Math.round(todayBookings.reduce((s, b) => s + b.duration_min, 0) / todayBookings.length)
    : 0;

  const bookingStatusLabel = (status: ServiceBooking['status']) =>
    t(`bookingStatus.${status}` as Parameters<typeof t>[0]);
  const woStatusLabel = (status: WorkOrder['status']) =>
    t(`status.${status}` as Parameters<typeof t>[0]);
  const priorityLabel = (p: WorkOrder['priority']) =>
    t(`priority.${p}` as Parameters<typeof t>[0]);

  const kpiCards = [
    {
      label: t('dashboard.kpi.todayBookings'),
      value: todayBookings.length,
      sub: avgDuration ? `~${avgDuration} min / ${t('common.booking')}` : t('dashboard.kpi.noBookings'),
      icon: '📅',
      href: '/service/bookings',
    },
    {
      label: t('dashboard.kpi.activeOrders'),
      value: activeOrders.length,
      sub: pendingRevenue > 0 ? krFmt(pendingRevenue) + ' pågående' : t('dashboard.kpi.noOrders'),
      icon: '🔧',
      href: '/service/orders',
    },
    {
      label: t('dashboard.kpi.waitingParts'),
      value: waitingParts.length,
      sub: waitingParts.length > 0
        ? waitingParts.map(o => `AO-${o.id}`).slice(0, 2).join(', ') + (waitingParts.length > 2 ? '…' : '')
        : t('dashboard.kpi.allGood'),
      icon: '🔩',
      href: '/service/orders?status=waiting_parts',
      alert: waitingParts.length > 0,
    },
    {
      label: t('dashboard.kpi.doneToday'),
      value: doneToday.length,
      sub: doneToday.length > 0
        ? krFmt(Math.round(doneToday.reduce((s, o) => s + (o.total_cost ?? 0) * 1.25, 0) * 100) / 100) + ' idag'
        : t('dashboard.kpi.noDone'),
      icon: '✅',
      href: '/service/orders?status=completed',
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Premium header */}
        <div
          className="px-5 md:px-8 py-7 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0b1524 0%, #1a2a40 60%, #0f3460 100%)' }}
        >
          {/* decorative rings */}
          <div className="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full border border-white/5" />
          <div className="pointer-events-none absolute -top-6 -right-6 w-32 h-32 rounded-full border border-white/10" />

          <nav className="flex items-center gap-1.5 text-xs text-white/40 mb-4">
            <Link href="/dashboard" className="hover:text-white/70 transition-colors">Dashboard</Link>
            <span>›</span>
            <span className="text-white/70 font-medium">Service</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">🛠️</span>
                <h1 className="text-2xl font-black text-white">{t('dashboard.title')}</h1>
              </div>
              <p className="text-sm text-white/50 ml-11">{t('dashboard.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/service/bookings/new"
                className="px-4 py-2 rounded-xl border border-white/20 text-white/80 text-sm font-semibold hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                {t('dashboard.newBooking')}
              </Link>
              <Link
                href="/service/orders/new"
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors"
                style={{ background: '#FF6B2C' }}
              >
                + {t('dashboard.newOrder')}
              </Link>
            </div>
          </div>

          {/* Mini revenue strip */}
          {ready && (
            <div className="mt-5 flex items-center gap-6 ml-1">
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('dashboard.stats.earned')}</p>
                <p className="text-lg font-black text-emerald-400">{krFmt(revenue)}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('dashboard.stats.pending')}</p>
                <p className="text-lg font-black text-amber-400">{krFmt(pendingRevenue)}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('dashboard.stats.readyPickup')}</p>
                <p className="text-lg font-black text-white">{readyOrders.length}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 md:px-8 py-6 space-y-6">

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map(k => (
              <Link
                key={k.label}
                href={k.href}
                className="group bg-white rounded-xl border border-slate-100 px-4 py-3 hover:border-slate-200 hover:shadow-sm transition-all flex items-center gap-3"
              >
                <span className="text-lg shrink-0">{k.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-black text-slate-900 leading-none">
                    {ready ? k.value : <span className="text-slate-200">—</span>}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">{k.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{ready ? k.sub : '...'}</p>
                </div>
                {'alert' in k && k.alert && (
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
                )}
              </Link>
            ))}
          </div>

          {/* Ready for pickup — alert strip */}
          {readyOrders.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap shadow-sm">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-base">🏁</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{readyOrders.length} fordon redo för hämtning</p>
                  <p className="text-xs text-slate-400">{t('dashboard.pickup.title', { count: readyOrders.length })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                {readyOrders.slice(0, 4).map(o => (
                  <Link
                    key={o.id}
                    href={`/service/orders/${o.id}`}
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl px-3 py-1.5 transition-colors"
                  >
                    <p className="text-[10px] font-bold text-slate-400">AO-{o.id}</p>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-30">{o.customer_name}</p>
                    <p className="text-[11px] font-black text-emerald-600">{krFmt(o.total_cost)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Today's schedule */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t('dashboard.schedule.title')}</h2>
                  <p className="text-xs text-slate-400 capitalize">
                    {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
                <Link href="/service/bookings" className="text-xs font-semibold hover:underline" style={{ color: '#FF6B2C' }}>
                  {t('dashboard.schedule.viewAll')}
                </Link>
              </div>

              {!ready ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : todayBookings.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">📅</p>
                  <p className="text-xs text-slate-500 font-medium">{t('dashboard.schedule.noBookings')}</p>
                  <Link
                    href="/service/bookings/new"
                    className="mt-3 inline-block text-xs font-semibold hover:underline"
                    style={{ color: '#FF6B2C' }}
                  >
                    + {t('dashboard.newBooking')}
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {todayBookings.map(b => (
                    <Link key={b.id} href={`/service/bookings/${b.id}`}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                    >
                      {/* Time column */}
                      <div className="shrink-0 w-14 rounded-lg text-center py-1.5 bg-slate-100">
                        <p className="text-[9px] font-semibold text-slate-400 uppercase">kl.</p>
                        <p className="text-sm font-black text-slate-800">{fmt(b.scheduled_at)}</p>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate group-hover:text-[#FF6B2C] transition-colors">
                          {b.customer_name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {b.vehicle_name || b.plate || t('common.noVehicle')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {b.assigned_tech || t('common.notAssigned')} · {b.duration_min} min
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${BOOKING_STATUS_COLORS[b.status]}`}>
                        {bookingStatusLabel(b.status)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Active work orders */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t('dashboard.orders.title')}</h2>
                  <p className="text-xs text-slate-400">{t('dashboard.orders.ongoing', { count: activeOrders.length })}</p>
                </div>
                <Link href="/service/orders" className="text-xs font-semibold hover:underline" style={{ color: '#FF6B2C' }}>
                  {t('dashboard.orders.viewAll')}
                </Link>
              </div>

              {!ready ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : activeOrders.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-3xl mb-2">🔧</p>
                  <p className="text-xs text-slate-500 font-medium">{t('dashboard.orders.noOrders')}</p>
                  <Link
                    href="/service/orders/new"
                    className="mt-3 inline-block text-xs font-semibold hover:underline"
                    style={{ color: '#FF6B2C' }}
                  >
                    + {t('dashboard.orders.createOrder')}
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {activeOrders.slice(0, 8).map(o => {
                    const step = STATUS_STEP[o.status];
                    const pct  = Math.round((step / 5) * 100);
                    return (
                      <Link key={o.id} href={`/service/orders/${o.id}`}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                      >
                        {/* ID + date */}
                        <div className="shrink-0 w-16">
                          <p className="text-[10px] font-black text-slate-400">AO-{o.id}</p>
                          <p className="text-[10px] text-slate-400">{fmtDate(o.created_at)}</p>
                        </div>
                        {/* Customer + progress */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-[#FF6B2C] transition-colors">
                            {o.customer_name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{o.vehicle_name || o.plate || t('common.noVehicle')}</p>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                background: o.status === 'waiting_parts'
                                  ? '#f97316'
                                  : o.status === 'ready'
                                    ? '#10b981'
                                    : '#FF6B2C',
                              }}
                            />
                          </div>
                        </div>
                        {/* Status + priority + cost */}
                        <div className="shrink-0 text-right space-y-0.5">
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${WO_STATUS_COLORS[o.status]}`}>
                            {woStatusLabel(o.status)}
                          </span>
                          <p className="text-[10px] text-slate-400">{o.assigned_tech || t('common.notAssigned')}</p>
                          {o.total_cost > 0 && (
                            <p className="text-[10px] font-bold text-slate-600">{krFmt(o.total_cost)}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick-access tools: Vehicle History + Communications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/service/vehicles"
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-[#FF6B2C]/30 hover:shadow-md transition-all flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FF6B2C]/10 flex items-center justify-center text-2xl shrink-0 group-hover:bg-[#FF6B2C]/20 transition-colors">
                🏍️
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 group-hover:text-[#FF6B2C] transition-colors">
                  {t('vehicles.title')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('vehicles.subtitle')}</p>
                <span className="mt-3 inline-flex items-center text-xs font-semibold text-[#FF6B2C]">
                  {t('vehicles.viewHistory')} →
                </span>
              </div>
            </Link>

            <Link
              href="/service/communications"
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-[#FF6B2C]/30 hover:shadow-md transition-all flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl shrink-0 group-hover:bg-blue-100 transition-colors">
                ✉️
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 group-hover:text-[#FF6B2C] transition-colors">
                  {t('comms.title')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('comms.subtitle')}</p>
                <span className="mt-3 inline-flex items-center text-xs font-semibold text-[#FF6B2C]">
                  {t('comms.compose')} →
                </span>
              </div>
            </Link>
          </div>

          {/* Bottom: Status breakdown + All orders summary */}
          {ready && orders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Status — alla arbetsordrar</h3>
                <div className="space-y-2.5">
                  {STATUS_ORDER.map(s => {
                    const count = orders.filter(o => o.status === s).length;
                    if (count === 0) return null;
                    const pct = Math.round((count / orders.length) * 100);
                    return (
                      <Link key={s} href={`/service/orders?status=${s}`} className="group block">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${WO_STATUS_COLORS[s]}`}>
                            {woStatusLabel(s)}
                          </span>
                          <span className="text-xs font-bold text-slate-700">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all group-hover:opacity-80"
                            style={{ width: `${pct}%`, background: '#FF6B2C' }}
                          />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Priority breakdown */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Prioritet — aktiva ordrar</h3>
                {activeOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Inga aktiva arbetsordrar</p>
                ) : (
                  <div className="space-y-3">
                    {(['urgent', 'high', 'normal', 'low'] as WorkOrder['priority'][]).map(p => {
                      const items = activeOrders.filter(o => o.priority === p);
                      if (!items.length) return null;
                      return (
                        <div key={p} className="flex items-center gap-3">
                          <span className={`w-20 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-center ${PRIORITY_COLORS[p]}`}>
                            {priorityLabel(p)}
                          </span>
                          <div className="flex-1 flex items-center gap-1 flex-wrap">
                            {items.slice(0, 5).map(o => (
                              <Link key={o.id} href={`/service/orders/${o.id}`}
                                className="text-[10px] font-bold text-slate-500 hover:text-[#FF6B2C] bg-slate-50 hover:bg-orange-50 rounded-lg px-2 py-1 transition-colors"
                              >
                                AO-{o.id}
                              </Link>
                            ))}
                            {items.length > 5 && (
                              <span className="text-[10px] text-slate-400">+{items.length - 5} till</span>
                            )}
                          </div>
                          <span className="text-xs font-black text-slate-700 shrink-0">{items.length}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
