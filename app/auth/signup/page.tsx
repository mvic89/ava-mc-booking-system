'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations();
  const [showBankID, setShowBankID] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dealershipName: '',
    agreeToTerms: false,
  });

  const handleBankIDComplete = (result: BankIDResult) => {
    setShowBankID(false);
    // Store user session and redirect to dashboard
    localStorage.setItem('user', JSON.stringify(result.user));
    router.push('/dashboard');
  };

  const handleEmailSignup = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert(t('signup.alerts.passwordsDontMatch'));
      return;
    }

    if (formData.password.length < 8) {
      alert(t('signup.alerts.passwordTooShort'));
      return;
    }

    if (!formData.agreeToTerms) {
      alert(t('signup.alerts.mustAgreeToTerms'));
      return;
    }

    // TODO: Implement user registration
    console.log('Creating account:', formData);
    // Store user session
    localStorage.setItem('user', JSON.stringify({
      name: formData.name,
      email: formData.email,
      dealershipName: formData.dealershipName
    }));
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="w-[45%] bg-[#0f1f2e] text-white p-16 flex flex-col justify-between">
        <div>
          <h1 className="text-[#FF6B2C] text-4xl font-bold mb-4">{t('common.appName')}</h1>
          <p className="text-slate-300 text-lg mb-12">{t('signup.branding.tagline')}</p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('signup.branding.getStartedFree')}</h3>
                <p className="text-slate-400">{t('signup.branding.getStartedFreeDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">⚡</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('signup.branding.setupQuick')}</h3>
                <p className="text-slate-400">{t('signup.branding.setupQuickDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🏍</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('signup.branding.dealers')}</h3>
                <p className="text-slate-400">{t('signup.branding.dealersDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🛡️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('signup.branding.secureCompliant')}</h3>
                <p className="text-slate-400">{t('signup.branding.secureCompliantDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          <p>{t('signup.branding.copyright')}</p>
          <p>{t('signup.branding.security')}</p>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">{t('signup.title')}</h2>
            <p className="text-slate-600">{t('signup.subtitle')}</p>
          </div>

          {/* BankID Sign Up */}
          <button
            onClick={() => setShowBankID(true)}
            className="w-full bg-[#235971] text-white py-3.5 rounded-lg font-semibold mb-2 hover:bg-[#1a4557] transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">🆔</span>
            {t('signup.signUpWithBankID')}
          </button>
          <p className="text-center text-xs text-slate-500 mb-6">
            {t('signup.recommended')}
          </p>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#f5f7fa] text-slate-500">{t('signup.or')}</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('signup.fullName')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Monica Andersson"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('signup.emailAddress')}
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
                {t('signup.dealershipName')}
              </label>
              <input
                type="text"
                value={formData.dealershipName}
                onChange={(e) => setFormData({ ...formData, dealershipName: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="AVA MC Stockholm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('signup.password')}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="••••••••••"
                required
                minLength={8}
              />
              <p className="text-xs text-slate-500 mt-1">{t('signup.passwordMinLength')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('signup.confirmPassword')}
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="••••••••••"
                required
                minLength={8}
              />
            </div>

            {/* Password Match Indicator */}
            {formData.password && formData.confirmPassword && (
              <div className={`text-sm rounded-lg p-3 ${
                formData.password === formData.confirmPassword
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {formData.password === formData.confirmPassword
                  ? t('signup.passwordsMatch')
                  : t('signup.passwordsDoNotMatch')}
              </div>
            )}

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                className="w-4 h-4 mt-1 text-green-600 border-slate-300 rounded focus:ring-green-500"
                required
              />
              <span className="text-sm text-slate-700">
                {t('signup.agreeToTerms')}{' '}
                <Link href="/terms" className="text-blue-600 hover:underline">
                  {t('signup.termsOfService')}
                </Link>{' '}
                {t('signup.and')}{' '}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  {t('signup.privacyPolicy')}
                </Link>
              </span>
            </div>

            <button
              type="submit"
              className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors"
            >
              {t('signup.createAccount')}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 mt-6">
            {t('signup.security')}
          </p>

          <p className="text-center text-sm text-slate-600 mt-8">
            {t('signup.alreadyHaveAccount')}{' '}
            <Link href="/auth/login" className="text-[#FF6B2C] font-semibold hover:underline">
              {t('signup.signIn')}
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
