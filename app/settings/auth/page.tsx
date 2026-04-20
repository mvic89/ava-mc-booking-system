'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';

type Step = 'choose' | 'password' | 'email' | 'denied';

interface StaffUser {
  id:            string;
  name:          string;
  role:          'admin' | 'sales' | 'service';
  status:        'active' | 'inactive';
  bankidVerified?: boolean;
}

export default function SettingsAuthPage() {
  const router = useRouter();
  const t      = useTranslations('settingsAuth');

  const [ready, setReady]         = useState(false);
  const [step, setStep]           = useState<Step>('choose');
  const [showBankID, setShowBankID] = useState(false);
  const [pinValue,    setPinValue]    = useState('');
  const [pinError,    setPinError]    = useState('');
  const [emailValue,  setEmailValue]  = useState('');
  const [emailError,  setEmailError]  = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser]               = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    setUser(JSON.parse(raw));

    // Already unlocked — skip auth
    if (sessionStorage.getItem('settings_unlocked')) {
      router.replace('/settings');
      return;
    }
    setReady(true);
  }, [router]);

  // ── Admin role check ──────────────────────────────────────────────────────
  // Read the role that was set during login / invite-acceptance from localStorage.
  // The session cookie guarantees the user is authenticated; this checks their role.
  const checkAdminRole = (): boolean => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return false;
      const u = JSON.parse(raw);
      return u.role === 'admin';
    } catch {
      return false;
    }
  };

  const unlock = () => {
    sessionStorage.setItem('settings_unlocked', '1');
    router.push('/settings');
  };

  // ── BankID success ────────────────────────────────────────────────────────
  const handleBankIDComplete = (_result: BankIDResult) => {
    setShowBankID(false);
    if (checkAdminRole()) {
      unlock();
    } else {
      setStep('denied');
    }
  };

  // ── Personal-number verification ──────────────────────────────────────────
  const handlePasswordSubmit = () => {
    setPinError('');
    const normalize = (s: string) => s.replace(/[-\s]/g, '');
    const stored    = normalize(user?.personalNumber ?? '');
    const entered   = normalize(pinValue);

    if (!entered) {
      setPinError('Ange ditt personnummer.');
      return;
    }
    if (stored && entered !== stored) {
      setPinError('Felaktigt personnummer. Försök igen.');
      return;
    }
    if (checkAdminRole()) { unlock(); } else { setStep('denied'); }
  };

  // ── Email verification ────────────────────────────────────────────────────
  const handleEmailSubmit = () => {
    setEmailError('');
    const stored  = (user?.email ?? '').trim().toLowerCase();
    const entered = emailValue.trim().toLowerCase();

    if (!entered) {
      setEmailError('Ange din e-postadress.');
      return;
    }
    if (!stored) {
      setEmailError('Ingen e-post registrerad — använd BankID.');
      return;
    }
    if (entered !== stored) {
      setEmailError('Felaktig e-postadress. Försök igen.');
      return;
    }
    if (checkAdminRole()) { unlock(); } else { setStep('denied'); }
  };

  if (!ready) return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">

          {/* Brand accent */}
          <div className="h-1 bg-gradient-to-r from-[#FF6B2C] via-[#ff9a6c] to-transparent" />

          <div className="p-8">

            {/* Lock icon */}
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 bg-[#0b1524] rounded-2xl flex items-center justify-center shadow-md">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-slate-900">{t('title')}</h1>
              <p className="text-sm text-slate-400 mt-1">
                {step === 'denied' ? t('accessDenied') : t('verify')}
              </p>
            </div>

            {/* ── Access denied ── */}
            {step === 'denied' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-red-700 mb-1">{t('accessDenied')}</p>
                <p className="text-xs text-red-500 mb-4 leading-relaxed">
                  {t('adminOnly')}
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block text-sm font-semibold text-[#FF6B2C] hover:underline"
                >
                  ← {t('backToDashboard')}
                </Link>
              </div>
            )}

            {/* ── Choose method ── */}
            {step === 'choose' && (
              <div className="space-y-3">

                {/* BankID — recommended */}
                <button
                  onClick={() => setShowBankID(true)}
                  className="w-full bg-[#0b1524] hover:bg-[#1a2a42] text-white rounded-xl p-4 flex items-center gap-4 transition-all"
                >
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0 text-xl">
                    🪪
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold">{t('bankid')}</p>
                    <p className="text-xs text-slate-400">{t('secure')}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold bg-[#FF6B2C] text-white px-2 py-0.5 rounded-full">
                    {t('recommended')}
                  </span>
                </button>

                {/* Personnummer fallback */}
                <button
                  onClick={() => setStep('password')}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl p-4 flex items-center gap-4 transition-all border border-slate-200"
                >
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{t('personnummer')}</p>
                    <p className="text-xs text-slate-400">{t('subtitle')}</p>
                  </div>
                </button>

                {/* Email fallback */}
                <button
                  onClick={() => setStep('email')}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl p-4 flex items-center gap-4 transition-all border border-slate-200"
                >
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{t('email')}</p>
                    <p className="text-xs text-slate-400">{t('verify')}</p>
                  </div>
                </button>

                <div className="pt-2 text-center">
                  <Link href="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    ← {t('backToDashboard')}
                  </Link>
                </div>
              </div>
            )}

            {/* ── Personnummer form ── */}
            {step === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Personnummer (YYYYMMDD-XXXX)
                  </label>
                  <input
                    type="text"
                    value={pinValue}
                    onChange={e => { setPinValue(e.target.value); setPinError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                    placeholder="19800101-1234"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C] transition-all font-mono tracking-wider"
                    autoFocus
                  />
                  {pinError && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{pinError}</p>
                  )}
                </div>

                <button
                  onClick={handlePasswordSubmit}
                  className="w-full py-3 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors"
                >
                  {t('verify')}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setStep('choose'); setPinValue(''); setPinError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← {t('backToDashboard')}
                  </button>
                  <button
                    onClick={() => { setStep('choose'); setShowBankID(true); }}
                    className="text-xs text-[#FF6B2C] hover:underline"
                  >
                    {t('useInstead')} →
                  </button>
                </div>
              </div>
            )}

            {/* ── Email form ── */}
            {step === 'email' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    E-postadress
                  </label>
                  <input
                    type="email"
                    value={emailValue}
                    onChange={e => { setEmailValue(e.target.value); setEmailError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                    placeholder="din@epost.se"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/30 focus:border-[#FF6B2C] transition-all"
                    autoFocus
                  />
                  {emailError && (
                    <p className="text-xs text-red-500 mt-1.5 font-medium">{emailError}</p>
                  )}
                </div>

                <button
                  onClick={handleEmailSubmit}
                  className="w-full py-3 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors"
                >
                  {t('verify')}
                </button>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setStep('choose'); setEmailValue(''); setEmailError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← {t('backToDashboard')}
                  </button>
                  <button
                    onClick={() => { setStep('choose'); setShowBankID(true); }}
                    className="text-xs text-[#FF6B2C] hover:underline"
                  >
                    {t('useInstead')} →
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Inställningar kräver administratörsbehörighet och verifierad identitet
        </p>

      </div>

      {/* BankID Modal */}
      {showBankID && (
        <BankIDModal
          mode="auth"
          title="Identifiera dig"
          subtitle="Autentisera med BankID för att komma åt administratörsinställningarna"
          onComplete={handleBankIDComplete}
          onCancel={() => setShowBankID(false)}
          autoStart
        />
      )}
      </div>
    </div>
  );
}
