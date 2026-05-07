'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { useAutoRefresh } from '@/lib/realtime';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Reminder {
  id: number;
  dealership_id: string;
  customer_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  vehicle_name: string;
  plate: string;
  vin: string;
  interval_months: number;
  last_service_at: string | null;
  next_reminder_at: string;
  last_sent_at: string | null;
  status: 'active' | 'paused';
  notes: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now  = new Date(); now.setHours(0, 0, 0, 0);
  const then = new Date(dateStr);
  return Math.round((then.getTime() - now.getTime()) / 86400_000);
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyStyle(days: number, status: string): { badge: string; row: string } {
  if (status === 'paused') return { badge: 'bg-slate-100 text-slate-500', row: 'opacity-60' };
  if (days < 0)  return { badge: 'bg-red-100 text-red-700 border border-red-200',    row: 'bg-red-50/30' };
  if (days <= 7) return { badge: 'bg-amber-100 text-amber-700 border border-amber-200', row: 'bg-amber-50/20' };
  return { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', row: '' };
}

const INTERVAL_OPTIONS = [1, 3, 6, 12, 18, 24];

// ─── Create / Edit form ───────────────────────────────────────────────────────

interface FormData {
  customerName:   string;
  customerEmail:  string;
  customerPhone:  string;
  vehicleName:    string;
  plate:          string;
  vin:            string;
  intervalMonths: number;
  lastServiceAt:  string;
  notes:          string;
}

const EMPTY_FORM: FormData = {
  customerName: '', customerEmail: '', customerPhone: '',
  vehicleName: '', plate: '', vin: '',
  intervalMonths: 12,
  lastServiceAt: new Date().toISOString().slice(0, 10),
  notes: '',
};

function ReminderForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormData;
  onSave: (f: FormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const t = useTranslations('reminders');
  const [form, setForm] = useState<FormData>(initial);
  const set = (k: keyof FormData, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      <h3 className="text-sm font-black text-slate-900">{t('form.title')}</h3>

      {/* Customer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.customerName')} *</label>
          <input
            value={form.customerName}
            onChange={e => set('customerName', e.target.value)}
            placeholder="Anna Svensson"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B2C]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.customerEmail')}</label>
          <input
            type="email"
            value={form.customerEmail}
            onChange={e => set('customerEmail', e.target.value)}
            placeholder="anna@example.com"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B2C]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.customerPhone')}</label>
          <input
            value={form.customerPhone}
            onChange={e => set('customerPhone', e.target.value)}
            placeholder="+46 70 000 00 00"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B2C]"
          />
        </div>
      </div>

      {/* Vehicle */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.vehicleName')}</label>
          <input
            value={form.vehicleName}
            onChange={e => set('vehicleName', e.target.value)}
            placeholder="Honda CBR 1000RR"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B2C]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.plate')}</label>
          <input
            value={form.plate}
            onChange={e => set('plate', e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF6B2C] uppercase"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.vin')}</label>
          <input
            value={form.vin}
            onChange={e => set('vin', e.target.value.toUpperCase())}
            placeholder="JH2RC530..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#FF6B2C]"
          />
        </div>
      </div>

      {/* Interval + Last service */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.interval')} *</label>
          <div className="flex flex-wrap gap-2">
            {INTERVAL_OPTIONS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set('intervalMonths', m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  form.intervalMonths === m
                    ? 'bg-[#FF6B2C] text-white border-[#FF6B2C]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#FF6B2C]'
                }`}
              >
                {m === 1 ? `1 ${t('form.month')}` : `${m} ${t('form.months')}`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.lastServiceAt')}</label>
          <input
            type="date"
            value={form.lastServiceAt}
            onChange={e => set('lastServiceAt', e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF6B2C]"
          />
          <p className="text-[9px] text-slate-400 mt-1">
            {t('form.nextWillBe')}: <span className="font-bold text-slate-600">{
              (() => {
                const d = new Date(form.lastServiceAt);
                d.setMonth(d.getMonth() + form.intervalMonths);
                return d.toLocaleDateString('sv-SE');
              })()
            }</span>
          </p>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('form.notes')}</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={2}
          placeholder={t('form.notesPlaceholder')}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#FF6B2C]"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.customerName || !form.intervalMonths}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 transition-colors"
          style={{ background: '#FF6B2C' }}
        >
          {saving ? t('form.saving') : t('form.save')}
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
          {t('form.cancel')}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const router = useRouter();
  const t = useTranslations('reminders');

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ready,     setReady]     = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [filter,    setFilter]    = useState<'all' | 'active' | 'paused' | 'overdue' | 'soon'>('all');

  const load = useCallback(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const res = await fetch(`/api/service/reminders?dealershipId=${dealershipId}`);
    if (res.ok) {
      const json = await res.json() as { reminders: Reminder[] };
      setReminders(json.reminders ?? []);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    void load();
  }, [router, load]);

  useAutoRefresh(() => { void load(); });

  const handleCreate = async (form: FormData) => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/service/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, ...form, intervalMonths: form.intervalMonths }),
      });
      if (res.ok) {
        toast.success(t('toasts.created'));
        setShowForm(false);
        void load();
      } else {
        const j = await res.json() as { error: string };
        toast.error(j.error ?? t('toasts.error'));
      }
    } finally { setSaving(false); }
  };

  const handleUpdate = async (id: number, form: FormData) => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/service/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealershipId,
          customer_name:   form.customerName,
          customer_email:  form.customerEmail,
          customer_phone:  form.customerPhone,
          vehicle_name:    form.vehicleName,
          plate:           form.plate,
          vin:             form.vin,
          interval_months: form.intervalMonths,
          last_service_at: form.lastServiceAt,
          notes:           form.notes,
        }),
      });
      if (res.ok) {
        toast.success(t('toasts.updated'));
        setEditId(null);
        void load();
      } else {
        const j = await res.json() as { error: string };
        toast.error(j.error ?? t('toasts.error'));
      }
    } finally { setSaving(false); }
  };

  const handleTogglePause = async (reminder: Reminder) => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    const newStatus = reminder.status === 'active' ? 'paused' : 'active';
    const res = await fetch(`/api/service/reminders/${reminder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: newStatus }),
    });
    if (res.ok) {
      toast.success(newStatus === 'paused' ? t('toasts.paused') : t('toasts.resumed'));
      void load();
    }
  };

  const handleDelete = async (id: number) => {
    const dealershipId = getDealershipId();
    if (!dealershipId) return;
    if (!confirm(t('confirmDelete'))) return;
    const res = await fetch(`/api/service/reminders/${id}?dealershipId=${dealershipId}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success(t('toasts.deleted'));
      void load();
    }
  };

  const filtered = reminders.filter(r => {
    if (filter === 'active')  return r.status === 'active';
    if (filter === 'paused')  return r.status === 'paused';
    if (filter === 'overdue') return r.status === 'active' && daysUntil(r.next_reminder_at) < 0;
    if (filter === 'soon')    return r.status === 'active' && daysUntil(r.next_reminder_at) >= 0 && daysUntil(r.next_reminder_at) <= 7;
    return true;
  });

  const overdueCount = reminders.filter(r => r.status === 'active' && daysUntil(r.next_reminder_at) < 0).length;
  const soonCount    = reminders.filter(r => r.status === 'active' && daysUntil(r.next_reminder_at) >= 0 && daysUntil(r.next_reminder_at) <= 7).length;

  const editingReminder = editId !== null ? reminders.find(r => r.id === editId) : null;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div
          className="px-5 md:px-8 py-6 relative overflow-hidden"
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

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <h1 className="text-xl font-black text-white">{t('title')}</h1>
                <p className="text-xs text-white/50">{t('subtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => { setShowForm(true); setEditId(null); }}
              className="px-4 py-2 rounded-xl text-white text-sm font-bold shrink-0"
              style={{ background: '#FF6B2C' }}
            >
              + {t('addReminder')}
            </button>
          </div>

          {/* Stats strip */}
          {ready && (
            <div className="mt-5 flex items-center gap-6">
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('stats.total')}</p>
                <p className="text-lg font-black text-white">{reminders.length}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('stats.overdue')}</p>
                <p className={`text-lg font-black ${overdueCount > 0 ? 'text-red-400' : 'text-white'}`}>{overdueCount}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{t('stats.dueSoon')}</p>
                <p className={`text-lg font-black ${soonCount > 0 ? 'text-amber-400' : 'text-white'}`}>{soonCount}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 md:px-8 py-6 space-y-5">

          {/* Create form */}
          {showForm && !editId && (
            <ReminderForm
              initial={EMPTY_FORM}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'all',     label: t('filter.all'),     count: reminders.length },
              { key: 'overdue', label: t('filter.overdue'), count: overdueCount },
              { key: 'soon',    label: t('filter.soon'),    count: soonCount },
              { key: 'active',  label: t('filter.active'),  count: reminders.filter(r => r.status === 'active').length },
              { key: 'paused',  label: t('filter.paused'),  count: reminders.filter(r => r.status === 'paused').length },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  filter === f.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {f.label}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {!ready ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-3xl mb-3">🔔</p>
                <p className="text-sm font-bold text-slate-600">{t('empty.title')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('empty.subtitle')}</p>
                {reminders.length === 0 && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 px-4 py-2 rounded-xl text-white text-xs font-bold"
                    style={{ background: '#FF6B2C' }}
                  >
                    + {t('addReminder')}
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Header row */}
                <div className="hidden md:grid grid-cols-[1fr_1fr_100px_120px_120px_130px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
                  {[t('col.customer'), t('col.vehicle'), t('col.interval'), t('col.lastService'), t('col.nextReminder'), ''].map((h, i) => (
                    <p key={i} className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">{h}</p>
                  ))}
                </div>

                {filtered.map(reminder => {
                  const days  = daysUntil(reminder.next_reminder_at);
                  const style = urgencyStyle(days, reminder.status);
                  const isEditing = editId === reminder.id;

                  return (
                    <div key={reminder.id} className={`border-b border-slate-50 last:border-0 ${style.row}`}>
                      {isEditing && editingReminder ? (
                        <div className="p-4">
                          <ReminderForm
                            initial={{
                              customerName:   editingReminder.customer_name,
                              customerEmail:  editingReminder.customer_email,
                              customerPhone:  editingReminder.customer_phone,
                              vehicleName:    editingReminder.vehicle_name,
                              plate:          editingReminder.plate,
                              vin:            editingReminder.vin,
                              intervalMonths: editingReminder.interval_months,
                              lastServiceAt:  editingReminder.last_service_at ?? new Date().toISOString().slice(0, 10),
                              notes:          editingReminder.notes,
                            }}
                            onSave={form => handleUpdate(reminder.id, form)}
                            onCancel={() => setEditId(null)}
                            saving={saving}
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_100px_120px_120px_130px] gap-4 px-5 py-4 items-center">
                          {/* Customer */}
                          <div>
                            <p className="text-xs font-bold text-slate-900">{reminder.customer_name}</p>
                            {reminder.customer_email && (
                              <p className="text-[10px] text-slate-400 truncate">{reminder.customer_email}</p>
                            )}
                            {reminder.customer_phone && (
                              <p className="text-[10px] text-slate-400">{reminder.customer_phone}</p>
                            )}
                          </div>
                          {/* Vehicle */}
                          <div>
                            <p className="text-xs font-bold text-slate-800">{reminder.vehicle_name || '—'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{reminder.plate}{reminder.plate && reminder.vin ? ' · ' : ''}{reminder.vin}</p>
                          </div>
                          {/* Interval */}
                          <div>
                            <p className="text-xs font-bold text-slate-700">
                              {reminder.interval_months} {reminder.interval_months === 1 ? t('month') : t('months')}
                            </p>
                          </div>
                          {/* Last service */}
                          <div>
                            <p className="text-xs text-slate-600">{fmtDate(reminder.last_service_at)}</p>
                            {reminder.last_sent_at && (
                              <p className="text-[9px] text-slate-400">{t('lastSent')}: {fmtDate(reminder.last_sent_at)}</p>
                            )}
                          </div>
                          {/* Next reminder */}
                          <div>
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                              {days < 0
                                ? `${Math.abs(days)} ${t('daysOverdue')}`
                                : days === 0
                                  ? t('today')
                                  : `${days} ${t('daysLeft')}`
                              }
                            </span>
                            <p className="text-[9px] text-slate-400 mt-0.5">{fmtDate(reminder.next_reminder_at)}</p>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setEditId(reminder.id)}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-900 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              {t('actions.edit')}
                            </button>
                            <button
                              onClick={() => handleTogglePause(reminder)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                                reminder.status === 'active'
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {reminder.status === 'active' ? t('actions.pause') : t('actions.resume')}
                            </button>
                            <button
                              onClick={() => handleDelete(reminder.id)}
                              className="text-[10px] font-bold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              {t('actions.delete')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cron info card */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-lg shrink-0">⚙️</span>
            <div>
              <p className="text-xs font-bold text-blue-800">{t('cronInfo.title')}</p>
              <p className="text-[11px] text-blue-600 mt-0.5 leading-relaxed">{t('cronInfo.body')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
