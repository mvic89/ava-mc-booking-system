'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const [showBankID, setShowBankID] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberDevice: false,
  });

  const handleBankIDComplete = (result: BankIDResult) => {
    setShowBankID(false);
    // Store user session
    localStorage.setItem('user', JSON.stringify(result.user));
    // Redirect to dashboard
    router.push('/dashboard');
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement email/password authentication
    console.log('Email login:', formData);
    // Store mock user session for email login
    localStorage.setItem('user', JSON.stringify({
      name: formData.email.split('@')[0],
      email: formData.email
    }));
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="w-[45%] bg-[#0f1f2e] text-white p-16 flex flex-col justify-between">
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
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('login.title')}</h2>
            <p className="text-slate-600">{t('login.subtitle')}</p>
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
                placeholder="monica@avamc.se"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('login.password')}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
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
              {t('login.signUp')}
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
