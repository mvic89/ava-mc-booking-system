'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import BankIDModal from '@/components/bankIdModel';
import { getInvite, consumeInvite } from '@/lib/invites';
import type { BankIDResult } from '@/types';

type PageState = 'loading' | 'invalid' | 'ready' | 'signing' | 'success';

interface StaffUser {
  id: string; name: string; email: string;
  role: 'admin' | 'sales' | 'service';
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string; bankidVerified: boolean;
  personalNumber: string;
}

const ROLE_SV: Record<string, string> = { admin: 'Administratör', sales: 'Säljare', service: 'Service' };
const ROLE_EN: Record<string, string> = { admin: 'Administrator',  sales: 'Sales',   service: 'Service' };

function AcceptInviteInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const t            = useTranslations('invite');

  const [state, setState]           = useState<PageState>('loading');
  const [invite, setInvite]         = useState<ReturnType<typeof getInvite>>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setState('invalid'); return; }
    const found = getInvite(token);
    if (!found)  { setState('invalid'); return; }
    setInvite(found);
    setState('ready');
  }, [searchParams]);

  const handleBankIDComplete = (result: BankIDResult) => {
    if (!invite) return;

    // Update the matching staff user record
    try {
      const staff: StaffUser[] = JSON.parse(localStorage.getItem('staff_users') ?? '[]');
      const updated = staff.map(s =>
        s.email === invite.email
          ? { ...s, personalNumber: result.user.personalNumber, bankidVerified: true, status: 'active' as const, lastLogin: new Date().toISOString() }
          : s,
      );
      localStorage.setItem('staff_users', JSON.stringify(updated));
    } catch { /* ignore */ }

    // Save user session
    localStorage.setItem('user', JSON.stringify({
      name:           result.user.name,
      givenName:      result.user.givenName,
      surname:        result.user.surname,
      personalNumber: result.user.personalNumber,
      dateOfBirth:    result.user.dateOfBirth,
      roaring:        (result as any).roaring ?? null,
      email:          invite.email,
      dealershipName: invite.dealershipName,
      role:           invite.role,
    }));

    consumeInvite(invite.token);
    setState('success');

    setTimeout(() => router.push('/dashboard'), 1500);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-2xl font-extrabold tracking-tight text-[#FF6B2C]">BikeMeNow</span>
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

        {/* Ready — show invite details */}
        {(state === 'ready' || state === 'signing') && invite && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 animate-fade-up">
            {/* Company + role */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B2C]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✉️</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-1">{t('title')}</h1>
              <p className="text-sm text-slate-500">
                {t('by', { dealershipName: invite.dealershipName })}
              </p>
            </div>

            {/* Details card */}
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

            <p className="text-xs text-slate-400 text-center mb-5">{t('verifyDesc')}</p>

            {/* BankID button */}
            <button
              onClick={() => setState('signing')}
              className="w-full py-3 rounded-xl bg-[#0b1524] hover:bg-[#1a2a42] text-white text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
            >
              <span>🪪</span> {t('verify')}
            </button>
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
