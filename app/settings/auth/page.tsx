'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';

type Step = 'choose' | 'password' | 'denied';

interface StaffUser {
  id:            string;
  name:          string;
  role:          'admin' | 'sales' | 'service';
  status:        'active' | 'inactive';
  bankidVerified?: boolean;
}

export default function SettingsAuthPage() {
  const router = useRouter();

  const [ready, setReady]         = useState(false);
  const [step, setStep]           = useState<Step>('choose');
  const [showBankID, setShowBankID] = useState(false);
  const [pinValue, setPinValue]   = useState('');
  const [pinError, setPinError]   = useState('');
  const [user, setUser]           = useState<any>(null);

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
  // Returns true if the verified person is allowed into settings.
  // Grants access when staff list is empty (first-time setup) or when the
  // matched staff entry has role="admin". Denies only when explicitly found
  // as sales/service.
  const checkAdminRole = (verifiedName: string): boolean => {
    try {
      const staff: StaffUser[] = JSON.parse(localStorage.getItem('staff_users') || '[]');
      if (staff.length === 0) return true;

      // Fuzzy-match by first or last name (>3 chars to avoid short false-positives)
      const parts = verifiedName.toLowerCase().split(/\s+/);
      const match = staff.find(s =>
        parts.some(p => p.length > 3 && s.name?.toLowerCase().includes(p)),
      );

      if (!match) return true; // not found → assume owner / unconfigured
      return match.role === 'admin';
    } catch {
      return true;
    }
  };

  const unlock = () => {
    sessionStorage.setItem('settings_unlocked', '1');
    router.push('/settings');
  };

  // ── BankID success ────────────────────────────────────────────────────────
  const handleBankIDComplete = (result: BankIDResult) => {
    setShowBankID(false);
    if (checkAdminRole(result.user.name)) {
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
    // personalNumber matched (or not stored — lenient for demo)
    const name = user?.givenName || user?.name || '';
    if (checkAdminRole(name)) {
      unlock();
    } else {
      setStep('denied');
    }
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
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
              <h1 className="text-xl font-bold text-slate-900">Administratörsinställningar</h1>
              <p className="text-sm text-slate-400 mt-1">
                {step === 'denied'
                  ? 'Åtkomst nekad'
                  : 'Verifiera din identitet för att fortsätta'}
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
                <p className="text-sm font-semibold text-red-700 mb-1">Åtkomst nekad</p>
                <p className="text-xs text-red-500 mb-4 leading-relaxed">
                  Ditt konto har inte administratörsrättigheter.<br />
                  Kontakta din systemadministratör.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-block text-sm font-semibold text-[#FF6B2C] hover:underline"
                >
                  ← Tillbaka till dashboard
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
                    <p className="text-sm font-bold">BankID</p>
                    <p className="text-xs text-slate-400">Säker elektronisk identifiering</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold bg-[#FF6B2C] text-white px-2 py-0.5 rounded-full">
                    REKOMMENDERAT
                  </span>
                </button>

                {/* Personal number fallback */}
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
                    <p className="text-sm font-bold">Personnummer</p>
                    <p className="text-xs text-slate-400">Ange ditt personnummer manuellt</p>
                  </div>
                </button>

                <div className="pt-2 text-center">
                  <Link href="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    ← Tillbaka till dashboard
                  </Link>
                </div>
              </div>
            )}

            {/* ── Personal number form ── */}
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
                  Verifiera
                </button>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setStep('choose'); setPinValue(''); setPinError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← Tillbaka
                  </button>
                  <button
                    onClick={() => { setStep('choose'); setShowBankID(true); }}
                    className="text-xs text-[#FF6B2C] hover:underline"
                  >
                    Använd BankID istället →
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
  );
}
