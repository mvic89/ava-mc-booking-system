
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations('settings');
  const [userRole, setUserRole] = useState<string>('');

  const ADMIN_ONLY_IDS = ['payments', 'integrations', 'users', 'billing'];

  const SETTINGS_SECTIONS = [
    { id: 'payments',      icon: '💳', title: t('sections.payments.title'),      desc: t('sections.payments.desc'),      href: '/settings/payments',      live: true,  badge: t('sections.payments.badge'),      badgeCls: 'bg-green-100 text-green-700' },
    { id: 'profile',       icon: '🏢', title: t('sections.profile.title'),       desc: t('sections.profile.desc'),       href: '/settings/profile',       live: true,  badge: t('sections.profile.badge'),       badgeCls: 'bg-green-100 text-green-700' },
    { id: 'users',         icon: '👥', title: t('sections.users.title'),         desc: t('sections.users.desc'),         href: '/settings/users',         live: true,  badge: t('sections.users.badge'),         badgeCls: 'bg-green-100 text-green-700' },
    { id: 'notifications', icon: '🔔', title: t('sections.notifications.title'), desc: t('sections.notifications.desc'), href: '/settings/notifications', live: true,  badge: t('sections.notifications.badge'), badgeCls: 'bg-orange-100 text-orange-700' },
    { id: 'integrations',  icon: '🔌', title: t('sections.integrations.title'),  desc: t('sections.integrations.desc'),  href: '/settings/integrations',  live: true,  badge: t('sections.integrations.badge'),  badgeCls: 'bg-green-100 text-green-700' },
    { id: 'billing',       icon: '📄', title: t('sections.billing.title'),       desc: t('sections.billing.desc'),       href: '/settings/billing',       live: true,  badge: t('sections.billing.badge'),       badgeCls: 'bg-green-100 text-green-700' },
  ];

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/auth/login'); return; }
    const u = JSON.parse(raw);
    setUserRole(u.role ?? 'sales');
  }, [router]);

  const isAdmin         = userRole === 'admin';
  const visibleSections = SETTINGS_SECTIONS.filter(s => !ADMIN_ONLY_IDS.includes(s.id) || isAdmin);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="lg:ml-64 flex-1">
        <div className="brand-top-bar" />

        <div className="p-6 max-w-4xl animate-fade-up">

          {/* Header */}
          <div className="mb-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">{t('breadcrumb')}</p>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">⚙️ {t('title')}</h1>
            <p className="text-sm text-slate-400 mt-1">{t('subtitle')}</p>
          </div>

          {!isAdmin && (
            <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-amber-500 mt-0.5">🔒</span>
              <p className="text-xs text-amber-700">
                Some settings are only available to administrators. Contact your admin to configure payments, integrations, billing and user management.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleSections.map(s => (
              <Link
                key={s.id}
                href={s.href}
                className={`bg-white rounded-2xl border p-5 flex items-start gap-4 transition-all group ${
                  s.live
                    ? 'border-slate-100 hover:border-[#FF6B2C]/40 hover:shadow-md cursor-pointer'
                    : 'border-slate-100 opacity-60 cursor-default pointer-events-none'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-2xl transition-colors ${
                  s.live ? 'bg-[#FF6B2C]/10 group-hover:bg-[#FF6B2C]/20' : 'bg-slate-50'
                }`}>
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{s.title}</p>
                    {s.badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badgeCls}`}>{s.badge}</span>
                    )}
                    {!s.live && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{t('comingSoon')}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
                {s.live && (
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-[#FF6B2C] transition-colors shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
