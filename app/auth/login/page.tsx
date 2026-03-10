'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BankIDModal from '@/components/bankIdModel';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { BankIDResult } from '@/types';

type UserRole = 'admin' | 'sales' | 'service';

function resolveRole(personalNumber?: string, email?: string): UserRole {
  try {
    const staff: Array<{ email: string; personalNumber: string; role: UserRole }> =
      JSON.parse(localStorage.getItem('staff_users') ?? '[]');
    if (staff.length === 0) return 'admin';
    if (personalNumber) {
      const match = staff.find(s => s.personalNumber === personalNumber);
      if (match) return match.role;
    }
    if (email) {
      const match = staff.find(s => s.email === email);
      if (match) return match.role;
    }
  } catch { /* ignore */ }
  return 'admin';
}

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const [showBankID, setShowBankID] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberDevice: false,
  });

  // Redirect if already logged in
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleBankIDComplete = (result: BankIDResult) => {
    setShowBankID(false);
    const role = resolveRole(result.user.personalNumber);
    // Preserve existing session fields (email, dealershipName) from accounts store
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    const existing = Object.values(accounts).find(
      (a: any) => a.email && true
    ) as any ?? {};
    // Update staff_users: set personalNumber + bankidVerified + lastLogin
    try {
      const staff: any[] = JSON.parse(localStorage.getItem('staff_users') ?? '[]');
      const updated = staff.map(s =>
        s.personalNumber === result.user.personalNumber || (!s.personalNumber && s.role === role)
          ? { ...s, personalNumber: result.user.personalNumber, bankidVerified: true, lastLogin: new Date().toISOString() }
          : s,
      );
      localStorage.setItem('staff_users', JSON.stringify(updated));
    } catch { /* ignore */ }
    localStorage.setItem('user', JSON.stringify({
      ...result.user,
      roaring:        (result as any).roaring ?? null,
      email:          existing.email          ?? '',
      dealershipName: existing.dealershipName ?? '',
      role,
    }));
    router.replace('/dashboard');
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Look up registered account to restore dealershipName
    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
    const registered = accounts[formData.email];
    const role = resolveRole(undefined, formData.email);
    localStorage.setItem('user', JSON.stringify(
      registered
        ? { ...registered, role }
        : { name: formData.email.split('@')[0], email: formData.email, role }
    ));
    router.replace('/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left Side - Branding */}
      <div className="hidden md:flex md:w-[45%] bg-[#0f1f2e] text-white p-8 lg:p-16 flex-col justify-between">
        <div>
          <h1 className="text-[#FF6B2C] text-4xl font-bold mb-4">{t('common.appName')}</h1>
          <p className="text-slate-300 text-lg mb-12">{t('login.branding.tagline')}</p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('login.branding.zeroInput')}</h3>
                <p className="text-slate-400">{t('login.branding.zeroInputDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🔒</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('login.branding.secured')}</h3>
                <p className="text-slate-400">{t('login.branding.securedDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">📊</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('login.branding.analytics')}</h3>
                <p className="text-slate-400">{t('login.branding.analyticsDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🏍</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('login.branding.dealers')}</h3>
                <p className="text-slate-400">{t('login.branding.dealersDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          <p>{t('login.branding.copyright')}</p>
          <p>{t('login.branding.security')}</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-6 md:p-12 relative">
        {/* Language Switcher - Top Right */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <LanguageSwitcher variant="compact" />
        </div>

        {/* Mobile Logo */}
        <div className="md:hidden absolute top-4 left-4">
          <h1 className="text-[#FF6B2C] text-xl font-bold">{t('common.appName')}</h1>
        </div>

        <div className="w-full max-w-md mt-12 md:mt-0">
          <div className="text-center mb-6 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{t('login.title')}</h2>
            <p className="text-sm md:text-base text-slate-600">{t('login.subtitle')}</p>
          </div>

          {/* BankID Sign In */}
          <button
            onClick={() => setShowBankID(true)}
            className="w-full bg-[#235971] text-white py-3.5 rounded-lg font-semibold mb-2 hover:bg-[#1a4557] transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">🆔</span>
            {t('login.signInWithBankID')}
          </button>
          <p className="text-center text-xs text-slate-500 mb-6">
            {t('login.recommended')}
          </p>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#f5f7fa] text-slate-500">{t('login.or')}</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('login.emailAddress')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="namn@aterforsaljare.se"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('login.password')}
              </label>
              <PasswordInput
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.rememberDevice}
                  onChange={(e) => setFormData({ ...formData, rememberDevice: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-slate-700">{t('login.rememberDevice')}</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                {t('login.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors"
            >
              {t('login.signIn')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            {t('login.security')}
          </p>

          <p className="text-center text-sm text-slate-600 mt-8">
            {t('login.noAccount')}{' '}
            <Link href="/auth/signup" className="text-[#FF6B2C] font-semibold hover:underline">
              Start free trial →
            </Link>
          </p>
        </div>
      </div>

      {/* BankID Modal */}
      {showBankID && (
        <BankIDModal
          mode="auth"
          onComplete={handleBankIDComplete}
          onCancel={() => setShowBankID(false)}
          autoStart
        />
      )}
    </div>
  );
}
