'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const t = useTranslations('forgotPassword');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Något gick fel. Försök igen.');
        return;
      }
      router.push('/auth/email-sent');
    } catch {
      toast.error('Kunde inte skicka e-post. Kontrollera din anslutning.');
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
                <h3 className="text-xl font-bold mb-2">{t('branding.secureReset')}</h3>
                <p className="text-slate-400">{t('branding.secureResetDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">📧</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.emailVerification')}</h3>
                <p className="text-slate-400">{t('branding.emailVerificationDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">⏱️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.expiry')}</h3>
                <p className="text-slate-400">{t('branding.expiryDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🛡️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.protectedAccess')}</h3>
                <p className="text-slate-400">{t('branding.protectedAccessDesc')}</p>
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
            <p className="text-sm md:text-base text-slate-600">
              {t('subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('emailAddress')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder={t('emailPlaceholder')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors disabled:opacity-60"
            >
              {loading ? 'Skickar…' : t('sendButton')}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
            >
              {t('backToSignIn')}
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
