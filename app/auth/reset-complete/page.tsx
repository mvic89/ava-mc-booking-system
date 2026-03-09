'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ResetCompletePage() {
  const t = useTranslations('resetComplete');

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left Side - Branding */}
      <div className="hidden md:flex md:w-[45%] bg-[#0f1f2e] text-white p-8 lg:p-16 flex-col justify-between">
        <div>
          <h1 className="text-[#FF6B2C] text-4xl font-bold mb-4">BikeMeNow</h1>
          <p className="text-slate-300 text-lg mb-12">{t('branding.tagline')}</p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">✅</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.passwordUpdated')}</h3>
                <p className="text-slate-400">{t('branding.passwordUpdatedDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🔒</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.securelyEncrypted')}</h3>
                <p className="text-slate-400">{t('branding.securelyEncryptedDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🚀</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.readyToGo')}</h3>
                <p className="text-slate-400">{t('branding.readyToGoDesc')}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="text-3xl">🛡️</div>
              <div>
                <h3 className="text-xl font-bold mb-2">{t('branding.accountSecure')}</h3>
                <p className="text-slate-400">{t('branding.accountSecureDesc')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          <p>{t('branding.copyright')}</p>
          <p>{t('branding.security')}</p>
        </div>
      </div>

      {/* Right Side - Success Message */}
      <div className="flex-1 bg-[#f5f7fa] flex items-center justify-center p-6 md:p-12 relative">
        {/* Language Switcher - Top Right */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <LanguageSwitcher variant="compact" />
        </div>

        {/* Mobile Logo */}
        <div className="md:hidden absolute top-4 left-4">
          <h1 className="text-[#FF6B2C] text-xl font-bold">BikeMeNow</h1>
        </div>

        <div className="w-full max-w-md text-center mt-12 md:mt-0">
          <div className="text-5xl md:text-7xl mb-4 md:mb-6">🎉</div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">{t('title')}</h2>
          <p className="text-slate-600 mb-8">
            {t('subtitle')}
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-5 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-green-900 mb-1">
                  {t('successTitle')}
                </p>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• {t('itemNewActive')}</li>
                  <li>• {t('itemOldInvalidated')}</li>
                  <li>• {t('itemCanSignIn')}</li>
                </ul>
              </div>
            </div>
          </div>

          <Link
            href="/auth/login"
            className="block w-full bg-[#FF6B2C] text-white py-3 rounded-lg font-semibold hover:bg-[#e55a1f] transition-colors mb-4"
          >
            {t('goToSignIn')}
          </Link>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <p className="text-xs text-blue-800">
              {t('tip')}
            </p>
          </div>

          <p className="text-center text-sm text-slate-600 mt-8">
            {t('security')}
          </p>
        </div>
      </div>
    </div>
  );
}
