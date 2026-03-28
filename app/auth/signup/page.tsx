'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import PhoneInput from '@/components/PhoneInput';
import PasswordInput from '@/components/PasswordInput';
import { supabase } from '@/lib/supabase';
import { isValidEmail, isValidPhone, isValidOrgNumber, isValidWebsite } from '@/lib/validation';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';

type Plan = 'starter' | 'professional' | 'enterprise';
type Step = 0 | 1 | 2 | 3 | 4;

const PLANS = {
  starter: {
    name: 'Starter',
    price: '2,995 kr',
    description: 'Perfect for small dealerships',
    features: ['Up to 50 vehicles', '2 team members', 'Basic reporting', 'Email support', 'Mobile app access', 'Blocket integration'],
  },
  professional: {
    name: 'Professional',
    price: '5,995 kr',
    description: 'For growing dealerships',
    features: ['Up to 200 vehicles', 'Unlimited team members', 'Advanced analytics', 'Priority support', 'API access', 'All integrations', 'Custom workflows'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large dealerships',
    features: ['Unlimited vehicles', 'Unlimited users', 'Dedicated account manager', '24/7 phone support', 'Custom integrations', 'SLA guarantee'],
  },
};

const QUICK_START = [
  { key: 'motorcycle',    icon: '🏍', title: '1. Add your first motorcycle',  desc: 'Get started with inventory management',                                    href: '/inventory' },
  { key: 'team',          icon: '👥', title: '2. Invite your team',           desc: 'Collaborate with sales and service staff',                                 href: '/settings/users' },
  { key: 'integrations',  icon: '🔌', title: '3. Connect integrations',       desc: 'Configure payment modules (Klarna, Svea, Swish, BankID) in Settings',     href: '/settings' },
  { key: 'lead',          icon: '💰', title: '4. Create your first lead',      desc: 'Start managing your sales pipeline',                                       href: '/sales/leads/new' },
];


export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations('signup');
  const [step, setStep] = useState<Step>(0);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('professional');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [adminVerified, setAdminVerified] = useState<BankIDResult | null>(null);
  const [showAdminBankID, setShowAdminBankID] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) router.replace('/dashboard');
  }, [router]);

  // Load skipped items from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('quickstart_skipped') || '[]');
      setSkipped(new Set(saved));
    } catch {}
  }, []);

  // Warn before leaving mid-signup (steps 1-3)
  useEffect(() => {
    if (step === 0 || step === 4) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [step]);

  const [business, setBusiness] = useState({
    dealershipName: '', orgNumber: '', streetAddress: '',
    postalCode: '', city: '', phone: '', website: '',
  });

  // ── Postal code → city auto-lookup ──────────────────────────────────────────
  const [postalLookup, setPostalLookup] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');

  useEffect(() => {
    const digits = business.postalCode.replace(/\D/g, '');
    if (digits.length !== 5) { setPostalLookup('idle'); return; }

    setPostalLookup('loading');
    const timer = setTimeout(async () => {
      try {
        // Server-side proxy — tries zippopotam.us → Nominatim → Nominatim free-text
        const res = await fetch(`/api/postal-lookup?code=${digits}`);
        const { city: cityName } = res.ok ? await res.json() : { city: null };

        if (cityName) {
          setBusiness(b => ({
            ...b,
            city: b.city || cityName, // only fill if user hasn't typed one
          }));
          setPostalLookup('found');
          setErrors(e => ({ ...e, city: '', postalCode: '' }));
        } else {
          setPostalLookup('notfound');
        }
      } catch {
        setPostalLookup('notfound');
      }
    }, 400); // 400 ms debounce

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.postalCode]);
  const [admin, setAdmin] = useState({
    fullName: '', email: '', mobile: '',
    password: '', confirmPassword: '', agreeToTerms: false,
  });
  // OTP email verification (Step 3)
  const [otpToken,   setOtpToken]   = useState('');
  const [otpCode,    setOtpCode]    = useState('');
  const [otpSending, setOtpSending] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (!business.dealershipName.trim()) e.dealershipName = 'Required';
    if (!business.orgNumber.trim())
      e.orgNumber = 'Required';
    else if (!isValidOrgNumber(business.orgNumber))
      e.orgNumber = 'Enter a valid org number (e.g. 556123-4567)';
    if (!business.streetAddress.trim())  e.streetAddress  = 'Required';
    if (!business.postalCode.trim())
      e.postalCode = 'Required';
    else if (business.postalCode.replace(/\D/g, '').length !== 5)
      e.postalCode = 'Enter a valid 5-digit postal code';
    if (!business.city.trim())           e.city           = 'Required';
    if (!business.phone.trim())
      e.phone = 'Required';
    else if (!isValidPhone(business.phone))
      e.phone = 'Enter a valid phone number (at least 7 digits)';
    if (business.website.trim() && !isValidWebsite(business.website))
      e.website = 'Enter a valid URL (e.g. https://yoursite.com)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {};
    // Name is auto-filled from BankID — only required when filling manually
    if (!adminVerified && !admin.fullName.trim()) e.fullName = 'Required';
    if (!admin.email.trim())        e.email    = 'Required';
    else if (!isValidEmail(admin.email)) e.email = 'Enter a valid email address (e.g. name@domain.com)';
    if (!admin.mobile.trim())       e.mobile   = 'Required';
    else if (!isValidPhone(admin.mobile)) e.mobile = 'Enter a valid phone number (at least 7 digits)';
    // Password fields are only needed when NOT using BankID
    if (!adminVerified) {
      if (!admin.password)            e.password = 'Required';
      else if (admin.password.length < 8) e.password = 'Minimum 8 characters';
      if (!admin.confirmPassword)     e.confirmPassword = 'Required';
      else if (admin.password !== admin.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    if (!admin.agreeToTerms)        e.agreeToTerms = 'You must agree to the terms to continue';
    setErrors(e);
    return Object.keys(e).length === 0;
  }


  // ── Quick Start helpers ──────────────────────────────────────────────────────

  function handleSkip(key: string) {
    const updated = new Set(skipped);
    updated.add(key);
    setSkipped(updated);
    localStorage.setItem('quickstart_skipped', JSON.stringify([...updated]));
  }

  // Helper: field class with red outline when there's an error
  function fc(field: string) {
    return `w-full px-4 py-3 rounded-lg border ${
      errors[field]
        ? 'border-red-400 focus:ring-red-400 bg-red-50'
        : 'border-slate-300 focus:border-[#FF6B2C] focus:ring-[#FF6B2C]'
    } focus:ring-1 outline-none text-sm`;
  }

  // 14-day trial end date
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  const trialEndStr = trialEnd.toLocaleDateString('en-SE', { day: 'numeric', month: 'long', year: 'numeric' });

  const progressPct = step === 0 ? 0 : step === 4 ? 100 : (step / 4) * 100;

  // ── Step 0: Pricing ─────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white">
          <div className="bg-white rounded-xl px-2 py-1 border border-slate-100">
            <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-7 w-auto object-contain" />
          </div>
          <Link href="/auth/login" className="text-[#FF6B2C] text-sm font-medium hover:underline">
            {t('alreadyHaveAccount')} {t('signIn')} →
          </Link>
        </nav>

        {/* Hero */}
        <div className="text-center pt-14 pb-10 px-4">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Start Your Free Trial</h1>
          <p className="text-slate-500 text-base">No credit card required • 14 days free • Cancel anytime</p>
        </div>

        {/* Plan cards */}
        <div className="flex flex-col md:flex-row gap-6 max-w-5xl mx-auto px-6 pb-12 items-stretch justify-center">
          {/* Starter */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Starter</h3>
            <p className="text-slate-500 text-sm mb-6">Perfect for small dealerships</p>
            <div className="mb-5">
              <span className="text-4xl font-bold text-slate-900">2,995 kr</span>
              <span className="text-slate-400 text-sm ml-1">/ month</span>
            </div>
            <button
              onClick={() => { setSelectedPlan('starter'); setStep(1); }}
              className="w-full border-2 border-[#FF6B2C] text-[#FF6B2C] py-3 rounded-xl font-semibold hover:bg-orange-50 transition-colors mb-7"
            >
              Start Free Trial
            </button>
            <ul className="space-y-3 flex-1">
              {PLANS.starter.features.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Professional — Popular */}
          <div className="flex-1 bg-[#0b1524] rounded-2xl p-8 flex flex-col relative shadow-2xl md:scale-105 md:-my-2">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-amber-400 text-amber-900 text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider">
                Popular
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Professional</h3>
            <p className="text-slate-400 text-sm mb-6">For growing dealerships</p>
            <div className="mb-5">
              <span className="text-4xl font-bold text-white">5,995 kr</span>
              <span className="text-slate-400 text-sm ml-1">/ month</span>
            </div>
            <button
              onClick={() => { setSelectedPlan('professional'); setStep(1); }}
              className="w-full bg-[#FF6B2C] text-white py-3 rounded-xl font-semibold hover:bg-[#e55a1f] transition-colors mb-7"
            >
              Start Free Trial
            </button>
            <ul className="space-y-3 flex-1">
              {PLANS.professional.features.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Enterprise */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 flex flex-col">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Enterprise</h3>
            <p className="text-slate-500 text-sm mb-6">For large dealerships</p>
            <div className="mb-5">
              <span className="text-4xl font-bold text-slate-900">Custom</span>
              <p className="text-slate-400 text-sm mt-1">contact us for pricing</p>
            </div>
            <button
              onClick={() => toast.success('Our sales team will reach out shortly!')}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors mb-7"
            >
              Contact Sales
            </button>
            <ul className="space-y-3 flex-1">
              {PLANS.enterprise.features.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer trust bar */}
        <div className="text-center pb-12 text-sm text-slate-400 space-x-4">
          <span>🔒 Bank-level security</span>
          <span>•</span>
          <span>💳 Secure payments</span>
          <span>•</span>
          <span>📞 Swedish support</span>
        </div>
      </div>
    );
  }

  // ── Steps 1–4: Shared wrapper ────────────────────────────────────────────────
  const plan = PLANS[selectedPlan];

  return (
    <>
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Slim nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-white">
        <div className="bg-white rounded-xl px-2 py-1 border border-slate-100">
            <img src="/BikeMeNow_logo_test.png" alt="BikeMeNow" className="h-7 w-auto object-contain" />
          </div>
        <Link href="/auth/login" className="text-slate-500 text-sm hover:text-slate-700">
          {t('alreadyHaveAccount')} <span className="text-[#FF6B2C] font-medium">{t('signIn')} →</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center px-4 py-10">
        {/* Progress indicator */}
        <div className="w-full max-w-lg mb-8">
          <div className="text-center text-sm mb-3 font-medium">
            {step === 4
              ? <span className="text-green-600">Complete! ✓</span>
              : <span className="text-slate-500">Step {step} of 4</span>
            }
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${step === 4 ? 'bg-green-500' : 'bg-[#FF6B2C]'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* ── Step 1: Business Info ── */}
        {step === 1 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Tell us about your business</h2>
              <p className="text-slate-500 text-sm mb-7">We'll use this to set up your account</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Dealership Name *</label>
                  <input
                    type="text"
                    value={business.dealershipName}
                    onChange={e => { setBusiness({ ...business, dealershipName: e.target.value }); setErrors(p => ({ ...p, dealershipName: '' })); }}
                    placeholder="e.g., Stockholm Motorcycles AB"
                    className={fc('dealershipName')}
                  />
                  {errors.dealershipName && <p className="text-xs text-red-500 mt-1">{errors.dealershipName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Organization Number *</label>
                  <input
                    type="text"
                    value={business.orgNumber}
                    onChange={e => {
                      // Auto-format as XXXXXX-XXXX (strip non-digits, insert dash after 6)
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      const formatted = digits.length > 6 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : digits;
                      setBusiness({ ...business, orgNumber: formatted });
                      setErrors(p => ({ ...p, orgNumber: '' }));
                    }}
                    placeholder="556123-4567"
                    maxLength={11}
                    className={fc('orgNumber')}
                  />
                  {errors.orgNumber && <p className="text-xs text-red-500 mt-1">{errors.orgNumber}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Street Address *</label>
                  <input
                    type="text"
                    value={business.streetAddress}
                    onChange={e => { setBusiness({ ...business, streetAddress: e.target.value }); setErrors(p => ({ ...p, streetAddress: '' })); }}
                    placeholder="Street name and number"
                    className={fc('streetAddress')}
                  />
                  {errors.streetAddress && <p className="text-xs text-red-500 mt-1">{errors.streetAddress}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Postal Code *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={business.postalCode}
                        onChange={e => {
                          // Auto-format as "XXX XX"
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 5);
                          const fmt = raw.length > 3 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw;
                          setBusiness({ ...business, postalCode: fmt, city: '' });
                          setPostalLookup('idle');
                          setErrors(p => ({ ...p, postalCode: '', city: '' }));
                        }}
                        placeholder="XXX XX"
                        maxLength={6}
                        className={fc('postalCode')}
                      />
                      {postalLookup === 'loading' && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {errors.postalCode && <p className="text-xs text-red-500 mt-1">{errors.postalCode}</p>}
                    {postalLookup === 'notfound' && (
                      <p className="text-xs text-amber-600 mt-1">Postal code not found — please enter city manually.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      City *
                      {postalLookup === 'found' && (
                        <span className="text-[10px] font-normal text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                          Auto-detected
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={business.city}
                      onChange={e => { setBusiness({ ...business, city: e.target.value }); setErrors(p => ({ ...p, city: '' })); }}
                      placeholder={postalLookup === 'loading' ? 'Detecting…' : 'e.g., Stockholm'}
                      className={fc('city')}
                    />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number *</label>
                  <PhoneInput
                    value={business.phone}
                    onChange={v => { setBusiness({ ...business, phone: v }); setErrors(p => ({ ...p, phone: '' })); }}
                    className={`rounded-lg border ${errors.phone ? 'border-red-400 bg-red-50 focus-within:ring-red-400' : 'border-slate-300 focus-within:border-[#FF6B2C] focus-within:ring-[#FF6B2C]'} focus-within:ring-1 transition-all`}
                    inputClassName="py-3 text-sm"
                  />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Website (optional)</label>
                  <input
                    type="text"
                    value={business.website}
                    onChange={e => { setBusiness({ ...business, website: e.target.value }); setErrors(p => ({ ...p, website: '' })); }}
                    onBlur={() => {
                      if (business.website.trim() && !isValidWebsite(business.website))
                        setErrors(p => ({ ...p, website: 'Enter a valid URL (e.g. https://yoursite.com)' }));
                    }}
                    placeholder="https://yoursite.com"
                    className={fc('website')}
                  />
                  {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-5">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => { if (validateStep1()) { setErrors({}); setStep(2); } }}
                className="flex-1 bg-[#FF6B2C] text-white py-3 rounded-xl font-semibold hover:bg-[#e55a1f] transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Admin Account ── */}
        {step === 2 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your admin account</h2>
              <p className="text-slate-500 text-sm mb-6">You'll be the owner of this dealership</p>

              {/* ── BankID identity verification ── */}
              {!adminVerified ? (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setShowAdminBankID(true)}
                    className="w-full bg-[#235971] hover:bg-[#1a4557] text-white py-3.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">🆔</span> Verify identity with BankID
                  </button>
                  <p className="text-center text-xs text-slate-500 mt-1.5">
                    Recommended · Automatically fills your name · No password needed
                  </p>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-white text-slate-400">or fill in manually</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800">Identity verified with BankID</p>
                    <p className="text-xs text-green-600 truncate">{adminVerified.user.name} · {adminVerified.user.personalNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAdminVerified(null); setAdmin(a => ({ ...a, fullName: '' })); }}
                    className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
                  >
                    Change
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {/* Full name — hidden when BankID auto-fills it */}
                {!adminVerified && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('fullName')} *</label>
                  <input
                    type="text"
                    value={admin.fullName}
                    onChange={e => { setAdmin({ ...admin, fullName: e.target.value }); setErrors(p => ({ ...p, fullName: '' })); }}
                    placeholder="Your full name"
                    className={fc('fullName')}
                  />
                  {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
                </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('emailAddress')} *</label>
                  <input
                    type="email"
                    value={admin.email}
                    onChange={e => { setAdmin({ ...admin, email: e.target.value }); setErrors(p => ({ ...p, email: '' })); }}
                    placeholder="you@dealership.com"
                    className={fc('email')}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number *</label>
                  <PhoneInput
                    value={admin.mobile}
                    onChange={v => { setAdmin({ ...admin, mobile: v }); setErrors(p => ({ ...p, mobile: '' })); }}
                    className={`rounded-lg border ${errors.mobile ? 'border-red-400 bg-red-50 focus-within:ring-red-400' : 'border-slate-300 focus-within:border-[#FF6B2C] focus-within:ring-[#FF6B2C]'} focus-within:ring-1 transition-all`}
                    inputClassName="py-3 text-sm"
                  />
                  {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
                </div>
                {!adminVerified && (<>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('password')} *</label>
                  <PasswordInput
                    value={admin.password}
                    onChange={e => { setAdmin({ ...admin, password: e.target.value }); setErrors(p => ({ ...p, password: '' })); }}
                    placeholder="••••••••"
                    className={fc('password')}
                  />
                  {errors.password
                    ? <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                    : <p className="text-xs text-slate-400 mt-1">{t('passwordMinLength')}</p>
                  }
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('confirmPassword')} *</label>
                  <PasswordInput
                    value={admin.confirmPassword}
                    onChange={e => { setAdmin({ ...admin, confirmPassword: e.target.value }); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                    placeholder="••••••••"
                    className={fc('confirmPassword')}
                  />
                  {errors.confirmPassword
                    ? <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
                    : admin.password && admin.confirmPassword && (
                      <p className={`text-xs mt-1 ${admin.password === admin.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                        {admin.password === admin.confirmPassword ? t('passwordsMatch') : t('passwordsDoNotMatch')}
                      </p>
                    )
                  }
                </div>
                </>)}
                <div>
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={admin.agreeToTerms}
                      onChange={e => { setAdmin({ ...admin, agreeToTerms: e.target.checked }); setErrors(p => ({ ...p, agreeToTerms: '' })); }}
                      className={`w-4 h-4 mt-0.5 rounded border-slate-300 accent-[#FF6B2C] ${errors.agreeToTerms ? 'outline outline-red-400' : ''}`}
                    />
                    <label htmlFor="terms" className="text-sm text-slate-600 leading-snug">
                      {t('agreeToTerms')}{' '}
                      <Link href="/terms" className="text-[#FF6B2C] hover:underline">{t('termsOfService')}</Link>
                      {' '}{t('and')}{' '}
                      <Link href="/privacy" className="text-[#FF6B2C] hover:underline">{t('privacyPolicy')}</Link>
                    </label>
                  </div>
                  {errors.agreeToTerms && <p className="text-xs text-red-500 mt-1.5">{errors.agreeToTerms}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-5">
              <button
                onClick={() => { setErrors({}); setStep(1); }}
                className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                disabled={otpSending}
                onClick={async () => {
                  if (!validateStep2()) return;
                  setOtpSending(true);
                  setErrors({});
                  try {
                    const res = await fetch('/api/auth/send-otp', {
                      method:  'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: admin.email,
                        name:  adminVerified?.user.name ?? admin.fullName,
                      }),
                    });
                    if (!res.ok) {
                      const errBody = await res.json().catch(() => ({}));
                      throw new Error(errBody.error ?? 'send failed');
                    }
                    const { token, devCode } = await res.json();
                    setOtpToken(token);
                    if (devCode) {
                      // Dev-mode fallback: email delivery failed but code returned in response
                      setOtpCode(devCode);
                      toast.success(`Dev mode: code auto-filled (${devCode})`);
                    } else {
                      setOtpCode('');
                    }
                    setStep(3);
                  } catch (err) {
                    toast.error(`Failed to send verification email: ${String(err)}`);
                  } finally {
                    setOtpSending(false);
                  }
                }}
                className="flex-1 bg-[#FF6B2C] text-white py-3 rounded-xl font-semibold hover:bg-[#e55a1f] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {otpSending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </>
                ) : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Email verification ── */}
        {step === 3 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">

              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#FF6B2C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 mb-1 text-center">Check your inbox</h2>
              <p className="text-slate-500 text-sm text-center mb-1">
                We sent a 6-digit code to
              </p>
              <p className="text-[#FF6B2C] font-semibold text-sm text-center mb-7 break-all">{admin.email}</p>

              {/* Code input */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2 text-center">
                  Enter verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(digits);
                    setErrors(p => ({ ...p, otpCode: '' }));
                  }}
                  placeholder="______"
                  maxLength={6}
                  className={`w-full px-4 py-4 rounded-xl border text-center text-3xl font-bold tracking-[0.4em] ${
                    errors.otpCode
                      ? 'border-red-400 bg-red-50 focus:ring-red-400'
                      : 'border-slate-300 focus:border-[#FF6B2C] focus:ring-[#FF6B2C]'
                  } focus:ring-1 outline-none`}
                />
                {errors.otpCode && (
                  <p className="text-xs text-red-500 mt-1.5 text-center">{errors.otpCode}</p>
                )}
              </div>

              {/* Resend */}
              <p className="text-center text-sm text-slate-500">
                Didn't receive it?{' '}
                <button
                  type="button"
                  disabled={otpSending}
                  onClick={async () => {
                    setOtpSending(true);
                    try {
                      const res = await fetch('/api/auth/send-otp', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: admin.email,
                          name:  adminVerified?.user.name ?? admin.fullName,
                        }),
                      });
                      if (!res.ok) {
                        const errBody = await res.json().catch(() => ({}));
                        throw new Error(errBody.error ?? 'send failed');
                      }
                      const { token, devCode } = await res.json();
                      setOtpToken(token);
                      if (devCode) {
                        setOtpCode(devCode);
                        toast.success(`Dev mode: new code auto-filled (${devCode})`);
                      } else {
                        setOtpCode('');
                        toast.success('New code sent!');
                      }
                    } catch {
                      toast.error('Failed to resend — please try again.');
                    } finally {
                      setOtpSending(false);
                    }
                  }}
                  className="text-[#FF6B2C] font-medium hover:underline disabled:opacity-50"
                >
                  {otpSending ? 'Sending…' : 'Resend code'}
                </button>
              </p>

              <p className="text-center text-xs text-slate-400 mt-2">Code expires in 10 minutes</p>
            </div>

            <div className="flex gap-4 mt-5">
              <button
                onClick={() => { setErrors({}); setStep(2); }}
                className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={async () => {
                  if (otpCode.length !== 6) {
                    setErrors({ otpCode: 'Enter the 6-digit code from your email' });
                    return;
                  }
                  setErrors({});
                  setOtpSending(true);

                  try {
                    const verifyRes = await fetch('/api/auth/verify-otp', {
                      method:  'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ code: otpCode, token: otpToken, email: admin.email }),
                    });
                    const { valid, error: verifyErr } = await verifyRes.json();

                    if (!valid) {
                      setErrors({
                        otpCode: verifyErr === 'expired'
                          ? 'Code expired — click "Resend code" to get a new one'
                          : 'Incorrect code — please try again',
                      });
                      return;
                    }

                    // ── OTP verified: create dealership + admin account ──────────

                    const dealershipId = crypto.randomUUID();
                    const emailDomain  = admin.email.includes('@') ? admin.email.split('@')[1].toLowerCase() : '';

                    const { error: dealerErr } = await supabase
                      .from('dealerships')
                      .insert({
                        id:          dealershipId,
                        name:        business.dealershipName,
                        org_nr:      business.orgNumber || null,
                        address:     business.streetAddress || null,
                        postal_code: business.postalCode || null,
                        city:        business.city || null,
                        phone:       business.phone || null,
                        email:       admin.email,
                        website:     business.website || null,
                        plan:        selectedPlan,
                      });
                    if (dealerErr) {
                      console.error('[signup] dealerships insert:', dealerErr.message);
                      toast.error('Failed to create dealership — please try again.');
                      return;
                    }

                    if (emailDomain) {
                      await supabase
                        .from('dealership_settings')
                        .upsert({ dealership_id: dealershipId, email_domain: emailDomain }, { onConflict: 'dealership_id' });
                    }

                    const resolvedName = adminVerified?.user.name ?? admin.fullName;

                    const { error: staffErr } = await supabase
                      .from('staff_users')
                      .insert({
                        dealership_id:   dealershipId,
                        name:            resolvedName,
                        email:           admin.email,
                        role:            'admin',
                        status:          'active',
                        bankid_verified: !!adminVerified,
                        personal_number: adminVerified?.user.personalNumber ?? '',
                      });
                    if (staffErr) {
                      console.warn('[signup] staff_users insert:', staffErr.message);
                      if (staffErr.code === '23505') {
                        toast.error('An account with this email already exists — please log in instead.');
                      } else {
                        toast.error('Failed to create account — please try again.');
                      }
                      return;
                    }

                    const profile = {
                      name:           resolvedName,
                      givenName:      adminVerified?.user.givenName ?? admin.fullName.split(' ')[0],
                      personalNumber: adminVerified?.user.personalNumber ?? '',
                      email:          admin.email,
                      dealershipName: business.dealershipName,
                      dealershipId,
                      orgNr:          business.orgNumber,
                      city:           business.city,
                      postalCode:     business.postalCode,
                      streetAddress:  business.streetAddress,
                      phone:          business.phone,
                      website:        business.website,
                      plan:           selectedPlan,
                      role:           'admin' as const,
                    };
                    localStorage.setItem('user', JSON.stringify(profile));
                    localStorage.setItem('dealership_profile', JSON.stringify({
                      name:        business.dealershipName,
                      orgNr:       business.orgNumber,
                      city:        business.city,
                      postalCode:  business.postalCode,
                      address:     business.streetAddress,
                      phone:       business.phone,
                      website:     business.website,
                      email:       admin.email,
                      emailDomain,
                    }));
                    const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
                    accounts[admin.email] = profile;
                    localStorage.setItem('accounts', JSON.stringify(accounts));
                    if (!localStorage.getItem('staff_users')) {
                      localStorage.setItem('staff_users', JSON.stringify([{
                        id:             crypto.randomUUID(),
                        name:           resolvedName,
                        email:          admin.email,
                        role:           'admin' as const,
                        status:         'active' as const,
                        lastLogin:      new Date().toISOString(),
                        bankidVerified: !!adminVerified,
                        personalNumber: adminVerified?.user.personalNumber ?? '',
                      }]));
                    }

                    await fetch('/api/auth/session', {
                      method:  'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dealershipId,
                        dealershipName: business.dealershipName,
                        name:           resolvedName,
                        email:          admin.email,
                        role:           'admin',
                      }),
                    });

                    setStep(4);
                  } catch {
                    toast.error('Something went wrong — please try again.');
                  } finally {
                    setOtpSending(false);
                  }
                }}
                disabled={otpSending || otpCode.length !== 6}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {otpSending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying…
                  </>
                ) : 'Verify & Create Account →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Complete ── */}
        {step === 4 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
              {/* Checkmark */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to BikeMeNow! 🎉</h2>
                <p className="text-slate-500 text-sm">Your account is ready. Let's get you set up!</p>
              </div>

              {/* Quick start */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">Quick Start Guide</h3>
                  <span className="text-xs text-slate-400">
                    {skipped.size}/{QUICK_START.length} done
                  </span>
                </div>

                <div className="space-y-2">
                  {QUICK_START.map((item) => {
                    const isDone = skipped.has(item.key);
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                          isDone
                            ? 'bg-slate-50 border-slate-100 opacity-60'
                            : 'bg-white border-slate-200 hover:border-orange-200 hover:bg-orange-50/30'
                        }`}
                      >
                        {/* Status icon */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${
                          isDone ? 'bg-green-100' : 'bg-slate-100'
                        }`}>
                          {isDone ? '✓' : item.icon}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                            {item.title}
                          </p>
                          <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                        </div>

                        {/* Actions */}
                        {!isDone && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              href={item.href}
                              className="text-xs font-semibold text-[#FF6B2C] hover:underline whitespace-nowrap"
                            >
                              Start →
                            </Link>
                            <button
                              onClick={() => handleSkip(item.key)}
                              className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap border border-slate-200 px-2 py-1 rounded-lg hover:border-slate-300 transition-colors"
                            >
                              Hoppa över
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {skipped.size === QUICK_START.length && (
                  <p className="text-center text-xs text-slate-400 mt-3">
                    You can complete these steps anytime from Settings or the relevant pages.
                  </p>
                )}
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-[#FF6B2C] text-white py-3.5 rounded-xl font-semibold hover:bg-[#e55a1f] transition-colors"
              >
                Go to Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* BankID modal for admin identity verification in Step 2 */}
    {showAdminBankID && (
      <BankIDModal
        mode="auth"
        onComplete={(result: BankIDResult) => {
          setAdminVerified(result);
          setAdmin(a => ({ ...a, fullName: result.user.name }));
          setShowAdminBankID(false);
        }}
        onCancel={() => setShowAdminBankID(false)}
        autoStart
      />
    )}
    </>
  );
}
