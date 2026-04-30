'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import {
  getServiceBookings, type ServiceBooking, type BookingStatus,
  BOOKING_STATUS_COLORS, SERVICE_TYPE_LABELS,
} from '@/lib/service';

export default function BookingsPage() {
  const router = useRouter();
  const t = useTranslations('service');
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [ready,    setReady]    = useState(false);
  const [tab,      setTab]      = useState<BookingStatus | 'all'>('all');
  const [search,   setSearch]   = useState('');

  const STATUS_TABS: { key: BookingStatus | 'all'; label: string }[] = [
    { key: 'all',         label: t('bookings.tabs.all') },
    { key: 'booked',      label: t('bookings.tabs.booked') },
    { key: 'confirmed',   label: t('bookings.tabs.confirmed') },
    { key: 'checked_in',  label: t('bookings.tabs.checked_in') },
    { key: 'in_progress', label: t('bookings.tabs.in_progress') },
    { key: 'ready',       label: t('bookings.tabs.ready') },
    { key: 'completed',   label: t('bookings.tabs.completed') },
  ];

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    getServiceBookings().then(b => { setBookings(b); setReady(true); });
  }, [router]);

  const filtered = useMemo(() => {
    let list = tab === 'all' ? bookings : bookings.filter(b => b.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.customer_name.toLowerCase().includes(q) ||
        b.vehicle_name.toLowerCase().includes(q) ||
        b.plate.toLowerCase().includes(q) ||
        b.assigned_tech.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, tab, search]);

  async function confirmBooking(b: ServiceBooking) {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const res = await fetch(`/api/service/bookings/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: 'confirmed' }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: 'confirmed' } : x));
      toast.success(t('bookings.toasts.confirmed'));
    }
  }

  async function convertToOrder(b: ServiceBooking) {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const res = await fetch('/api/service/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        bookingId:     b.id,
        customerId:    b.customer_id,
        customerName:  b.customer_name,
        customerPhone: b.customer_phone,
        vehicleId:     b.vehicle_id,
        vehicleName:   b.vehicle_name,
        plate:         b.plate,
        vin:           b.vin,
        description:   b.description,
      }),
    });
    if (res.ok) {
      const { order } = await res.json();
      toast.success(t('bookings.toasts.orderCreated'));
      router.push(`/service/orders/${order.id}`);
    } else {
      toast.error(t('bookings.toasts.orderError'));
    }
  }

  const bookingStatusLabel = (status: ServiceBooking['status']) =>
    t(`bookingStatus.${status}` as Parameters<typeof t>[0]);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/dashboard" className="hover:text-[#FF6B2C]">Dashboard</Link>
            <span>→</span>
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('bookings.title')}</span>
          </nav>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">{t('bookings.title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('bookings.total', { count: bookings.length })}</p>
            </div>
            <Link
              href="/service/bookings/new"
              className="px-4 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold transition-colors"
            >
              {t('bookings.newBooking')}
            </Link>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 space-y-5">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 flex-wrap">
              {STATUS_TABS.map(tab_ => (
                <button
                  key={tab_.key}
                  onClick={() => setTab(tab_.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    tab === tab_.key
                      ? 'bg-[#FF6B2C] text-white'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab_.label}
                  <span className="ml-1.5 opacity-60">
                    {tab_.key === 'all' ? bookings.length : bookings.filter(b => b.status === tab_.key).length}
                  </span>
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('bookings.searchPlaceholder')}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 w-60"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {!ready ? (
              <div className="py-12 text-center text-slate-400 text-sm">{t('bookings.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">📅</p>
                <p className="text-sm text-slate-500">{t('bookings.noResults')}</p>
                <Link href="/service/bookings/new" className="mt-3 inline-block text-sm text-[#FF6B2C] font-semibold hover:underline">
                  {t('bookings.createFirst')}
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {[
                        t('bookings.headers.customer'),
                        t('bookings.headers.type'),
                        t('bookings.headers.dateTime'),
                        t('bookings.headers.technician'),
                        t('bookings.headers.status'),
                        '',
                      ].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(b => (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">{b.customer_name || '—'}</p>
                          <p className="text-[11px] text-slate-400">{b.vehicle_name}{b.plate ? ` · ${b.plate}` : ''}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs text-slate-600">{SERVICE_TYPE_LABELS[b.service_type]}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs font-semibold text-slate-900">
                            {new Date(b.scheduled_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {t('common.at')} {new Date(b.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} · {b.duration_min} min
                          </p>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600">{b.assigned_tech || '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${BOOKING_STATUS_COLORS[b.status]}`}>
                            {bookingStatusLabel(b.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {b.status === 'booked' && (
                              <button
                                onClick={() => confirmBooking(b)}
                                className="text-xs text-indigo-600 font-semibold hover:underline"
                              >
                                {t('bookings.actions.confirm')}
                              </button>
                            )}
                            {(b.status === 'confirmed' || b.status === 'booked') && !b.work_order_id && (
                              <button
                                onClick={() => convertToOrder(b)}
                                className="text-xs text-[#FF6B2C] font-semibold hover:underline"
                              >
                                {t('bookings.actions.toOrder')}
                              </button>
                            )}
                            {b.work_order_id && (
                              <Link href={`/service/orders/${b.work_order_id}`} className="text-xs text-[#FF6B2C] font-semibold hover:underline">
                                {t('bookings.actions.openWorkOrder')} →
                              </Link>
                            )}
                            <Link href={`/service/bookings/${b.id}`} className="text-xs text-slate-400 hover:text-slate-700">
                              {t('bookings.actions.open')}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
