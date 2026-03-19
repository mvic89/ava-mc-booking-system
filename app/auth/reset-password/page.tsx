'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const t = useTranslations('resetPassword');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('alerts.passwordsDontMatch'));
      return;
    }
    if (formData.password.length < 8) {
      toast.error(t('alerts.passwordTooShort'));
      return;
    }
    if (!token) {
      toast.error('Ogiltig länk. Begär en ny lösenordsåterställning.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password: formData.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Något gick fel. Försök igen.');
        return;
      }
      router.push('/auth/reset-complete');
    } catch {
      toast.error('Kunde inte återställa lösenordet. Kontrollera din anslutning.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left Side - Branding */}
      <div className="hidden md:flex md:w-[45%] bg-[#0f1f2e] text-white p-8 lg:p-16 flex-col justify-between">
        <div>
          <div className="bg-white rounded-2xl px-4 py-2 inline-block mb-4">
            <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-16 w-auto object-contain" />
          </div>
          <p className="text-slate-300 text-lg mb-12">{t('branding.tagline')}</p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🔐</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.strongPassword')}</h3>
                <p className="text-slate-400">{t('branding.strongPasswordDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">✅</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.confirmationMatch')}</h3>
                <p className="text-slate-400">{t('branding.confirmationMatchDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🛡️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.secureHash')}</h3>
                <p className="text-slate-400">{t('branding.secureHashDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🔄</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.immediateEffect')}</h3>
                <p className="text-slate-400">{t('branding.immediateEffectDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          <p>{t('branding.copyright')}</p>
          <p>{t('branding.security')}</p>
        </div>
      </div>

      {/* Right Side - Reset Form */}
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-6 md:p-12 relative">
        {/* Language Switcher - Top Right */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <LanguageSwitcher variant="compact" />
        </div>

        {/* Mobile Logo */}
        <div className="md:hidden absolute top-4 left-4">
          <div className="bg-white rounded-lg p-0.5">
            <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-6 w-auto object-contain" />
          </div>
        </div>

        <div className="w-full max-w-md mt-12 md:mt-0">
          <div className="text-center mb-6 md:mb-8">
            <div className="text-4xl md:text-5xl mb-4">🔑</div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{t('title')}</h2>
            <p className="text-slate-600">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('minLength')}</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('confirmNewPassword')}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="••••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Password Match Indicator */}
            {formData.password && formData.confirmPassword && (
              <div className={`text-sm rounded-lg p-3 ${
                formData.password === formData.confirmPassword
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {formData.password === formData.confirmPassword
                  ? t('passwordsMatch')
                  : t('passwordsDoNotMatch')}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors disabled:opacity-60"
            >
              {loading ? 'Sparar…' : t('resetButton')}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
            >
              <span>←</span> {t('backToSignIn')}
            </Link>
          </div>

          <p className="text-center text-sm text-slate-600 mt-8">
            {t('security')}
          </p>
        </div>
      </div>
    </div>
  );
}
