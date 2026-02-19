'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function Home() {
  const router = useRouter();
  const t = useTranslations();

  useEffect(() => {
    // Redirect to login page on app start
    router.push('/auth/login');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="text-center">
        <div className="text-5xl mb-4">🏍</div>
        <h1 className="text-[#FF6B2C] text-3xl font-bold mb-2">{t('common.appName')}</h1>
        <p className="text-slate-600">{t('redirecting')}</p>
      </div>
    </div>
  );
}