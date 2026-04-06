'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';
import WebhookListener from './WebhookListener';
import BankIDModal from './bankIdModel';
import { getSupabaseBrowser } from '@/lib/supabase';
import { stopSupabaseSync } from '@/lib/realtime';
import { toast } from 'sonner';
import type { BankIDResult } from '@/types';


export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [dealershipLogo, setDealershipLogo] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [orgNr, setOrgNr] = useState('');
  const t = useTranslations();

  // ── Switch User modal state ──────────────────────────────────────────────────
  const [showSwitch,    setShowSwitch]    = useState(false);
  const [switchTab,     setSwitchTab]     = useState<'bankid' | 'email'>('bankid');
  const [showBankIDModal, setShowBankIDModal] = useState(false);
  const [switchEmail,   setSwitchEmail]   = useState('');
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchError,   setSwitchError]   = useState('');

  // Staff list for the two-step Switch User flow
  type StaffItem = { id: string; name: string; email: string; role: string; personal_number: string };
  const [staffList,     setStaffList]     = useState<StaffItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffItem | null>(null);
  const [loadingStaff,  setLoadingStaff]  = useState(false);

  const applySwitch = async (staffRow: { dealership_id: string; name: string; email: string; role: string }, extra?: Partial<any>) => {
    const dealershipName = user?.dealershipName ?? '';
    const newUser = {
      ...(extra ?? {}),
      name:           staffRow.name,
      givenName:      staffRow.name.split(' ')[0],
      email:          staffRow.email,
      role:           staffRow.role,
      dealershipId:   staffRow.dealership_id,
      dealershipName,
    };
    localStorage.setItem('user', JSON.stringify(newUser));
    await fetch('/api/auth/session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        dealershipId:   staffRow.dealership_id,
        dealershipName,
        name:           staffRow.name,
        email:          staffRow.email,
        role:           staffRow.role,
      }),
    });
    // Update sidebar display
    setUser(newUser);
    setAvatarUrl(null);
    setShowSwitch(false);
    setSwitchEmail('');
    setSwitchError('');
    router.refresh();
  };

  /** Step 1: open the modal and load the staff list */
  const openSwitchModal = async () => {
    setShowSwitch(true);
    setSelectedStaff(null);
    setSwitchTab('bankid');
    setSwitchError('');
    setSwitchEmail('');
    setLoadingStaff(true);
    try {
      const sb = getSupabaseBrowser() as any;
      const dealershipId = user?.dealershipId;
      if (!dealershipId) return;
      const { data } = await sb
        .from('staff_users')
        .select('id, name, email, role, personal_number')
        .eq('dealership_id', dealershipId)
        .eq('status', 'active')
        .order('name');
      setStaffList(data || []);
    } catch {
      setStaffList([]);
    } finally {
      setLoadingStaff(false);
    }
  };

  /** Step 2a: BankID confirmed — verify it matches the pre-selected user */
  const handleSwitchBankID = async (result: BankIDResult) => {
    setShowBankIDModal(false);
    setSwitchLoading(true);
    setSwitchError('');
    try {
      const sb = getSupabaseBrowser() as any;
      const { data: staffRow } = await sb
        .from('staff_users')
        .select('dealership_id, name, email, role, personal_number')
        .eq('personal_number', result.user.personalNumber)
        .maybeSingle();

      if (!staffRow) {
        const msg = 'No system user account found for this BankID.';
        setSwitchError(msg); toast.error(msg); return;
      }
      if (selectedStaff && staffRow.personal_number !== selectedStaff.personal_number) {
        const msg = `This BankID belongs to a different account. Please use ${selectedStaff.name}'s own BankID.`;
        setSwitchError(msg); toast.error(msg); return;
      }
      await applySwitch(staffRow, { ...result.user, bankidVerified: true });
    } catch {
      setSwitchError('Switch failed. Please try again.');
    } finally {
      setSwitchLoading(false);
    }
  };

  /** Step 2b: Email confirmed — verify it matches the pre-selected user */
  const handleSwitchEmail = async () => {
    if (!switchEmail.trim()) { setSwitchError('Please enter your email address.'); return; }
    setSwitchLoading(true);
    setSwitchError('');
    try {
      const sb = getSupabaseBrowser() as any;
      const email = switchEmail.trim().toLowerCase();
      const { data: staffRow } = await sb
        .from('staff_users')
        .select('dealership_id, name, email, role')
        .eq('email', email)
        .maybeSingle();

      if (!staffRow) {
        const msg = 'No system user account found for that email.';
        setSwitchError(msg); toast.error(msg); return;
      }
      if (selectedStaff && email !== selectedStaff.email.toLowerCase()) {
        const msg = `That email doesn't match ${selectedStaff.name}'s account.`;
        setSwitchError(msg); toast.error(msg); return;
      }
      await applySwitch(staffRow);
    } catch {
      setSwitchError('Switch failed. Please try again.');
    } finally {
      setSwitchLoading(false);
    }
  };

  const userRole = user?.role ?? 'admin';

  const isPlatformAdmin = userRole === 'platform_admin';

  const ALL_NAV_GROUPS = [
    // ── Platform admin only ──────────────────────────────────────────────────
    {
      labelKey: 'Platform',
      label: 'PLATFORM',
      items: [
        { icon: '🏢', label: 'All Dealerships',    href: '/admin',           roles: ['platform_admin'] },
        { icon: '🔐', label: 'System Admins',      href: '/admin/users',     roles: ['platform_admin'] },
        { icon: '📊', label: 'Platform Analytics', href: '/admin/analytics', roles: ['platform_admin'] },
        { icon: '💳', label: 'Subscriptions',      href: '/admin/billing',   roles: ['platform_admin'] },
        { icon: '⚙',  label: 'Platform Settings',  href: '/admin/settings',  roles: ['platform_admin'] },
      ],
    },
    // ── Dealer roles ─────────────────────────────────────────────────────────
    {
      labelKey: 'Core',
      label: t('navigation.groups.core'),
      items: [
        { icon: '📊', label: t('navigation.dashboard'),      href: '/dashboard',  roles: ['admin', 'sales', 'service'] },
        { icon: '🏷️', label: t('navigation.offer'),          href: '/offer', roles: ['admin', 'sales', 'service'] },
        { icon: '🏍', label: t('navigation.inventory'),       href: '/inventory',  roles: ['admin', 'sales', 'service'] },
        { icon: '📦', label: t('navigation.purchaseOrders'), href: '/purchase',   roles: ['admin', 'sales', 'service'] },
          { icon: '🚚', label: t('navigation.goodsReceipts'), href: '/goods-receipts',  roles: ['admin', 'sales', 'service'] },
        { icon: '🏭', label: t('navigation.suppliers'),       href: '/suppliers',  roles: ['admin', 'sales', 'service'] },
        { icon: '📧', label: t('navigation.purchaseinvoices'),    href: '/purchaseinvoice', roles: ['admin', 'sales', 'service'] },
      ],
    },
    {
      labelKey: 'Sales',
      label: t('navigation.groups.sales'),
      items: [
        { icon: '💰', label: t('navigation.pipeline'),  href: '/sales/leads', roles: ['admin', 'sales'] },
        { icon: '👥', label: t('navigation.customers'), href: '/customers',   roles: ['admin', 'sales', 'service'] },
        { icon: '📧', label: t('navigation.invoices'),  href: '/invoices',    roles: ['admin', 'sales', 'service'] },
        { icon: '🔧', label: t('navigation.service'),   href: '/service',     roles: ['admin', 'sales', 'service'] },
      ],
    },
    {
      labelKey: 'Admin',
      label: t('navigation.groups.admin'),
      items: [
        { icon: '📈', label: t('navigation.analytics'),  href: '/analytics',  roles: ['admin'] },
        { icon: '📒', label: t('navigation.accounting'), href: '/accounting', roles: ['admin'] },
        { icon: '📄', label: t('navigation.documents'),  href: '/documents',  roles: ['admin'] },
        { icon: '⚙',  label: t('navigation.settings'),  href: '/settings',   roles: ['admin'] },
        { icon: '📜', label: t('navigation.auditLog'),   href: '/audit-log',  roles: ['admin'] },
      ],
    },
  ];

  // Filter nav items and groups based on the current user's role
  const NAV_GROUPS = ALL_NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(userRole)),
    }))
    .filter(group => group.items.length > 0);

  const ROLE_LABELS: Record<string, string> = {
    admin:          t('common.admin'),
    sales:          t('common.sales'),
    service:        t('common.service'),
    platform_admin: 'Platform Admin',
  };

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

    try {
      const p = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
      // Profile name (from Supabase) is always authoritative over the login-time accounts cache
      if (p.name) u.dealershipName = p.name;
      setOrgNr(p.orgNr || u.orgNr || '');
    } catch {
      setOrgNr(u.orgNr || '');
    }

    setUser(u);
    setAvatarUrl(u.avatarDataUrl || null);
  };

  useEffect(() => {
    // Re-read localStorage on every route change so data is current immediately
    // after login (the effect runs on the auth page when user=null, then again
    // when pathname changes to /dashboard after prefetchDealerProfile completes).
    loadUser();
    loadLogo();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'dealership_profile') { loadLogo(); loadUser(); }
      if (e.key === 'user') loadUser();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ── Fallback: populate dealershipName whenever it is missing ────────────────
  // Priority 1 — localStorage cache (written by prefetchDealerProfile on login,
  //   covers the timing gap where loadUser() ran BEFORE prefetchDealerProfile
  //   finished writing to localStorage).
  // Priority 2 — live Supabase query (covers prefetchDealerProfile failure).
  useEffect(() => {
    const dealershipId = user?.dealershipId;
    if (!dealershipId || user?.role === 'platform_admin') return;

    // If the user state already carries a dealership name we're done
    if (user?.dealershipName) return;

    // Priority 1: check localStorage cache synchronously — avoids an async
    // round-trip when prefetchDealerProfile already wrote the data
    try {
      const cached = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
      if (cached.name) {
        setUser((u: any) => u ? { ...u, dealershipName: cached.name } : u);
        setOrgNr(cached.orgNr || '');
        setDealershipLogo(cached.logoDataUrl || null);
        window.dispatchEvent(new StorageEvent('storage', { key: 'dealership_profile' }));
        return;
      }
    } catch { /* ignore */ }

    // Priority 2: fetch live from Supabase (prefetchDealerProfile must have failed)
    const sb = getSupabaseBrowser() as any;
    sb.from('dealership_settings')
      .select('name,logo_data_url,cover_image_data_url,org_nr,city,county,email_domain')
      .eq('dealership_id', dealershipId)
      .maybeSingle()
      .then(({ data: ds }: any) => {
        if (ds?.name) {
          setUser((u: any) => u ? { ...u, dealershipName: ds.name } : u);
          setOrgNr(ds.org_nr || '');
          setDealershipLogo(ds.logo_data_url || null);
          const existing = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
          const merged = { ...existing, name: ds.name, orgNr: ds.org_nr || '', logoDataUrl: ds.logo_data_url || '', coverImageDataUrl: ds.cover_image_data_url || '', city: ds.city || '', county: ds.county || '' };
          localStorage.setItem('dealership_profile', JSON.stringify(merged));
          window.dispatchEvent(new StorageEvent('storage', { key: 'dealership_profile' }));
          return;
        }
        // Fall back to dealerships table
        sb.from('dealerships')
          .select('*')
          .eq('id', dealershipId)
          .maybeSingle()
          .then(({ data: dl }: any) => {
            if (!dl?.name) return;
            setUser((u: any) => u ? { ...u, dealershipName: dl.name } : u);
            setDealershipLogo(dl.logo_data_url || null);
            const existing = JSON.parse(localStorage.getItem('dealership_profile') || '{}');
            const merged = { ...existing, name: dl.name, orgNr: dl.org_nr || '', logoDataUrl: dl.logo_data_url || '' };
            localStorage.setItem('dealership_profile', JSON.stringify(merged));
            window.dispatchEvent(new StorageEvent('storage', { key: 'dealership_profile' }));
          })
          .catch(() => {/* ignore */});
      })
      .catch(() => {/* ignore */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.dealershipId, user?.dealershipName]);

  // Hide on auth and public pages
  const AUTH_PATHS = ['/auth', '/privacy', '/terms'];
  if (AUTH_PATHS.some(p => pathname?.startsWith(p))) return null;

  const isActive = (href: string) =>
    pathname === href || (href === '/sales/leads' && pathname?.startsWith('/sales'));

  const handleSignOut = async () => {
    // Stop Supabase Realtime — prevents dealer A's events reaching dealer B
    stopSupabaseSync();

    // Clear ALL dealer-specific localStorage keys so the next dealer starts fresh
    const DEALER_KEYS = [
      'dealership_profile',
      'staff_users',
      'accounts',
      'billing_prefs',
      'quickstart_skipped',
    ];
    DEALER_KEYS.forEach(k => localStorage.removeItem(k));

    // Clear dynamic keys: agreement drafts, notification prefs, etc.
    Object.keys(localStorage)
      .filter(k => k.startsWith('agreement_') || k.startsWith('notification_'))
      .forEach(k => localStorage.removeItem(k));

    // Destroy the server-side session cookie, then clear user identity
    await fetch('/api/auth/session', { method: 'DELETE' });
    localStorage.removeItem('user');
    router.replace('/auth/login');
  };

  return (
    <>
      {/* Supabase Realtime webhook listener — invisible, always mounted while logged in */}
      <WebhookListener />

      {/* BankID modal for switch-user flow */}
      {showBankIDModal && (
        <BankIDModal
          onComplete={handleSwitchBankID}
          onCancel={() => setShowBankIDModal(false)} mode={'auth'}        />
      )}

      {/* Switch User modal */}
      {showSwitch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { setShowSwitch(false); setSelectedStaff(null); setSwitchError(''); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 bg-[#0f1b2d] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            {!selectedStaff ? (
              /* ── Step 1: pick a user ── */
              <>
                <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">Switch User</p>
                    <p className="text-slate-500 text-xs mt-0.5">Select who you are</p>
                  </div>
                  <button
                    onClick={() => { setShowSwitch(false); setSwitchError(''); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                  >✕</button>
                </div>

                <div className="px-3 py-3 space-y-1 max-h-80 overflow-y-auto">
                  {loadingStaff ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : staffList.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">No active users found.</p>
                  ) : staffList.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedStaff(s); setSwitchError(''); setSwitchEmail(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#FF6B2C]/20 flex items-center justify-center text-[#FF6B2C] font-bold text-sm shrink-0">
                        {s.name[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{s.name}</p>
                        <p className="text-slate-500 text-xs truncate">{s.email}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        s.role === 'admin'   ? 'bg-purple-500/20 text-purple-400' :
                        s.role === 'sales'   ? 'bg-[#FF6B2C]/20 text-[#FF6B2C]'  :
                                               'bg-blue-500/20  text-blue-400'
                      }`}>{s.role}</span>
                      <span className="text-slate-600 group-hover:text-slate-300 text-sm ml-1 transition-colors">→</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* ── Step 2: verify identity ── */
              <>
                <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => { setSelectedStaff(null); setSwitchError(''); setSwitchEmail(''); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors text-base"
                    >←</button>
                    <div>
                      <p className="text-white font-bold text-sm">Verify identity</p>
                      <p className="text-slate-500 text-xs mt-0.5">Confirm it's you to switch</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowSwitch(false); setSelectedStaff(null); setSwitchError(''); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                  >✕</button>
                </div>

                {/* Selected user chip */}
                <div className="px-5 pt-4 pb-1">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#FF6B2C]/20 flex items-center justify-center text-[#FF6B2C] font-bold text-sm shrink-0">
                      {selectedStaff.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{selectedStaff.name}</p>
                      <p className="text-slate-500 text-xs truncate">{selectedStaff.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      selectedStaff.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                      selectedStaff.role === 'sales' ? 'bg-[#FF6B2C]/20 text-[#FF6B2C]'  :
                                                       'bg-blue-500/20  text-blue-400'
                    }`}>{selectedStaff.role}</span>
                  </div>
                </div>

                {/* Method tabs */}
                <div className="flex border-b border-white/5 mt-3">
                  {(['bankid', 'email'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => { setSwitchTab(tab); setSwitchError(''); }}
                      className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                        switchTab === tab
                          ? 'text-[#FF6B2C] border-b-2 border-[#FF6B2C]'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tab === 'bankid' ? '🆔 BankID' : '📧 Email'}
                    </button>
                  ))}
                </div>

                <div className="px-5 py-5 space-y-4">
                  {switchError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {switchError}
                    </p>
                  )}
                  {switchTab === 'bankid' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Sign in as <span className="text-white font-medium">{selectedStaff.name}</span> using your BankID to confirm.
                      </p>
                      <button
                        disabled={switchLoading}
                        onClick={() => setShowBankIDModal(true)}
                        className="w-full bg-[#235971] hover:bg-[#1a4557] disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        {switchLoading
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Switching…</>
                          : <><span className="text-base">🆔</span> Open BankID</>
                        }
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Your email address</label>
                        <input
                          type="email"
                          value={switchEmail}
                          onChange={e => { setSwitchEmail(e.target.value); setSwitchError(''); }}
                          onKeyDown={e => e.key === 'Enter' && handleSwitchEmail()}
                          placeholder={selectedStaff.email}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#FF6B2C]/50 focus:ring-1 focus:ring-[#FF6B2C]/30"
                        />
                      </div>
                      <button
                        disabled={switchLoading}
                        onClick={handleSwitchEmail}
                        className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {switchLoading
                          ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Switching…</>
                          : 'Confirm & Switch →'
                        }
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}


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
          <Link href={isPlatformAdmin ? '/admin' : '/dashboard'} className="flex items-center mb-3 hover:opacity-80 transition-opacity">
            <div className="bg-white rounded-lg p-1 shrink-0">
              <img
                src="/BikeMeNow_logo_test.png"
                alt="BikeMeNow"
                className="h-10 w-auto object-contain"
              />
            </div>
          </Link>
          {/* Badge — platform admin vs subscriber dealer */}
          {user && (
            isPlatformAdmin ? (
              <div className="flex items-center gap-2 bg-[#FF6B2C]/10 border border-[#FF6B2C]/30 rounded-lg px-3 py-2">
                <span className="text-lg shrink-0">🌐</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#FF6B2C] font-bold leading-none mb-0.5 tracking-wider">PLATFORM OWNER</p>
                  <p className="text-xs text-white font-semibold truncate">bikeme.now</p>
                </div>
              </div>
            ) : (
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
            )
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
            {orgNr && <span>{orgNr}</span>}

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

              <div className="text-[11px] text-slate-500">{ROLE_LABELS[userRole] ?? t('common.admin')}</div>

            </div>

            <NotificationBell />
          </div>
          <div className="flex gap-2">
            <button
              onClick={openSwitchModal}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-medium transition-all"
              title="Switch to a different user account"
            >
              <span>🔄</span> Switch User
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-600/80 text-slate-400 hover:text-white text-xs font-medium transition-all"
            >
              <span>🚪</span> {t('common.signOut')}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

