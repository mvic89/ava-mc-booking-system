'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import BankIDModal from '@/components/bankIdModel';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { toast } from 'sonner';
import { getSupabaseBrowser } from '@/lib/supabase';
import { emit } from '@/lib/realtime';
import { verifyPassword } from '@/lib/password';
import type { BankIDResult } from '@/types';

type UserRole = 'admin' | 'sales' | 'service' | 'platform_admin';

interface StaffRow {
  role:            UserRole;
  dealership_id:   string | null;
  name:            string;
  email:           string;
  password_hash:   string | null;
  bankid_verified: boolean;
}

/**
 * Fetch the dealer's profile from Supabase and cache it in localStorage so the
 * Sidebar (name, logo) and other components can render immediately after login.
 */
async function prefetchDealerProfile(dealershipId: string): Promise<void> {
  try {
    const { data } = await (getSupabaseBrowser() as any)
      .from('dealership_settings')
      .select('name,org_nr,vat_nr,f_skatt,street,postal_code,city,county,phone,email,email_domain,website,bankgiro,swish,logo_data_url,cover_image_data_url')
      .eq('dealership_id', dealershipId)
      .maybeSingle();
    if (!data) return;
    localStorage.setItem('dealership_profile', JSON.stringify({
      name:              data.name                  ?? '',
      orgNr:             data.org_nr                ?? '',
      vatNr:             data.vat_nr                ?? '',
      fSkatt:            data.f_skatt               ?? true,
      street:            data.street                ?? '',
      postalCode:        data.postal_code           ?? '',
      city:              data.city                  ?? '',
      county:            data.county                ?? 'Stockholm',
      phone:             data.phone                 ?? '',
      email:             data.email                 ?? '',
      emailDomain:       data.email_domain          ?? '',
      website:           data.website               ?? '',
      bankgiro:          data.bankgiro              ?? '',
      swish:             data.swish                 ?? '',
      logoDataUrl:       data.logo_data_url         ?? '',
      coverImageDataUrl: data.cover_image_data_url  ?? '',
    }));
  } catch { /* non-fatal — profile page will load it on first visit */ }
}

/** Create the server-side httpOnly session cookie. */
async function createSession(payload: {
  dealershipId:   string;
  dealershipName: string;
  name:           string;
  email:          string;
  role:           UserRole;
}) {
  await fetch('/api/auth/session', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
}

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations();
  const [showBankID, setShowBankID] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberDevice: false,
  });

  // Redirect if already logged in
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) router.replace('/dashboard');
  }, [router]);

  // ── BankID login ──────────────────────────────────────────────────────────
  const handleBankIDComplete = async (result: BankIDResult) => {
    setShowBankID(false);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      // Look up this personal number in Supabase to get the real dealershipId
      const { data: staffRow } = await (supabase as any)
        .from('staff_users')
        .select('role, dealership_id, name, email')
        .eq('personal_number', result.user.personalNumber)
        .maybeSingle() as { data: StaffRow | null };

      // If found in DB, use those values; otherwise fall back to accounts store (bootstrap)
      const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
      const anyAccount = (Object.values(accounts)[0] as any) ?? {};

      // Reject the login if the BankID personal number is not registered in the system
      if (!staffRow && !anyAccount.dealershipId) {
        setLoginError(
          'Your BankID is not registered in the system. Please contact your administrator or sign up for an account.',
        );
        return;
      }

      const role: UserRole         = staffRow?.role         ?? 'admin';
      const dealershipId: string   = staffRow?.dealership_id ?? anyAccount.dealershipId ?? '';
      const dealershipName: string = role === 'platform_admin' ? 'BikeMeNow Platform' : (anyAccount.dealershipName ?? '');
      const email: string          = staffRow?.email         ?? anyAccount.email ?? '';
      const name: string           = result.user.givenName   ?? staffRow?.name ?? '';

      // Persist to localStorage (UI reads from here)
      localStorage.setItem('user', JSON.stringify({
        ...result.user,
        roaring:        (result as any).roaring ?? null,
        email,
        dealershipName,
        dealershipId,
        role,
      }));
      // Signal all contexts to reload with the new dealer's data
      emit({ type: 'data:refresh' });

      // Create server-side httpOnly session cookie — this is what protects routes
      await createSession({ dealershipId, dealershipName, name, email, role });

      // Update last_login in Supabase
      if (staffRow) {
        await (supabase as any)
          .from('staff_users')
          .update({ last_login: new Date().toISOString(), bankid_verified: true })
          .eq('personal_number', result.user.personalNumber);
      }

      // Platform admin goes to the admin dashboard; regular staff go to their dealer dashboard
      if (role === 'platform_admin') {
        router.replace('/admin');
        return;
      }

      // Pre-load dealer profile so Sidebar shows name/logo immediately
      await prefetchDealerProfile(dealershipId);

      router.replace('/dashboard');
    } catch (err: any) {
      setLoginError('Login failed. Please try again.');
      console.error('[login] BankID complete error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Email login ───────────────────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const supabase = getSupabaseBrowser();

      // Fetch staff record including password_hash and bankid_verified
      const { data: staffRow, error } = await (supabase as any)
        .from('staff_users')
        .select('role, dealership_id, name, email, password_hash, bankid_verified')
        .eq('email', formData.email.toLowerCase().trim())
        .maybeSingle() as { data: StaffRow | null; error: any };

      if (error) throw error;

      // Fallback to localStorage accounts for bootstrap (before any staff_users exist in DB)
      const accounts      = JSON.parse(localStorage.getItem('accounts') || '{}');
      const registered    = accounts[formData.email];
      const anyAccount    = (Object.values(accounts)[0] as any) ?? {};
      const hasNoAccounts = Object.keys(accounts).length === 0;

      // ── Case 1: Not in system at all ─────────────────────────────────────
      if (!staffRow && !registered && !hasNoAccounts) {
        const msg = 'This email is not registered in the system. Please contact your administrator.';
        setLoginError(msg);
        toast.error('Account not found', { description: msg });
        return;
      }
      if (!staffRow && hasNoAccounts) {
        const msg = 'No accounts found. Please sign up or contact your administrator.';
        setLoginError(msg);
        toast.error('Account not found', { description: msg });
        return;
      }

      // ── Case 2: Supabase user with a password hash — verify it ───────────
      if (staffRow?.password_hash) {
        if (!verifyPassword(formData.password, staffRow.password_hash)) {
          setLoginError('Incorrect password. Please try again or use "Forgot password?".');
          return;
        }
      }

      // ── Case 3: BankID-registered user with no password set ──────────────
      if (staffRow && !staffRow.password_hash && staffRow.bankid_verified) {
        const msg = 'You registered via BankID. Sign in with BankID above, or click "Forgot password?" to set an email password.';
        setLoginError(msg);
        return;
      }

      // ── Proceed with login ────────────────────────────────────────────────
      const role: UserRole         = staffRow?.role          ?? registered?.role ?? 'admin';
      const dealershipId: string   = staffRow?.dealership_id ?? registered?.dealershipId ?? anyAccount.dealershipId ?? '';
      const dealershipName: string = role === 'platform_admin' ? 'BikeMeNow Platform' : (registered?.dealershipName ?? anyAccount.dealershipName ?? '');
      const name: string           = staffRow?.name          ?? registered?.name ?? formData.email.split('@')[0];

      // Persist to localStorage
      const userObj = registered
        ? { ...registered, role, dealershipId, dealershipName }
        : { name, email: formData.email, role, dealershipId, dealershipName };
      localStorage.setItem('user', JSON.stringify(userObj));
      // Signal all contexts to reload with the new dealer's data
      emit({ type: 'data:refresh' });

      // Create server-side httpOnly session cookie
      await createSession({
        dealershipId,
        dealershipName,
        name,
        email: formData.email,
        role,
      });

      // Update last_login in Supabase if the staff record exists
      if (staffRow) {
        await (supabase as any)
          .from('staff_users')
          .update({ last_login: new Date().toISOString() })
          .eq('email', formData.email.toLowerCase().trim());
      }

      // Platform admin goes to the admin dashboard; regular staff go to their dealer dashboard
      if (role === 'platform_admin') {
        router.replace('/admin');
        return;
      }

      // Pre-load dealer profile so Sidebar shows name/logo immediately
      await prefetchDealerProfile(dealershipId);

      router.replace('/dashboard');
    } catch (err: any) {
      setLoginError('Login failed. Please try again.');
      console.error('[login] Email login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: '⚡', label: t('login.branding.zeroInput'),  desc: t('login.branding.zeroInputDesc') },
    { icon: '🔒', label: t('login.branding.secured'),    desc: t('login.branding.securedDesc')   },
    { icon: '📊', label: t('login.branding.analytics'),  desc: t('login.branding.analyticsDesc') },
    { icon: '🏍',  label: t('login.branding.dealers'),   desc: t('login.branding.dealersDesc')   },
  ];

  const stats = [
    { value: '47+',   label: 'Dealers'  },
    { value: '4.9★',  label: 'Rating'   },
    { value: '99.9%', label: 'Uptime'   },
  ];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">

      {/* ── Left panel — dark hero ─────────────────────────────────────────── */}
      <div className="hidden md:flex md:w-[48%] bg-[#0a1628] text-white flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#FF6B2C] opacity-[0.08] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-600 opacity-[0.06] rounded-full blur-3xl pointer-events-none" />

        {/* Logo mark */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-[#FF6B2C] flex items-center justify-center shrink-0">
            <span className="text-white font-black text-lg leading-none">B</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">BikeMeNow</span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 my-auto">
          <h1 className="text-4xl lg:text-5xl font-black leading-[1.1] mb-4">
            Run your dealership.<br />
            <span className="text-[#FF6B2C]">Smarter, faster.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-12 max-w-sm leading-relaxed">
            {t('login.branding.tagline')}
          </p>

          <div className="space-y-5">
            {features.map(f => (
              <div key={f.label} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{f.label}</p>
                  <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex gap-8 mt-12">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600 relative z-10">{t('login.branding.copyright')}</p>
      </div>

      {/* ── Right panel — login form ───────────────────────────────────────── */}
      <div className="flex-1 bg-[#f8fafc] flex items-center justify-center p-6 md:p-12 relative">

        {/* Language switcher */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6">
          <LanguageSwitcher variant="compact" />
        </div>

        {/* Mobile wordmark */}
        <div className="md:hidden absolute top-4 left-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FF6B2C] flex items-center justify-center">
            <span className="text-white font-black text-sm leading-none">B</span>
          </div>
          <span className="font-bold text-slate-900 text-sm">BikeMeNow</span>
        </div>

        <div className="w-full max-w-md mt-12 md:mt-0">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">{t('login.title')}</h2>
            <p className="text-slate-500 text-sm">{t('login.subtitle')}</p>
          </div>

          {/* BankID */}
          <button
            onClick={() => setShowBankID(true)}
            disabled={loading}
            className="w-full bg-[#1a3a4a] hover:bg-[#142e3a] active:scale-[0.99] text-white py-3.5 rounded-xl font-semibold mb-1.5 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 shadow-sm"
          >
            <span className="text-lg">🆔</span>
            {t('login.signInWithBankID')}
          </button>
          <p className="text-center text-[11px] text-slate-400 mb-6 font-medium tracking-wide uppercase">
            {t('login.recommended')}
          </p>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#f8fafc] text-[11px] text-slate-400 font-semibold uppercase tracking-widest">
                {t('login.or')}
              </span>
            </div>
          </div>

          {/* Error */}
          {loginError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {loginError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                {t('login.emailAddress')}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#FF6B2C] focus:ring-2 focus:ring-[#FF6B2C]/20 outline-none text-slate-900 placeholder:text-slate-300 transition-all"
                placeholder="namn@aterforsaljare.se"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                {t('login.password')}
              </label>
              <PasswordInput
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rememberDevice}
                  onChange={(e) => setFormData({ ...formData, rememberDevice: e.target.checked })}
                  className="w-4 h-4 accent-[#FF6B2C] border-slate-300 rounded"
                />
                <span className="text-sm text-slate-600">{t('login.rememberDevice')}</span>
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-[#FF6B2C] font-semibold hover:underline">
                {t('login.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] active:scale-[0.99] text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-60 shadow-sm mt-1"
            >
              {loading ? 'Signing in…' : t('login.signIn')}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            {t('login.security')}
          </p>

          <p className="text-center text-sm text-slate-500 mt-8">
            {t('login.noAccount')}{' '}
            <Link href="/auth/signup" className="text-[#FF6B2C] font-bold hover:underline">
              Start free trial →
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
