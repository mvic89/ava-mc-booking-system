'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import BankIDModal from '@/components/bankIdModel';
import { getInvite, consumeInvite } from '@/lib/invites';
import { getSupabaseBrowser } from '@/lib/supabase';
import type { BankIDResult } from '@/types';

type PageState = 'loading' | 'invalid' | 'ready' | 'signing' | 'email' | 'success';

interface StaffUser {
  id: string; name: string; email: string;
  role: 'admin' | 'sales' | 'service';
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string; bankidVerified: boolean;
  personalNumber: string;
}

const ROLE_SV: Record<string, string> = { admin: 'Administratör', sales: 'Säljare', service: 'Service' };

function AcceptInviteInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const t            = useTranslations('invite');

  const [state, setState]         = useState<PageState>('loading');
  const [invite, setInvite]       = useState<ReturnType<typeof getInvite>>(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setState('invalid'); return; }
    const found = getInvite(token);
    if (!found)  { setState('invalid'); return; }
    setInvite(found);
    setState('ready');
  }, [searchParams]);

  // ── Shared: write user + session after any verification ────────────────────
  async function activateAccount(userObj: Record<string, unknown>, bankidVerified: boolean, personalNumber?: string) {
    if (!invite) return;

    // Update staff_users in localStorage
    try {
      const staff: StaffUser[] = JSON.parse(localStorage.getItem('staff_users') ?? '[]');
      const updated = staff.map(s =>
        s.email === invite.email
          ? { ...s, personalNumber: personalNumber ?? '', bankidVerified, status: 'active' as const, lastLogin: new Date().toISOString() }
          : s,
      );
      localStorage.setItem('staff_users', JSON.stringify(updated));
    } catch { /* ignore */ }

    localStorage.setItem('user', JSON.stringify(userObj));

    // Upsert into Supabase
    if (invite.dealershipId) {
      try {
        const db = getSupabaseBrowser();
        await (db as any).from('staff_users').upsert(
          {
            dealership_id:   invite.dealershipId,
            email:           invite.email,
            name:            userObj.name,
            role:            invite.role,
            status:          'active',
            bankid_verified: bankidVerified,
            personal_number: personalNumber ?? null,
            last_login:      new Date().toISOString(),
          },
          { onConflict: 'email' },
        );
      } catch { /* non-blocking */ }
    }

    // Create server-side session cookie
    await fetch('/api/auth/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealershipId:   invite.dealershipId,
        dealershipName: invite.dealershipName,
        name:           userObj.givenName ?? userObj.name,
        email:          invite.email,
        role:           invite.role,
      }),
    });

    consumeInvite(invite.token);
    setState('success');
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  // ── BankID complete ────────────────────────────────────────────────────────
  const handleBankIDComplete = async (result: BankIDResult) => {
    if (!invite) return;
    const userObj = {
      name:           result.user.name,
      givenName:      result.user.givenName,
      surname:        result.user.surname,
      personalNumber: result.user.personalNumber,
      dateOfBirth:    result.user.dateOfBirth,
      roaring:        (result as any).roaring ?? null,
      email:          invite.email,
      dealershipName: invite.dealershipName,
      dealershipId:   invite.dealershipId,
      role:           invite.role,
    };
    await activateAccount(userObj, true, result.user.personalNumber);
  };

  // ── Email verification ─────────────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    if (!invite) return;
    setEmailError('');
    const entered = emailValue.trim().toLowerCase();
    const expected = invite.email.trim().toLowerCase();

    if (!entered) {
      setEmailError('Ange din e-postadress.');
      return;
    }
    if (entered !== expected) {
      setEmailError('E-postadressen matchar inte inbjudan.');
      return;
    }

    const nameParts = (invite.name ?? '').trim().split(' ');
    const givenName = nameParts[0] ?? invite.name;
    const userObj = {
      name:           invite.name,
      givenName,
      surname:        nameParts.slice(1).join(' ') || '',
      personalNumber: '',
      email:          invite.email,
      dealershipName: invite.dealershipName,
      dealershipId:   invite.dealershipId,
      role:           invite.role,
    };
    await activateAccount(userObj, false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="bg-white rounded-xl px-2 py-1 border border-slate-100 inline-block">
            <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-8 w-auto object-contain" />
          </div>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Invalid / expired */}
        {state === 'invalid' && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center animate-fade-up">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mb-2">{t('expired')}</h1>
            <p className="text-sm text-slate-500 mb-6">{t('expiredDesc')}</p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B2C] text-white text-sm font-semibold hover:bg-[#e55a1f] transition-colors"
            >
              {t('goToLogin')}
            </Link>
          </div>
        )}

        {/* Ready — choose verification method */}
        {state === 'ready' && invite && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-fade-up">

            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B2C]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✉️</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-1">{t('title')}</h1>
              <p className="text-sm text-slate-500">
                {t('by', { dealershipName: invite.dealershipName })}
              </p>
            </div>

            {/* Invite details */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('labelName')}</span>
                <span className="text-sm font-semibold text-slate-800">{invite.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('labelEmail')}</span>
                <span className="text-sm font-semibold text-slate-800">{invite.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('labelRole')}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FF6B2C]/10 text-[#FF6B2C]">
                  {ROLE_SV[invite.role] ?? invite.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('labelCompany')}</span>
                <span className="text-sm font-semibold text-slate-800">{invite.dealershipName}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center mb-5">
              Verifiera din identitet för att aktivera ditt konto
            </p>

            {/* BankID — recommended */}
            <button
              onClick={() => setState('signing')}
              className="w-full mb-3 bg-[#0b1524] hover:bg-[#1a2a42] text-white rounded-xl p-4 flex items-center gap-4 transition-all"
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

            {/* Email fallback */}
            <button
              onClick={() => setState('email')}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl p-4 flex items-center gap-4 transition-all border border-slate-200"
            >
              <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">E-postadress</p>
                <p className="text-xs text-slate-400">Verifiera med din registrerade e-post</p>
              </div>
            </button>
          </div>
        )}

        {/* Email verification form */}
        {state === 'email' && invite && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-fade-up">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B2C]/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#FF6B2C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-1">Verifiera e-post</h1>
              <p className="text-sm text-slate-500">
                Ange e-postadressen som inbjudan skickades till
              </p>
            </div>

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
                  placeholder={invite.email}
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
                Verifiera och aktivera konto
              </button>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setState('ready'); setEmailValue(''); setEmailError(''); }}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Tillbaka
                </button>
                <button
                  onClick={() => { setState('signing'); }}
                  className="text-xs text-[#FF6B2C] hover:underline"
                >
                  Använd BankID istället →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="bg-white rounded-2xl border border-green-200 p-8 text-center animate-fade-up">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-green-800 mb-1">{t('success')}</h1>
            <p className="text-sm text-slate-500">{t('successDesc')}</p>
            <div className="mt-4 w-6 h-6 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* BankID Modal */}
        {state === 'signing' && invite && (
          <BankIDModal
            mode="auth"
            title={t('verify')}
            subtitle={t('verifyDesc')}
            onComplete={handleBankIDComplete}
            onCancel={() => setState('ready')}
            autoStart
          />
        )}

        {/* Footer */}
        {state !== 'success' && (
          <p className="text-center text-xs text-slate-400 mt-6">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/auth/login" className="text-[#FF6B2C] hover:underline">{t('loginLink')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  );
}
