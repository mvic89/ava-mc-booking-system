'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import {
  getServiceBooking, type ServiceBooking, type BookingStatus,
  BOOKING_STATUS_COLORS, SERVICE_TYPE_LABELS,
} from '@/lib/service';

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations('service');
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Status flow config built from translations
  const STATUS_FLOW: Partial<Record<BookingStatus, { next: BookingStatus; label: string; color: string }>> = {
    booked:      { next: 'confirmed',   label: t('bookingDetail.statusFlow.confirmBooking'), color: 'bg-indigo-600 hover:bg-indigo-700' },
    confirmed:   { next: 'checked_in',  label: t('bookingDetail.statusFlow.checkIn'),        color: 'bg-cyan-600 hover:bg-cyan-700' },
    checked_in:  { next: 'in_progress', label: t('bookingDetail.statusFlow.startService'),   color: 'bg-amber-600 hover:bg-amber-700' },
    in_progress: { next: 'ready',       label: t('bookingDetail.statusFlow.markReady'),      color: 'bg-emerald-600 hover:bg-emerald-700' },
    ready:       { next: 'completed',   label: t('bookingDetail.statusFlow.complete'),        color: 'bg-slate-700 hover:bg-slate-900' },
  };

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    getServiceBooking(Number(id)).then(b => { setBooking(b); setLoading(false); });
  }, [id, router]);

  async function updateStatus(nextStatus: BookingStatus) {
    if (!booking) return;
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setUpdating(true);
    const res = await fetch(`/api/service/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: nextStatus }),
    });
    setUpdating(false);
    if (res.ok) {
      const { booking: updated } = await res.json();
      setBooking(updated);
      toast.success(`Status: ${t(`bookingStatus.${nextStatus}` as Parameters<typeof t>[0])}`);
    }
  }

  async function convertToWorkOrder() {
    if (!booking) return;
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setUpdating(true);
    const res = await fetch('/api/service/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId,
        bookingId:     booking.id,
        customerId:    booking.customer_id,
        customerName:  booking.customer_name,
        customerPhone: booking.customer_phone,
        vehicleId:     booking.vehicle_id,
        vehicleName:   booking.vehicle_name,
        plate:         booking.plate,
        vin:           booking.vin,
        description:   booking.description,
      }),
    });
    setUpdating(false);
    if (res.ok) {
      const { order } = await res.json();
      toast.success(t('bookingDetail.toasts.orderCreated'));
      router.push(`/service/orders/${order.id}`);
    } else {
      toast.error(t('bookingDetail.toasts.orderError'));
    }
  }

  if (loading) return (
    <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center text-slate-400">{t('bookingDetail.loading')}</div>
    </div>
  );

  if (!booking) return (
    <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="text-center"><p className="text-slate-500 mb-4">{t('bookingDetail.notFound')}</p>
          <Link href="/service/bookings" className="text-[#FF6B2C] font-semibold">{t('common.back')}</Link>
        </div>
      </div>
    </div>
  );

  const nextStep = STATUS_FLOW[booking.status];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>→</span>
            <Link href="/service/bookings" className="hover:text-[#FF6B2C]">{t('bookings.title')}</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">#{booking.id}</span>
          </nav>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">{booking.customer_name || t('bookings.title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{booking.vehicle_name} · {SERVICE_TYPE_LABELS[booking.service_type]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${BOOKING_STATUS_COLORS[booking.status]}`}>
                {t(`bookingStatus.${booking.status}` as Parameters<typeof t>[0])}
              </span>
              {nextStep && booking.status !== 'cancelled' && (
                <button
                  onClick={() => updateStatus(nextStep.next)}
                  disabled={updating}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors disabled:opacity-50 ${nextStep.color}`}
                >
                  {updating ? '...' : nextStep.label}
                </button>
              )}
              {!booking.work_order_id && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                <button
                  onClick={convertToWorkOrder}
                  disabled={updating}
                  className="px-4 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {t('bookingDetail.actions.createOrder')}
                </button>
              )}
              {booking.work_order_id && (
                <Link href={`/service/orders/${booking.work_order_id}`}
                  className="px-4 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors">
                  {t('bookingDetail.actions.openOrder', { id: booking.work_order_id })}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('bookingDetail.sections.customer')}</h2>
            <InfoRow label={t('bookingDetail.fields.name')}    value={booking.customer_name} />
            <InfoRow label={t('bookingDetail.fields.phone')}   value={booking.customer_phone} />
            <InfoRow label={t('bookingDetail.fields.email')}   value={booking.customer_email} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('bookingDetail.sections.vehicle')}</h2>
            <InfoRow label={t('bookingDetail.fields.model')}  value={booking.vehicle_name} />
            <InfoRow label={t('bookingDetail.fields.regNr')}  value={booking.plate} />
            <InfoRow label={t('bookingDetail.fields.vin')}    value={booking.vin} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('bookingDetail.sections.appointment')}</h2>
            <InfoRow label={t('bookingDetail.fields.date')}      value={new Date(booking.scheduled_at).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
            <InfoRow label={t('bookingDetail.fields.time')}      value={`${t('common.at')} ${new Date(booking.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`} />
            <InfoRow label={t('bookingDetail.fields.duration')}  value={t('bookingDetail.values.minutes', { n: booking.duration_min })} />
            <InfoRow label={t('bookingDetail.fields.technician')}value={booking.assigned_tech || t('bookingDetail.values.notAssigned')} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('bookingDetail.sections.service')}</h2>
            <InfoRow label={t('bookingDetail.fields.type')} value={SERVICE_TYPE_LABELS[booking.service_type]} />
            {booking.description && (
              <div>
                <p className="text-[10px] text-slate-400 mb-1">{t('bookingDetail.fields.description')}</p>
                <p className="text-xs text-slate-700 leading-relaxed">{booking.description}</p>
              </div>
            )}
            {booking.notes && (
              <div>
                <p className="text-[10px] text-slate-400 mb-1">{t('bookingDetail.fields.notes')}</p>
                <p className="text-xs text-slate-700 leading-relaxed">{booking.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return value ? (
    <div className="flex items-start justify-between gap-4">
      <p className="text-[10px] text-slate-400 shrink-0">{label}</p>
      <p className="text-xs text-slate-700 font-medium text-right">{value}</p>
    </div>
  ) : null;
}
