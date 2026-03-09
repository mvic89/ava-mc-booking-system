'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';

interface ComingSoonProps {
  icon: string;
  title: string;
  description: string;
}

export default function ComingSoon({ icon, title, description }: ComingSoonProps) {
  const router = useRouter();
  const t = useTranslations('common');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.replace('/auth/login');
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return (
    <div className="flex min-h-screen bg-[#f5f7fa] items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col">
        <div className="brand-top-bar" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm animate-fade-up">
            <div className="text-6xl mb-4">{icon}</div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
            <p className="text-slate-500 mb-6">{description}</p>
            <span className="inline-block bg-amber-100 text-amber-800 text-sm font-semibold px-4 py-2 rounded-full">
              {t('comingSoon')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
