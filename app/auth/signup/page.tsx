'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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
  { title: '1. Add your first motorcycle', desc: 'Get started with inventory management' },
  { title: '2. Invite your team', desc: 'Collaborate with sales and service staff' },
  { title: '3. Connect integrations', desc: 'Link Blocket and other platforms' },
  { title: '4. Create your first lead', desc: 'Start managing your sales pipeline' },
];

function formatCardNumber(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations('signup');
  const [step, setStep] = useState<Step>(0);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('professional');

  // Redirect if already logged in
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      router.replace('/dashboard');
    }
  }, [router]);

  const [business, setBusiness] = useState({
    dealershipName: '', orgNumber: '', streetAddress: '',
    postalCode: '', city: '', phone: '', website: '',
  });
  const [admin, setAdmin] = useState({
    fullName: '', email: '', mobile: '',
    password: '', confirmPassword: '', agreeToTerms: false,
  });
  const [payment, setPayment] = useState({
    cardNumber: '', expiry: '', cvc: '',
    cardholderName: '', billingSameAsBusiness: true,
  });

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
          <span className="text-[#FF6B2C] text-xl font-bold tracking-tight">BikeMeNow</span>
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Slim nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-white">
        <span className="text-[#FF6B2C] text-lg font-bold tracking-tight">BikeMeNow</span>
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
                    onChange={e => setBusiness({ ...business, dealershipName: e.target.value })}
                    placeholder="e.g., Stockholm Motorcycles AB"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Organization Number *</label>
                  <input
                    type="text"
                    value={business.orgNumber}
                    onChange={e => setBusiness({ ...business, orgNumber: e.target.value })}
                    placeholder="XXXXXX-XXXX"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Street Address *</label>
                  <input
                    type="text"
                    value={business.streetAddress}
                    onChange={e => setBusiness({ ...business, streetAddress: e.target.value })}
                    placeholder="Street name and number"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Postal Code *</label>
                    <input
                      type="text"
                      value={business.postalCode}
                      onChange={e => setBusiness({ ...business, postalCode: e.target.value })}
                      placeholder="XXX XX"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">City *</label>
                    <input
                      type="text"
                      value={business.city}
                      onChange={e => setBusiness({ ...business, city: e.target.value })}
                      placeholder="e.g., Stockholm"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    value={business.phone}
                    onChange={e => setBusiness({ ...business, phone: e.target.value })}
                    placeholder="+46 XX XXX XX XX"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Website (optional)</label>
                  <input
                    type="url"
                    value={business.website}
                    onChange={e => setBusiness({ ...business, website: e.target.value })}
                    placeholder="https://"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
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
                onClick={() => setStep(2)}
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
              <p className="text-slate-500 text-sm mb-7">You'll be the owner of this dealership</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('fullName')} *</label>
                  <input
                    type="text"
                    value={admin.fullName}
                    onChange={e => setAdmin({ ...admin, fullName: e.target.value })}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('emailAddress')} *</label>
                  <input
                    type="email"
                    value={admin.email}
                    onChange={e => setAdmin({ ...admin, email: e.target.value })}
                    placeholder="you@dealership.com"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number *</label>
                  <input
                    type="tel"
                    value={admin.mobile}
                    onChange={e => setAdmin({ ...admin, mobile: e.target.value })}
                    placeholder="+46 70 XXX XX XX"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('password')} *</label>
                  <input
                    type="password"
                    value={admin.password}
                    onChange={e => setAdmin({ ...admin, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">{t('passwordMinLength')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('confirmPassword')} *</label>
                  <input
                    type="password"
                    value={admin.confirmPassword}
                    onChange={e => setAdmin({ ...admin, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                  {admin.password && admin.confirmPassword && (
                    <p className={`text-xs mt-1 ${admin.password === admin.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                      {admin.password === admin.confirmPassword ? t('passwordsMatch') : t('passwordsDoNotMatch')}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={admin.agreeToTerms}
                    onChange={e => setAdmin({ ...admin, agreeToTerms: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 accent-[#FF6B2C]"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-600 leading-snug">
                    {t('agreeToTerms')}{' '}
                    <Link href="/terms" className="text-[#FF6B2C] hover:underline">{t('termsOfService')}</Link>
                    {' '}{t('and')}{' '}
                    <Link href="/privacy" className="text-[#FF6B2C] hover:underline">{t('privacyPolicy')}</Link>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-5">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-[#FF6B2C] text-white py-3 rounded-xl font-semibold hover:bg-[#e55a1f] transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Payment ── */}
        {step === 3 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Payment Information</h2>
              <p className="text-slate-500 text-sm mb-7">Start your 14-day free trial • No charge today</p>

              {/* Plan summary */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between mb-6">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{plan.name} Plan</p>
                  <p className="text-xs text-slate-500 mt-0.5">Billed monthly after trial</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-700">{plan.price}</p>
                  <p className="text-xs text-slate-400">per month</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Card Number *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={payment.cardNumber}
                      onChange={e => setPayment({ ...payment, cardNumber: formatCardNumber(e.target.value) })}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm pr-12"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-lg">💳</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Expiry Date *</label>
                    <input
                      type="text"
                      value={payment.expiry}
                      onChange={e => setPayment({ ...payment, expiry: formatExpiry(e.target.value) })}
                      placeholder="MM / YY"
                      maxLength={5}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">CVC *</label>
                    <input
                      type="text"
                      value={payment.cvc}
                      onChange={e => setPayment({ ...payment, cvc: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      placeholder="123"
                      maxLength={3}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cardholder Name *</label>
                  <input
                    type="text"
                    value={payment.cardholderName}
                    onChange={e => setPayment({ ...payment, cardholderName: e.target.value })}
                    placeholder="Name on card"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none text-sm"
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="billing"
                    checked={payment.billingSameAsBusiness}
                    onChange={e => setPayment({ ...payment, billingSameAsBusiness: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 accent-[#FF6B2C]"
                  />
                  <label htmlFor="billing" className="text-sm text-slate-600">
                    Billing address same as business address
                  </label>
                </div>

                {/* Trial info box */}
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-1">
                  <p className="text-sm font-semibold text-orange-800">🎉 Your trial starts today</p>
                  <p className="text-sm text-orange-700">You won't be charged until {trialEndStr}</p>
                  <p className="text-sm text-orange-600">Cancel anytime before then at no cost</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-5">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  const profile = {
                    name: admin.fullName,
                    email: admin.email,
                    dealershipName: business.dealershipName,
                    plan: selectedPlan,
                  };
                  // Save active session
                  localStorage.setItem('user', JSON.stringify(profile));
                  // Save to accounts registry so email login can restore dealershipName
                  const accounts = JSON.parse(localStorage.getItem('accounts') || '{}');
                  accounts[admin.email] = profile;
                  localStorage.setItem('accounts', JSON.stringify(accounts));
                  setStep(4);
                }}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Start Free Trial →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Complete ── */}
        {step === 4 && (
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
              {/* Checkmark */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to BikeMeNow! 🎉</h2>
              <p className="text-slate-500 text-sm mb-8">Your account is ready. Let's get started!</p>

              {/* Quick start */}
              <div className="text-left mb-8">
                <h3 className="font-bold text-slate-900 mb-4">Quick Start Guide</h3>
                <div className="space-y-3">
                  {QUICK_START.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{item.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-[#2563EB] text-white py-3.5 rounded-xl font-semibold hover:bg-[#e55a1f] transition-colors"
              >
                Go to Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
