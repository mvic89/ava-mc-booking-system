'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { useAutoRefresh } from '@/lib/realtime';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Technician {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface Booking {
  id: number;
  customer_name: string;
  vehicle_name: string;
  plate: string;
  service_type: string;
  description: string;
  scheduled_at: string;
  duration_min: number;
  assigned_tech: string;
  status: 'booked' | 'confirmed' | 'in_progress' | 'done' | 'cancelled' | 'no_show';
  notes: string;
  work_order_id: number | null;
}

interface OpenOrder {
  id: number;
  customer_name: string;
  vehicle_name: string;
  plate: string;
  assigned_tech: string;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  description: string;
  created_at: string;
  total_cost: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const START_HOUR = 7;
const END_HOUR   = 19;
const SLOT_MIN   = 30;
const SLOT_PX    = 56;
const TECH_COL_W = 180;

const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MIN;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  booked:      { bg: 'bg-blue-50',    border: 'border-blue-300',   text: 'text-blue-800',    dot: 'bg-blue-400' },
  confirmed:   { bg: 'bg-indigo-50',  border: 'border-indigo-300', text: 'text-indigo-800',  dot: 'bg-indigo-500' },
  in_progress: { bg: 'bg-amber-50',   border: 'border-amber-400',  text: 'text-amber-800',   dot: 'bg-amber-400' },
  done:        { bg: 'bg-emerald-50', border: 'border-emerald-300',text: 'text-emerald-800', dot: 'bg-emerald-500' },
  cancelled:   { bg: 'bg-slate-50',   border: 'border-slate-200',  text: 'text-slate-400',   dot: 'bg-slate-300' },
  no_show:     { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-600',     dot: 'bg-red-400' },
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border border-red-200',
  high:   'bg-orange-100 text-orange-700 border border-orange-200',
  normal: 'bg-slate-100 text-slate-600 border border-slate-200',
  low:    'bg-green-50 text-green-700 border border-green-200',
};

const SERVICE_TYPE_ICON: Record<string, string> = {
  maintenance:  '🔧',
  repair:       '🛠️',
  inspection:   '🔍',
  recall:       '⚠️',
  other:        '📋',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  r.setDate(r.getDate() + diff);
  return r;
}

function minutesSinceMidnight(isoStr: string) {
  const d = new Date(isoStr);
  return d.getHours() * 60 + d.getMinutes();
}

function topPx(isoStr: string) {
  const mins = minutesSinceMidnight(isoStr);
  const minsFromStart = mins - START_HOUR * 60;
  return Math.max(0, (minsFromStart / SLOT_MIN) * SLOT_PX);
}

function heightPx(durationMin: number) {
  return Math.max(SLOT_PX * 0.75, (durationMin / SLOT_MIN) * SLOT_PX - 2);
}

function fmtTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' });
}

function fmtDateShort(d: Date) {
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric' });
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-teal-500',
    'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onClick,
  compact = false,
}: {
  booking: Booking;
  onClick: (b: Booking) => void;
  compact?: boolean;
}) {
  const colors = STATUS_COLORS[booking.status] ?? STATUS_COLORS.booked;
  const h = heightPx(booking.duration_min);
  const icon = SERVICE_TYPE_ICON[booking.service_type] ?? '📋';

  return (
    <button
      onClick={() => onClick(booking)}
      className={`
        absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1.5 text-left
        overflow-hidden cursor-pointer transition-all duration-150
        hover:shadow-md hover:scale-[1.01] active:scale-[0.99]
        ${colors.bg} ${colors.border} ${colors.text}
      `}
      style={{ height: `${h}px` }}
      title={`${booking.customer_name} · ${booking.vehicle_name || booking.plate}`}
    >
      <div className="flex items-start gap-1 h-full overflow-hidden">
        {!compact && <span className="text-[10px] shrink-0 mt-px">{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black leading-tight truncate">{booking.customer_name}</p>
          {h >= SLOT_PX && (
            <p className="text-[9px] opacity-70 truncate leading-tight">
              {booking.vehicle_name || booking.plate}
            </p>
          )}
          {h >= SLOT_PX * 1.5 && (
            <p className="text-[9px] opacity-60 truncate leading-tight mt-0.5">
              {fmtTime(booking.scheduled_at)} · {booking.duration_min} min
            </p>
          )}
        </div>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${colors.dot}`} />
      </div>
    </button>
  );
}

function TechAvatar({ tech }: { tech: Technician }) {
  const color = getAvatarColor(tech.name);
  if (tech.avatar_url) {
    return (
      <img
        src={tech.avatar_url}
        alt={tech.name}
        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow"
      />
    );
  }
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-[11px] font-black border-2 border-white shadow shrink-0`}>
      {getInitials(tech.name)}
    </div>
  );
}

function BookingDetailModal({
  booking,
  onClose,
  onStatusChange,
}: {
  booking: Booking;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => Promise<void>;
}) {
  const t = useTranslations('scheduling');
  const colors = STATUS_COLORS[booking.status] ?? STATUS_COLORS.booked;
  const icon = SERVICE_TYPE_ICON[booking.service_type] ?? '📋';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #0b1524 0%, #1a2a40 100%)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-white font-black text-base leading-tight">{booking.customer_name}</p>
                <p className="text-white/50 text-xs mt-0.5">{booking.vehicle_name || booking.plate}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none mt-0.5">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Status + time */}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}>
              {booking.status.replace('_', ' ')}
            </span>
            <p className="text-sm font-bold text-slate-700">
              {fmtTime(booking.scheduled_at)} · {booking.duration_min} min
            </p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{t('modal.tech')}</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{booking.assigned_tech || t('modal.unassigned')}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{t('modal.type')}</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5 capitalize">{booking.service_type}</p>
            </div>
          </div>

          {booking.description && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('modal.description')}</p>
              <p className="text-xs text-slate-700 leading-relaxed">{booking.description}</p>
            </div>
          )}

          {booking.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wide mb-1">{t('modal.notes')}</p>
              <p className="text-xs text-amber-800 leading-relaxed">{booking.notes}</p>
            </div>
          )}

          {/* Quick status change */}
          <div>
            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('modal.changeStatus')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(['booked', 'confirmed', 'in_progress', 'done', 'no_show'] as const).map(s => (
                <button
                  key={s}
                  disabled={booking.status === s}
                  onClick={() => onStatusChange(booking.id, s)}
                  className={`
                    text-[9px] font-bold px-2.5 py-1 rounded-full transition-all
                    ${booking.status === s
                      ? `${STATUS_COLORS[s].bg} ${STATUS_COLORS[s].text} ${STATUS_COLORS[s].border} border opacity-60 cursor-default`
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }
                  `}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-2">
          {booking.work_order_id && (
            <Link
              href={`/service/orders/${booking.work_order_id}`}
              className="flex-1 text-center text-xs font-bold py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {t('modal.viewWorkOrder')} →
            </Link>
          )}
          <Link
            href={`/service/bookings/${booking.id}`}
            className="flex-1 text-center text-xs font-bold py-2.5 rounded-xl text-white transition-colors"
            style={{ background: '#FF6B2C' }}
          >
            {t('modal.editBooking')}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulingPage() {
  const router = useRouter();
  const t = useTranslations('scheduling');

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [openOrders,  setOpenOrders]  = useState<OpenOrder[]>([]);
  const [ready,       setReady]       = useState(false);

  const [viewMode,   setViewMode]   = useState<'day' | 'week'>('day');
  const [currentDay, setCurrentDay] = useState(new Date());

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showBacklog,     setShowBacklog]      = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentDay);
  const weekDays  = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const from = viewMode === 'day' ? isoDateStr(currentDay) : isoDateStr(weekStart);
  const to   = viewMode === 'day' ? isoDateStr(currentDay) : isoDateStr(weekDays[4]);

  const load = useCallback(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const res = await fetch(
      `/api/service/scheduling?dealershipId=${dealershipId}&from=${from}&to=${to}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setTechnicians(data.technicians ?? []);
    setBookings(data.bookings ?? []);
    setOpenOrders(data.orders ?? []);
    setReady(true);
  }, [from, to]);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    void load();
  }, [router, load]);

  useAutoRefresh(() => { void load(); });

  // Scroll to current time on mount
  useEffect(() => {
    if (!ready || !scrollRef.current) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const offset = ((mins - START_HOUR * 60) / SLOT_MIN) * SLOT_PX;
    scrollRef.current.scrollTop = Math.max(0, offset - 80);
  }, [ready]);

  const handleStatusChange = async (bookingId: number, status: string) => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const res = await fetch(`/api/service/scheduling`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, bookingId, status }),
    });
    if (res.ok) {
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: status as Booking['status'] } : b));
      setSelectedBooking(prev => prev?.id === bookingId ? { ...prev, status: status as Booking['status'] } : prev);
      toast.success(t('statusUpdated'));
    } else {
      toast.error(t('statusError'));
    }
  };

  // Day view helpers
  const dayBookingsForTech = (tech: Technician) =>
    bookings.filter(b => {
      const sameDay = b.scheduled_at.startsWith(isoDateStr(currentDay));
      const assigned = b.assigned_tech === tech.name || b.assigned_tech === tech.id;
      return sameDay && assigned;
    });

  const unassignedDayBookings = bookings.filter(b => {
    const sameDay = b.scheduled_at.startsWith(isoDateStr(currentDay));
    return sameDay && !b.assigned_tech;
  });

  // Week view helpers
  const weekBookingsForTechAndDay = (tech: Technician, day: Date) =>
    bookings.filter(b => {
      const sameDay = b.scheduled_at.startsWith(isoDateStr(day));
      const assigned = b.assigned_tech === tech.name || b.assigned_tech === tech.id;
      return sameDay && assigned;
    });

  // Tech load (% capacity used for the day)
  const techLoadPct = (tech: Technician) => {
    const mins = dayBookingsForTech(tech).reduce((s, b) => s + b.duration_min, 0);
    const capacity = (END_HOUR - START_HOUR) * 60;
    return Math.min(100, Math.round((mins / capacity) * 100));
  };

  const isToday = isoDateStr(currentDay) === isoDateStr(new Date());

  // Current time indicator position
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const nowTop  = ((nowMins - START_HOUR * 60) / SLOT_MIN) * SLOT_PX;
  const showNow = isToday && nowMins >= START_HOUR * 60 && nowMins <= END_HOUR * 60;

  // Time slots
  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const totalMins = START_HOUR * 60 + i * SLOT_MIN;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });

  const totalSlotHeight = TOTAL_SLOTS * SLOT_PX;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="brand-top-bar" />

        {/* Header */}
        <div
          className="px-5 md:px-8 py-5 relative overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(135deg, #0b1524 0%, #1a2a40 60%, #0f3460 100%)' }}
        >
          <div className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full border border-white/5" />
          <nav className="flex items-center gap-1.5 text-xs text-white/40 mb-3">
            <Link href="/dashboard" className="hover:text-white/70">Dashboard</Link>
            <span>›</span>
            <Link href="/service" className="hover:text-white/70">Service</Link>
            <span>›</span>
            <span className="text-white/70 font-medium">{t('title')}</span>
          </nav>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h1 className="text-xl font-black text-white">{t('title')}</h1>
                <p className="text-xs text-white/50">{t('subtitle')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* View toggle */}
              <div className="flex items-center bg-white/10 rounded-xl p-1">
                {(['day', 'week'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === mode
                        ? 'bg-white text-slate-900'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {t(`view.${mode}`)}
                  </button>
                ))}
              </div>

              {/* Date navigation */}
              <div className="flex items-center bg-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => setCurrentDay(d => addDays(d, viewMode === 'day' ? -1 : -7))}
                  className="px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors"
                >
                  ‹
                </button>
                <button
                  onClick={() => setCurrentDay(new Date())}
                  className="px-3 py-2 text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {viewMode === 'day'
                    ? fmtDate(currentDay)
                    : `v. ${(() => {
                        const d = new Date(weekStart);
                        const jan4 = new Date(d.getFullYear(), 0, 4);
                        const weekNum = Math.ceil((((d.getTime() - jan4.getTime()) / 86400000) + jan4.getDay() + 1) / 7);
                        return weekNum;
                      })()}`
                  }
                </button>
                <button
                  onClick={() => setCurrentDay(d => addDays(d, viewMode === 'day' ? 1 : 7))}
                  className="px-3 py-2 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors"
                >
                  ›
                </button>
              </div>

              {/* Today button */}
              {!isToday && (
                <button
                  onClick={() => setCurrentDay(new Date())}
                  className="px-3 py-2 text-xs font-bold text-white/70 hover:text-white bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                >
                  {t('today')}
                </button>
              )}

              {/* New booking */}
              <Link
                href="/service/bookings/new"
                className="px-3 py-2 rounded-xl text-white text-xs font-bold transition-colors"
                style={{ background: '#FF6B2C' }}
              >
                + {t('newBooking')}
              </Link>

              {/* Backlog toggle */}
              <button
                onClick={() => setShowBacklog(s => !s)}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                  showBacklog ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 hover:text-white'
                }`}
              >
                {t('backlog')} {openOrders.length > 0 && `(${openOrders.length})`}
              </button>
            </div>
          </div>

          {/* Tech capacity bar */}
          {ready && viewMode === 'day' && technicians.length > 0 && (
            <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-1">
              {technicians.map(tech => {
                const pct = techLoadPct(tech);
                const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#10b981';
                return (
                  <div key={tech.id} className="flex items-center gap-2 shrink-0">
                    <TechAvatar tech={tech} />
                    <div className="w-24">
                      <p className="text-[9px] text-white/50 font-semibold truncate">{tech.name.split(' ')[0]}</p>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <p className="text-[8px] text-white/30 mt-0.5">{pct}% {t('capacity')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">

          {/* Calendar grid */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {viewMode === 'day' ? (
              /* ─── DAY VIEW ─── */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tech column headers */}
                <div
                  className="flex border-b border-slate-200 bg-white shrink-0 z-10"
                  style={{ paddingLeft: '52px' }}
                >
                  {/* Unassigned column header */}
                  {unassignedDayBookings.length > 0 && (
                    <div
                      className="shrink-0 py-3 px-3 flex flex-col items-center justify-center border-r border-slate-100"
                      style={{ width: TECH_COL_W }}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold border-2 border-white shadow">
                        ?
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 mt-1">{t('unassigned')}</p>
                      <p className="text-[9px] text-slate-400">{unassignedDayBookings.length} {t('bookingsCount')}</p>
                    </div>
                  )}
                  {technicians.map(tech => {
                    const techBookings = dayBookingsForTech(tech);
                    const pct = techLoadPct(tech);
                    return (
                      <div
                        key={tech.id}
                        className="shrink-0 py-3 px-3 flex flex-col items-center justify-center border-r border-slate-100"
                        style={{ width: TECH_COL_W }}
                      >
                        <TechAvatar tech={tech} />
                        <p className="text-[10px] font-black text-slate-800 mt-1 truncate max-w-full px-1">{tech.name}</p>
                        <p className="text-[9px] text-slate-400">{techBookings.length} {t('bookingsCount')}</p>
                        {/* Mini load indicator */}
                        <div className="w-full mt-1.5 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#10b981',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {technicians.length === 0 && ready && (
                    <div className="flex-1 py-3 flex items-center justify-center">
                      <p className="text-xs text-slate-400">{t('noTechnicians')}</p>
                    </div>
                  )}
                </div>

                {/* Scrollable grid */}
                <div ref={scrollRef} className="flex-1 overflow-auto">
                  <div className="flex" style={{ height: `${totalSlotHeight}px` }}>
                    {/* Time gutter */}
                    <div className="w-13 shrink-0 relative" style={{ width: '52px' }}>
                      {timeSlots.map((slot, i) => (
                        <div
                          key={slot}
                          className="absolute right-0 flex items-start pr-2"
                          style={{ top: i * SLOT_PX, height: SLOT_PX }}
                        >
                          {i % 2 === 0 && (
                            <span className="text-[9px] font-semibold text-slate-400 -translate-y-1.5">{slot}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Unassigned column */}
                    {unassignedDayBookings.length > 0 && (
                      <div
                        className="shrink-0 relative border-r border-slate-100"
                        style={{ width: TECH_COL_W, height: totalSlotHeight }}
                      >
                        {/* Hour lines */}
                        {timeSlots.map((slot, i) => (
                          <div
                            key={slot}
                            className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                            style={{ top: i * SLOT_PX }}
                          />
                        ))}
                        {/* Booking cards */}
                        {unassignedDayBookings.map(b => (
                          <div key={b.id} className="absolute left-0 right-0" style={{ top: topPx(b.scheduled_at) }}>
                            <BookingCard booking={b} onClick={setSelectedBooking} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tech columns */}
                    {technicians.map(tech => {
                      const techBookings = dayBookingsForTech(tech);
                      return (
                        <div
                          key={tech.id}
                          className="shrink-0 relative border-r border-slate-100"
                          style={{ width: TECH_COL_W, height: totalSlotHeight }}
                        >
                          {/* Grid lines */}
                          {timeSlots.map((_, i) => (
                            <div
                              key={i}
                              className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                              style={{ top: i * SLOT_PX }}
                            />
                          ))}
                          {/* Current time line */}
                          {showNow && (
                            <div
                              className="absolute left-0 right-0 z-20 pointer-events-none"
                              style={{ top: nowTop }}
                            >
                              <div className="relative">
                                <div className="absolute -left-1 w-2 h-2 rounded-full bg-red-500 -translate-y-1" />
                                <div className="border-t-2 border-red-400 border-dashed" />
                              </div>
                            </div>
                          )}
                          {/* Booking cards */}
                          {techBookings.map(b => (
                            <div key={b.id} className="absolute left-0 right-0" style={{ top: topPx(b.scheduled_at) }}>
                              <BookingCard booking={b} onClick={setSelectedBooking} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ─── WEEK VIEW ─── */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Day headers */}
                <div className="flex border-b border-slate-200 bg-white shrink-0 z-10" style={{ paddingLeft: '52px' }}>
                  {weekDays.map(day => {
                    const isCurrentDay = isoDateStr(day) === isoDateStr(new Date());
                    const dayBookings = bookings.filter(b => b.scheduled_at.startsWith(isoDateStr(day)));
                    return (
                      <div
                        key={isoDateStr(day)}
                        className={`flex-1 py-3 px-3 text-center border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                          isCurrentDay ? 'bg-orange-50' : ''
                        }`}
                        onClick={() => { setCurrentDay(day); setViewMode('day'); }}
                      >
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${isCurrentDay ? 'text-[#FF6B2C]' : 'text-slate-400'}`}>
                          {fmtDateShort(day)}
                        </p>
                        {dayBookings.length > 0 && (
                          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isCurrentDay ? 'bg-[#FF6B2C] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {dayBookings.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Week grid */}
                <div ref={scrollRef} className="flex-1 overflow-auto">
                  <div className="flex" style={{ height: `${totalSlotHeight}px` }}>
                    {/* Time gutter */}
                    <div className="shrink-0 relative" style={{ width: '52px' }}>
                      {timeSlots.map((slot, i) => (
                        <div
                          key={slot}
                          className="absolute right-0 flex items-start pr-2"
                          style={{ top: i * SLOT_PX, height: SLOT_PX }}
                        >
                          {i % 2 === 0 && (
                            <span className="text-[9px] font-semibold text-slate-400 -translate-y-1.5">{slot}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Day columns */}
                    {weekDays.map(day => {
                      const isCurrentDay = isoDateStr(day) === isoDateStr(new Date());
                      const dayBookings = bookings.filter(b => b.scheduled_at.startsWith(isoDateStr(day)));
                      return (
                        <div
                          key={isoDateStr(day)}
                          className={`flex-1 relative border-r border-slate-100 ${isCurrentDay ? 'bg-orange-50/30' : ''}`}
                          style={{ height: totalSlotHeight }}
                        >
                          {/* Grid lines */}
                          {timeSlots.map((_, i) => (
                            <div
                              key={i}
                              className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                              style={{ top: i * SLOT_PX }}
                            />
                          ))}
                          {/* Now line */}
                          {isCurrentDay && showNow && (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                              <div className="relative">
                                <div className="absolute -left-1 w-2 h-2 rounded-full bg-red-500 -translate-y-1" />
                                <div className="border-t-2 border-red-400 border-dashed" />
                              </div>
                            </div>
                          )}
                          {/* Booking cards */}
                          {dayBookings.map(b => (
                            <div key={b.id} className="absolute left-0 right-0" style={{ top: topPx(b.scheduled_at) }}>
                              <BookingCard booking={b} onClick={setSelectedBooking} compact />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Backlog panel ─── */}
          {showBacklog && (
            <div className="w-72 shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900">{t('backlogTitle')}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t('backlogSubtitle')}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {openOrders.length}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-50 px-2 py-2 space-y-1">
                {!ready ? (
                  <div className="py-8 text-center">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin mx-auto" />
                  </div>
                ) : openOrders.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-2xl mb-2">✅</p>
                    <p className="text-xs text-slate-400 font-medium">{t('noOpenOrders')}</p>
                  </div>
                ) : (
                  openOrders.map(order => (
                    <Link
                      key={order.id}
                      href={`/service/orders/${order.id}`}
                      className="block bg-white rounded-xl border border-slate-100 hover:border-[#FF6B2C]/30 hover:shadow-sm transition-all p-3 group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[10px] font-black text-slate-400">AO-{order.id}</p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_BADGE[order.priority]}`}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B2C] transition-colors truncate">
                        {order.customer_name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {order.vehicle_name || order.plate}
                      </p>
                      {order.assigned_tech ? (
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          {order.assigned_tech}
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          {t('unassigned')}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600`}>
                          {order.status.replace('_', ' ')}
                        </span>
                        {order.total_cost > 0 && (
                          <span className="text-[10px] font-black text-slate-700">
                            {order.total_cost.toLocaleString('sv-SE')} kr
                          </span>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>

              {/* Backlog footer */}
              <div className="px-4 py-3 border-t border-slate-100 shrink-0">
                <Link
                  href="/service/orders"
                  className="block text-center text-xs font-bold text-[#FF6B2C] hover:underline"
                >
                  {t('viewAllOrders')} →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-2 flex items-center gap-6 overflow-x-auto">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">{t('legend')}</p>
          {Object.entries(STATUS_COLORS).filter(([s]) => s !== 'cancelled').map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5 shrink-0">
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className="text-[9px] font-medium text-slate-500 capitalize">{status.replace('_', ' ')}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <div className="w-6 border-t-2 border-red-400 border-dashed" />
            <span className="text-[9px] font-medium text-slate-500">{t('nowLine')}</span>
          </div>
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
