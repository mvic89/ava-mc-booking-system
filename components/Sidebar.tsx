'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [dealershipLogo, setDealershipLogo] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const t = useTranslations();

  const NAV_GROUPS = [
    {
      label: t('navigation.groups.core'),
      items: [
        { icon: '📊', label: t('navigation.dashboard'),      href: '/dashboard' },
        { icon: '🏍', label: t('navigation.inventory'),       href: '/inventory' },
        { icon: '📦', label: t('navigation.purchaseOrders'), href: '/purchase-orders' },
        { icon: '🏷️', label: t('navigation.offer'),          href: '/offer' },
      ],
    },
    {
      label: t('navigation.groups.sales'),
      items: [
        { icon: '💰', label: t('navigation.pipeline'),    href: '/sales/leads' },
        { icon: '👥', label: t('navigation.customers'),   href: '/customers' },
        { icon: '📧', label: t('navigation.invoices'),    href: '/invoices' },
      ],
    },
    {
      label: t('navigation.groups.admin'),
      items: [
        { icon: '📈', label: t('navigation.analytics'),  href: '/analytics' },
        { icon: '📄', label: t('navigation.documents'),  href: '/documents' },
        { icon: '⚙',  label: t('navigation.settings'),  href: '/settings' },
        { icon: '📜', label: t('navigation.auditLog'),   href: '/audit-log' },
      ],
    },
  ];

  const loadLogo = () => {
    try {
      const profile = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
      setDealershipLogo(profile.logoDataUrl || null);
    } catch {
      setDealershipLogo(null);
    }
  };

  const loadUser = () => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const u = JSON.parse(raw);
    setUser(u);
    setAvatarUrl(u.avatarDataUrl || null);
  };

  useEffect(() => {
    loadUser();
    loadLogo();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dealership_profile') loadLogo();
      if (e.key === 'user') loadUser();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isActive = (href: string) =>
    pathname === href || (href === '/sales/leads' && pathname?.startsWith('/sales'));

  const handleSignOut = () => {
    localStorage.removeItem('user');
    router.replace('/auth/login');
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-[#0f1729] text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg text-lg"
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 h-screen bg-[#0b1524] text-slate-300 fixed left-0 top-0 flex flex-col z-40
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand accent bar */}
        <div className="h-0.75 bg-linear-to-r from-[#FF6B2C] via-[#ff9a6c] to-transparent shrink-0" />

        {/* Logo */}
        <div className="px-5 py-5 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-[#FF6B2C] rounded-lg flex items-center justify-center shrink-0">
              {/* Motorcycle SVG mark */}
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="white">
                <circle cx="4.5" cy="14.5" r="2" />
                <circle cx="15.5" cy="14.5" r="2" />
                <path d="M4.5 14.5H3.5a.5.5 0 0 1-.48-.36L2 10h5l.8 2.4H11L12.5 8H15l.5 1.5L13 11v2a.5.5 0 0 1-.5.5H7.5" />
                <path d="M7.5 10L9 7h3l.8 1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none tracking-tight">BikeMeNow</h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold tracking-widest uppercase">BikeMe.Now</p>
            </div>
          </Link>
          {/* Subscriber dealer badge — shows the current tenant's dealership name */}
          {user && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              {dealershipLogo ? (
                <img
                  src={dealershipLogo}
                  alt="logo"
                  className="w-8 h-8 rounded-md object-contain bg-white/10 shrink-0 p-0.5"
                />
              ) : (
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 leading-none mb-0.5">{t('navigation.subscribedDealer')}</p>
                <p className="text-xs text-white font-semibold truncate">
                  {user.dealershipName || user.dealership || 'My Dealership'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto space-y-5 pb-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-slate-600 tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`
                        relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${active
                          ? 'bg-[#FF6B2C]/10 text-[#FF6B2C]'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }
                      `}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#FF6B2C] rounded-r-full" />
                      )}
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF6B2C] shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Language */}
        <div className="px-4 py-3 border-t border-white/5 shrink-0">
          <LanguageSwitcher variant="default" />
        </div>

        {/* Legal footer */}
        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-slate-600 flex-wrap">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              {t('common.privacyPolicy')}
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">
              {t('common.terms')}
            </Link>
            <span>·</span>
            <span>556123-4567</span>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-2.5 mb-3">

            {/* Avatar — display only; change via Settings → Users */}
            <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#FF6B2C] flex items-center justify-center text-white text-sm font-bold">
                  {user ? (user.givenName?.[0] || user.name?.[0] || 'U') : 'U'}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-white font-semibold text-sm truncate">
                {user ? (user.givenName || user.name || t('common.user')) : t('common.user')}
              </div>
              <div className="text-[11px] text-slate-500">{t('common.admin')}</div>
            </div>

            <NotificationBell />
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-600/80 text-slate-400 hover:text-white text-sm font-medium transition-all"
          >
            <span>🚪</span> {t('common.signOut')}
          </button>
        </div>
      </aside>
    </>
  );
}
