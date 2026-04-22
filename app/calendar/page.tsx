'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApptType   = 'test_drive' | 'meeting' | 'delivery' | 'viewing';
type ApptStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
type ViewMode   = 'month' | 'week';

interface Appointment {
  id:            number;
  lead_id:       number | null;
  customer_id:   number | null;
  type:          ApptType;
  title:         string | null;
  notes:         string | null;
  start_time:    string;
  end_time:      string;
  staff_name:    string | null;
  customer_name: string | null;
  bike_name:     string | null;
  status:        ApptStatus;
  created_by:    string | null;
  created_at:    string;
}

// ─── Static config ───────────────────────────────────────────────────────────

const TYPE_COLOR: Record<ApptType, string> = {
  test_drive: '#8b5cf6', meeting: '#3b82f6', delivery: '#10b981', viewing: '#FF6B2C',
};
const TYPE_BG: Record<ApptType, string> = {
  test_drive: 'bg-purple-50 border-purple-200', meeting: 'bg-blue-50 border-blue-200',
  delivery: 'bg-emerald-50 border-emerald-200', viewing: 'bg-orange-50 border-orange-200',
};
const TYPE_DOT: Record<ApptType, string> = {
  test_drive: 'bg-purple-500', meeting: 'bg-blue-500', delivery: 'bg-emerald-500', viewing: 'bg-orange-500',
};
const TYPE_ICON: Record<ApptType, string> = {
  test_drive: '🏍', meeting: '🤝', delivery: '📦', viewing: '👀',
};
const STATUS_BADGE: Record<ApptStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700', confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',   completed: 'bg-slate-100 text-slate-600',
};
const APPT_TYPES: ApptType[]   = ['test_drive', 'meeting', 'delivery', 'viewing'];
const APPT_STATUSES: ApptStatus[] = ['scheduled', 'confirmed', 'cancelled', 'completed'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date), day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addDays(date: Date, days: number): Date { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addMonths(date: Date, n: number): Date { return new Date(date.getFullYear(), date.getMonth() + n, 1); }
function fmtTime(iso: string): string { return new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }); }
function isSameDay(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function apptHour(iso: string): number { return new Date(iso).getHours() + new Date(iso).getMinutes() / 60; }
function apptDuration(start: string, end: string): number { return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000; }
function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtLocal(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function buildMonthGrid(month: Date): Date[] { const first = startOfMonth(month), gridStart = startOfWeek(first); return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)); }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const t      = useTranslations('calendar');
  const locale = useLocale();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [viewMode,     setViewMode]     = useState<ViewMode>('month');
  const [monthStart,   setMonthStart]   = useState(() => startOfMonth(new Date()));
  const [weekStart,    setWeekStart]    = useState(() => startOfWeek(new Date()));
  const [showModal,    setShowModal]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [selected,     setSelected]     = useState<Appointment | null>(null);
  const [dayPopup,     setDayPopup]     = useState<{ date: Date; appts: Appointment[] } | null>(null);
  const [user,         setUser]         = useState<{ name?: string; dealershipId?: string } | null>(null);

  const [mType,     setMType]     = useState<ApptType>('test_drive');
  const [mTitle,    setMTitle]    = useState('');
  const [mCustomer, setMCustomer] = useState('');
  const [mBike,     setMBike]     = useState('');
  const [mStaff,    setMStaff]    = useState('');
  const [mStart,    setMStart]    = useState('');
  const [mEnd,      setMEnd]      = useState('');
  const [mNotes,    setMNotes]    = useState('');

  const [inventory,    setInventory]    = useState<{ id: number; name: string }[]>([]);
  const [bikeSearch,   setBikeSearch]   = useState('');
  const [showBikeList, setShowBikeList] = useState(false);

  const dealershipId = user?.dealershipId ?? getDealershipId() ?? '';

  // Locale-aware day/month names via Intl
  const weekDaysShort = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i); // Monday Jan 1 2024
    return d.toLocaleDateString(locale, { weekday: 'short' });
  });
  const monthNames = Array.from({ length: 12 }, (_, i) => {
    return new Date(2024, i, 1).toLocaleDateString(locale, { month: 'long' });
  });

  const load = useCallback(async (did: string, from: Date, to: Date) => {
    setLoading(true);
    const f = from.toISOString().slice(0, 10), tStr = to.toISOString().slice(0, 10);
    const res = await fetch(`/api/appointments?dealershipId=${encodeURIComponent(did)}&from=${f}&to=${tStr}`);
    if (res.ok) {
      const json = await res.json() as { appointments: Appointment[] };
      setAppointments(json.appointments);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { name?: string; dealershipId?: string };
    setUser(u);
    const did = u.dealershipId ?? getDealershipId() ?? '';
    if (did) { const grid = buildMonthGrid(monthStart); load(did, grid[0], grid[41]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, load]);

  useEffect(() => {
    if (!dealershipId) return;
    if (viewMode === 'month') { const grid = buildMonthGrid(monthStart); load(dealershipId, grid[0], grid[41]); }
    else { load(dealershipId, weekStart, addDays(weekStart, 6)); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, weekStart, viewMode]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!mStart || !mEnd) { toast.error(t('toast.timesRequired')); return; }
    setSaving(true);
    const res = await fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, type: mType, title: mTitle.trim() || t(`types.${mType}`), customerName: mCustomer.trim() || null, bikeName: mBike.trim() || null, staffName: mStaff.trim() || user?.name || null, startTime: new Date(mStart).toISOString(), endTime: new Date(mEnd).toISOString(), notes: mNotes.trim() || null, createdBy: user?.name ?? null }),
    });
    if (res.ok) {
      const json = await res.json() as { appointment: Appointment };
      setAppointments(prev => [...prev, json.appointment]);
      toast.success(t('toast.created'));
      setShowModal(false); resetModal();
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast.error(res.status === 409 ? t('toast.conflict', { error: err.error ?? '' }) : err.error ?? '');
    }
    setSaving(false);
  }

  async function updateStatus(id: number, status: ApptStatus) {
    const res = await fetch(`/api/appointments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealershipId, status }) });
    if (res.ok) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
      toast.success(t('toast.updated'));
    }
  }

  async function deleteAppt(id: number) {
    const res = await fetch(`/api/appointments/${id}?dealershipId=${encodeURIComponent(dealershipId)}`, { method: 'DELETE' });
    if (res.ok) { setAppointments(prev => prev.filter(a => a.id !== id)); setSelected(null); toast.success(t('toast.deleted')); }
  }

  function resetModal() {
    setMType('test_drive'); setMTitle(''); setMCustomer(''); setMBike(''); setMStaff(''); setMStart(''); setMEnd(''); setMNotes('');
    setBikeSearch(''); setShowBikeList(false);
  }

  async function openNewModal(defaultStart?: Date) {
    resetModal();
    if (defaultStart) { const s = new Date(defaultStart), e = new Date(s); e.setHours(s.getHours() + 1); setMStart(fmtLocal(s)); setMEnd(fmtLocal(e)); }
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) as { name?: string; dealershipId?: string } : null;
    if (u?.name) setMStaff(u.name);
    const did = u?.dealershipId ?? getDealershipId() ?? '';
    if (did && inventory.length === 0) {
      const res = await fetch(`/api/inventory/list?dealershipId=${encodeURIComponent(did)}`);
      if (res.ok) { const data = await res.json() as { id: number; name: string }[]; setInventory(data); }
    }
    setShowModal(true);
  }

  function goToday() { const now = new Date(); setMonthStart(startOfMonth(now)); setWeekStart(startOfWeek(now)); }
  function navPrev() { if (viewMode === 'month') setMonthStart(prev => addMonths(prev, -1)); else setWeekStart(prev => addDays(prev, -7)); }
  function navNext() { if (viewMode === 'month') setMonthStart(prev => addMonths(prev, 1));  else setWeekStart(prev => addDays(prev, 7));  }

  const today    = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthGrid = buildMonthGrid(monthStart);

  const headerLabel = viewMode === 'month'
    ? `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`
    : `${weekDays[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  function fmtDay(date: Date): string { return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }); }

  function renderMonthView() {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="min-w-[700px] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {weekDaysShort.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{ gridTemplateRows: 'repeat(6, minmax(110px, 1fr))' }}>
            {monthGrid.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === monthStart.getMonth();
              const isToday        = isSameDay(day, today);
              const dayAppts       = appointments.filter(a => isSameDay(new Date(a.start_time), day) && a.status !== 'cancelled');
              const visible = dayAppts.slice(0, 3);
              const overflow = dayAppts.length - 3;
              return (
                <div key={idx}
                  className={`border-b border-r border-slate-100 p-1.5 flex flex-col min-h-[110px] cursor-pointer group transition-colors hover:bg-slate-50/80 ${!isCurrentMonth ? 'bg-slate-50/50' : ''} ${isToday ? 'bg-orange-50/60' : ''}`}
                  onClick={() => openNewModal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0))}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${isToday ? 'bg-[#FF6B2C] text-white' : isCurrentMonth ? 'text-slate-800 group-hover:bg-slate-200' : 'text-slate-300'}`}>
                      {day.getDate()}
                    </span>
                    {dayAppts.length > 0 && <span className="text-[10px] text-slate-400 font-medium">{dayAppts.length} {t('bookingsCount')}</span>}
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1">
                    {visible.map(a => {
                      const color = TYPE_COLOR[a.type] ?? '#64748b';
                      return (
                        <button key={a.id} onClick={e => { e.stopPropagation(); setSelected(a); }}
                          className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold truncate transition-opacity hover:opacity-75"
                          style={{ background: color + '18', color, borderLeft: `2.5px solid ${color}` }}
                          title={`${a.title ?? t(`types.${a.type}`)}${a.customer_name ? ` · ${a.customer_name}` : ''}`}>
                          <span className="shrink-0 text-[10px]">{TYPE_ICON[a.type]}</span>
                          <span className="truncate">{a.title ?? t(`types.${a.type}`)}</span>
                          <span className="shrink-0 text-[10px] opacity-70 ml-auto">{fmtTime(a.start_time)}</span>
                        </button>
                      );
                    })}
                    {overflow > 0 && (
                      <button onClick={e => { e.stopPropagation(); setDayPopup({ date: day, appts: dayAppts }); }}
                        className="text-[11px] text-slate-400 hover:text-[#FF6B2C] font-semibold px-1.5 py-0.5 text-left transition-colors">
                        {t('more', { n: overflow })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderWeekView() {
    return (
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="min-w-[700px]">
            <div className="grid grid-cols-8 border-b border-slate-200 bg-white sticky top-0 z-10">
              <div className="py-3 px-2 text-xs text-slate-400 text-right" />
              {weekDays.map((day, i) => (
                <div key={i} onClick={() => openNewModal(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0))}
                  className={`py-3 px-2 text-center cursor-pointer hover:bg-slate-50 transition-colors border-l border-slate-100 ${isSameDay(day, today) ? 'bg-orange-50' : ''}`}>
                  <p className="text-xs font-semibold text-slate-500">{weekDaysShort[i]}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isSameDay(day, today) ? 'text-[#FF6B2C]' : 'text-slate-800'}`}>{day.getDate()}</p>
                </div>
              ))}
            </div>
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b border-slate-100 min-h-[56px]">
                <div className="px-2 py-1 text-right text-xs text-slate-300 font-mono pt-1">{String(hour).padStart(2, '0')}:00</div>
                {weekDays.map((day, di) => {
                  const appts = appointments.filter(a => isSameDay(new Date(a.start_time), day) && Math.floor(apptHour(a.start_time)) === hour && a.status !== 'cancelled');
                  return (
                    <div key={di} className={`border-l border-slate-100 px-1 py-0.5 hover:bg-slate-50/50 cursor-pointer transition-colors ${isSameDay(day, today) ? 'bg-orange-50/30' : ''}`}
                      onClick={() => { if (!appts.length) { const s = new Date(day); s.setHours(hour, 0, 0, 0); openNewModal(s); } }}>
                      {appts.map(a => {
                        const dur = Math.max(apptDuration(a.start_time, a.end_time), 0.5);
                        return (
                          <button key={a.id} onClick={e => { e.stopPropagation(); setSelected(a); }}
                            className={`w-full text-left rounded-lg px-2 py-1 border text-xs font-semibold mb-0.5 transition-all hover:opacity-80 ${TYPE_BG[a.type]}`}
                            style={{ minHeight: `${Math.min(dur * 52, 100)}px`, borderLeftColor: TYPE_COLOR[a.type], borderLeftWidth: 3 }}>
                            <div className="flex items-center gap-1 truncate">
                              <span>{TYPE_ICON[a.type]}</span>
                              <span className="truncate" style={{ color: TYPE_COLOR[a.type] }}>{a.title ?? t(`types.${a.type}`)}</span>
                            </div>
                            {a.customer_name && <p className="text-slate-500 truncate mt-0.5">{a.customer_name}</p>}
                            <p className="text-slate-400 mt-0.5">{fmtTime(a.start_time)}</p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-6 md:px-8 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={navPrev} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 font-bold transition-colors text-lg">‹</button>
            <div className="min-w-[200px] text-center">
              <h1 className="text-lg font-extrabold text-slate-900">{headerLabel}</h1>
            </div>
            <button onClick={navNext} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 font-bold transition-colors text-lg">›</button>
            <button onClick={goToday} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
              {t('today')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
              <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 transition-colors ${viewMode === 'month' ? 'bg-[#FF6B2C] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{t('month')}</button>
              <button onClick={() => setViewMode('week')}  className={`px-3 py-1.5 border-l border-slate-200 transition-colors ${viewMode === 'week' ? 'bg-[#FF6B2C] text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{t('week')}</button>
            </div>
            <button onClick={() => openNewModal()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm">
              <span className="text-lg leading-none">+</span> {t('newBooking')}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 md:px-8 py-2 bg-white border-b border-slate-100 flex gap-4 flex-wrap">
          {APPT_TYPES.map(type => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2 h-2 rounded-full ${TYPE_DOT[type]}`} />
              {TYPE_ICON[type]} {t(`types.${type}`)}
            </div>
          ))}
          {loading && <div className="ml-auto w-4 h-4 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />}
        </div>

        {viewMode === 'month' ? renderMonthView() : renderWeekView()}
      </div>

      {/* New booking modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 text-lg">{t('modal.title')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">{t('modal.bookingType')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {APPT_TYPES.map(type => (
                    <button key={type} type="button" onClick={() => setMType(type)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-semibold text-left transition-colors ${mType === type ? `${TYPE_BG[type]} border-current` : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      style={mType === type ? { color: TYPE_COLOR[type] } : {}}>
                      {TYPE_ICON[type]} {t(`types.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.optionalTitle')}</label>
                <input value={mTitle} onChange={e => setMTitle(e.target.value)} placeholder={t(`types.${mType}`) + '...'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.startTime')}</label>
                  <input type="datetime-local" value={mStart} required
                    onChange={e => { setMStart(e.target.value); if (!mEnd) { const d = new Date(e.target.value); d.setHours(d.getHours() + 1); setMEnd(fmtLocal(d)); } }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.endTime')}</label>
                  <input type="datetime-local" value={mEnd} required onChange={e => setMEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.customer')}</label>
                  <input value={mCustomer} onChange={e => setMCustomer(e.target.value)} placeholder="Namn..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.staff')}</label>
                  <input value={mStaff} readOnly className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none cursor-default" />
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.vehicle')}</label>
                <input value={mBike || bikeSearch}
                  onChange={e => { setBikeSearch(e.target.value); setMBike(''); setShowBikeList(true); }}
                  onFocus={() => setShowBikeList(true)}
                  placeholder={t('modal.vehicleSearch')} autoComplete="off"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none" />
                {showBikeList && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {inventory.filter(v => v.name.toLowerCase().includes((bikeSearch || mBike).toLowerCase())).length === 0
                      ? <div className="px-4 py-3 text-xs text-slate-400">{t('noVehicles')}</div>
                      : inventory.filter(v => v.name.toLowerCase().includes((bikeSearch || mBike).toLowerCase())).map(v => (
                          <button key={v.id} type="button" onMouseDown={() => { setMBike(v.name); setBikeSearch(''); setShowBikeList(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-[#FF6B2C] transition-colors">{v.name}</button>
                        ))
                    }
                  </div>
                )}
                {mBike && <button type="button" onClick={() => { setMBike(''); setBikeSearch(''); }} className="absolute right-3 top-9 text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('modal.notes')}</label>
                <textarea value={mNotes} onChange={e => setMNotes(e.target.value)} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#FF6B2C] outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  {t('modal.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : t('modal.book')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day overflow popup */}
      {dayPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">
                {dayPopup.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => setDayPopup(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-2">
              {dayPopup.appts.map(a => (
                <button key={a.id} onClick={() => { setDayPopup(null); setSelected(a); }}
                  className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border hover:border-[#FF6B2C]/40 hover:bg-orange-50/30 transition-colors"
                  style={{ borderColor: TYPE_COLOR[a.type] + '40' }}>
                  <span className="text-xl">{TYPE_ICON[a.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: TYPE_COLOR[a.type] }}>{a.title ?? t(`types.${a.type}`)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtTime(a.start_time)} – {fmtTime(a.end_time)}{a.customer_name ? ` · ${a.customer_name}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[a.status]}`}>{t(`statuses.${a.status}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appointment detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-sm shadow-2xl flex flex-col p-6 overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{TYPE_ICON[selected.type]}</span>
                <div>
                  <h3 className="font-bold text-slate-900">{selected.title ?? t(`types.${selected.type}`)}</h3>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[selected.status]}`}>{t(`statuses.${selected.status}`)}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><span>🕐</span><span>{fmtDay(new Date(selected.start_time))} · {fmtTime(selected.start_time)} – {fmtTime(selected.end_time)}</span></div>
              {selected.customer_name && <div className="flex items-center gap-2 text-slate-600"><span>👤</span><span>{selected.customer_name}</span></div>}
              {selected.staff_name    && <div className="flex items-center gap-2 text-slate-600"><span>🧑‍💼</span><span>{selected.staff_name}</span></div>}
              {selected.bike_name     && <div className="flex items-center gap-2 text-slate-600"><span>🏍</span><span>{selected.bike_name}</span></div>}
              {selected.notes         && <div className="flex items-start gap-2 text-slate-600"><span>📝</span><span className="whitespace-pre-wrap">{selected.notes}</span></div>}
              {selected.lead_id       && (
                <Link href={`/sales/leads/${selected.lead_id}`} className="flex items-center gap-2 text-[#FF6B2C] font-semibold hover:underline">
                  <span>🔗</span> Lead #{selected.lead_id} →
                </Link>
              )}
            </div>

            {selected.status !== 'cancelled' && selected.status !== 'completed' && (
              <div className="mt-6 flex flex-col gap-2">
                {selected.status === 'scheduled' && (
                  <button onClick={() => updateStatus(selected.id, 'confirmed')} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                    {t('detail.confirm')}
                  </button>
                )}
                <button onClick={() => updateStatus(selected.id, 'completed')} className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition-colors">
                  {t('detail.markDone')}
                </button>
                <button onClick={() => updateStatus(selected.id, 'cancelled')} className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors">
                  {t('detail.cancel')}
                </button>
              </div>
            )}

            <button onClick={() => deleteAppt(selected.id)} className="mt-4 w-full py-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 text-xs font-semibold transition-colors">
              {t('detail.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
