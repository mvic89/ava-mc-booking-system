'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getDealerInfo, type DealerInfo } from '@/lib/dealer';

const SECTIONS = [
  'S1', 'S2', 'S3', 'S4', 'S5',
  'S6', 'S7', 'S8', 'S9', 'S10',
] as const;

const EMPTY_DEALER: DealerInfo = { name: '', orgNr: '', city: '', email: '', phone: '', website: '', address: '', postalCode: '', bankgiro: '', swish: '', iban: '', bic: '' };

export default function PrivacyPage() {
  const t = useTranslations('privacy');
  const [dealer, setDealer] = useState<DealerInfo>(EMPTY_DEALER);

  useEffect(() => { setDealer(getDealerInfo()); }, []);

  const tv = { dealerName: dealer.name, orgNr: dealer.orgNr, city: dealer.city, email: dealer.email };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-[#0f1923] border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-[#FF6B2C] font-bold text-xl">Bike</span>
            <span className="text-white font-bold text-xl">MeNow</span>
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Title card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('title')}</h1>
          <p className="text-slate-500 text-sm">{t('subtitle', tv)}</p>
          <p className="text-slate-400 text-xs mt-1">{t('lastUpdated')}</p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {SECTIONS.map((s) => {
            const n = s.toLowerCase(); // s1, s2, …
            const titleKey = `${n}title` as Parameters<typeof t>[0];
            const bodyKey = `${n}body` as Parameters<typeof t>[0];
            return (
              <div key={s} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-base font-semibold text-[#FF6B2C] mb-2">
                  {t(titleKey)}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t(bodyKey, tv)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer nav */}
        <div className="mt-8 text-center text-xs text-slate-400 space-x-3">
          <Link href="/terms" className="hover:text-[#FF6B2C] transition-colors">
            Användarvillkor / Terms
          </Link>
          <span>·</span>
          <Link href="/dashboard" className="hover:text-[#FF6B2C] transition-colors">
            BikeMeNow
          </Link>
          <span>·</span>
          <span>{dealer.name}{dealer.orgNr ? ` · ${dealer.orgNr}` : ''}</span>
        </div>
      </main>
    </div>
  );
}
