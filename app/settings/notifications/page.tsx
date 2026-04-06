'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import {
  getPreferences,
  savePreferences,
  NotificationPreferences,
  DEFAULT_PREFS,
  addNotification,
} from '@/lib/notifications';

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none ${
        checked ? 'bg-[#FF6B2C]' : 'bg-slate-200'
      }`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
        checked ? 'left-4' : 'left-0.5'
      }`} />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const t = useTranslations('notifications');

  const [prefs, setPrefs]   = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ email?: string } | null>(null);
  const [dealershipId, setDealershipId] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [smtpOk, setSmtpOk]     = useState<boolean | null>(null);
  const [twilioOk, setTwilioOk] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState('');

  // ─── Event definitions ────────────────────────────────────────────────────

  const EVENTS: {
    id:    keyof NotificationPreferences;
    icon:  string;
    title: string;
    desc:  string;
    dot:   string;
  }[] = [
    { id: 'newLead',         icon: '💰', title: t('events.newLead.title'),         desc: t('events.newLead.desc'),         dot: 'bg-[#FF6B2C]'  },
    { id: 'agreementSigned', icon: '📝', title: t('events.agreementSigned.title'), desc: t('events.agreementSigned.desc'), dot: 'bg-green-500'  },
    { id: 'paymentReceived', icon: '💳', title: t('events.paymentReceived.title'), desc: t('events.paymentReceived.desc'), dot: 'bg-blue-500'   },
    { id: 'newCustomer',     icon: '👤', title: t('events.newCustomer.title'),     desc: t('events.newCustomer.desc'),     dot: 'bg-purple-500' },
  ];

  const CHANNELS: { id: 'inApp' | 'email' | 'sms'; label: string; icon: string }[] = [
    { id: 'inApp', label: t('channels.inApp.label'), icon: '🔔' },
    { id: 'email', label: t('channels.email.label'), icon: '📧' },
    { id: 'sms',   label: t('channels.sms.label'),   icon: '📱' },
  ];

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw) as { dealershipId?: string };
    setPrefs(getPreferences());
    try {
      const p = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
      if (p.email) setProfile(p);
    } catch {}

    const did = u.dealershipId ?? '';
    setDealershipId(did);

    if (did) {
      fetch(`/api/notifications/config?dealershipId=${encodeURIComponent(did)}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: { smtpOk: boolean; twilioOk: boolean; adminPhone: string | null; adminEmail: string | null } | null) => {
          if (!data) return;
          setSmtpOk(data.smtpOk);
          setTwilioOk(data.twilioOk);
          if (data.adminPhone) setAdminPhone(data.adminPhone);
          if (data.adminEmail) setAdminEmail(data.adminEmail);
        })
        .catch(() => {});
    }
  }, [router]);

  const setChannel = (
    event: keyof NotificationPreferences,
    channel: 'inApp' | 'email' | 'sms',
    value: boolean,
  ) => setPrefs(p => ({ ...p, [event]: { ...p[event], [channel]: value } }));

  const handleSave = () => {
    setSaving(true);
    savePreferences(prefs);
    setTimeout(() => { setSaving(false); toast.success(t('saveToast')); }, 300);
  };

  const handleTestNotification = () => {
    addNotification({ type: 'system', title: t('testNotifTitle'), message: t('testNotifMessage') });
    toast.success(t('testToast'));
  };

  const handleSavePhone = async () => {
    if (!dealershipId) return;
    setSavingPhone(true);
    try {
      const res = await fetch('/api/notifications/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, adminPhone }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Telefonnummer sparat');
    } catch { toast.error('Kunde inte spara'); }
    finally { setSavingPhone(false); }
  };

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">Inställningar</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('breadcrumb')}</span>
          </nav>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-black text-[#0b1524]">{t('title')}</h1>
              <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTestNotification}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#FF6B2C]/40 hover:bg-orange-50 text-sm font-semibold text-slate-700 transition-all"
              >
                🔔 {t('testButton')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-60 text-white text-sm font-bold transition-colors"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('saving')}</>
                  : `💾 ${t('save')}`}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 md:px-8 py-8 max-w-4xl space-y-5">

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-blue-500 text-xl shrink-0">ℹ</span>
            <div className="text-sm text-blue-700 space-y-1">
              <p className="font-semibold">{t('infoTitle')}</p>
              <p className="text-xs leading-relaxed text-blue-600">
                {t('infoBody')}
                {profile?.email && <> {t('infoEmail')} <strong>{profile.email}</strong>.</>}
              </p>
            </div>
          </div>

          {/* Matrix table */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_100px_100px] gap-0 border-b border-slate-100">
              <div className="px-6 py-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('columnEvent')}</p>
              </div>
              {CHANNELS.map(ch => (
                <div key={ch.id} className="px-3 py-4 text-center border-l border-slate-100">
                  <p className="text-base mb-0.5">{ch.icon}</p>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{ch.label}</p>
                </div>
              ))}
            </div>

            {EVENTS.map((ev, i) => (
              <div
                key={ev.id}
                className={`grid grid-cols-[1fr_100px_100px_100px] gap-0 ${i < EVENTS.length - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <div className="px-6 py-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: '#f5f7fa' }}>
                    {ev.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                      <span className={`w-1.5 h-1.5 rounded-full ${ev.dot}`} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ev.desc}</p>
                  </div>
                </div>
                {CHANNELS.map(ch => (
                  <div key={ch.id} className="px-3 py-5 flex items-center justify-center border-l border-slate-50">
                    <Toggle checked={prefs[ev.id][ch.id]} onChange={v => setChannel(ev.id, ch.id, v)} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Channel status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* In-app */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔔</span>
                <p className="text-sm font-bold text-slate-900">{t('channels.inApp.label')}</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{t('channels.inApp.note')}</p>
              <p className="text-xs text-green-600 mt-2 font-medium">✓ {t('inAppNote')}</p>
            </div>

            {/* Email */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📧</span>
                  <p className="text-sm font-bold text-slate-900">{t('channels.email.label')}</p>
                </div>
                {smtpOk === true  && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Konfigurerad</span>}
                {smtpOk === false && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Ej konfigurerad</span>}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{t('channels.email.note')}</p>
              {adminEmail && smtpOk && (
                <p className="text-xs text-[#FF6B2C] mb-3 font-medium">{adminEmail}</p>
              )}
              <Link
                href="/settings/integrations"
                className="block w-full py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#FF6B2C]/40 hover:bg-orange-50 transition-all text-center"
              >
                {smtpOk ? '✏️ Ändra e-postinställningar →' : '⚙️ Konfigurera e-post →'}
              </Link>
            </div>

            {/* SMS */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📱</span>
                  <p className="text-sm font-bold text-slate-900">{t('channels.sms.label')}</p>
                </div>
                {twilioOk === true  && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Konfigurerad</span>}
                {twilioOk === false && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Ej konfigurerad</span>}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">{t('channels.sms.note')}</p>

              {/* Admin phone — quick edit stays here since it's just one field */}
              <div className="flex gap-1.5 mb-3">
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value)}
                  placeholder="+46701234567"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20"
                />
                <button
                  onClick={handleSavePhone}
                  disabled={savingPhone}
                  className="px-2.5 py-1.5 rounded-lg bg-[#FF6B2C] hover:bg-orange-600 text-white text-xs font-semibold transition-colors disabled:opacity-60 shrink-0"
                >
                  {savingPhone ? '…' : 'Spara'}
                </button>
              </div>

              <Link
                href="/settings/integrations"
                className="block w-full py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#FF6B2C]/40 hover:bg-orange-50 transition-all text-center"
              >
                {twilioOk ? '✏️ Ändra SMS-inställningar →' : '⚙️ Konfigurera SMS (Twilio) →'}
              </Link>
            </div>

          </div>

          {/* Bottom save bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <Link href="/settings" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              {t('back')}
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('saving')}</>
                : `💾 ${t('saveAll')}`}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
