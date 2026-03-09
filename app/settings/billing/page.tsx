'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanId = 'basic' | 'standard' | 'pro';
type Cycle  = 'monthly' | 'annual';

// ─── Mock invoice data ────────────────────────────────────────────────────────

const MOCK_INVOICES = [
  { id: 'INV-2026-003', date: '2026-03-01', amount: 499 },
  { id: 'INV-2026-002', date: '2026-02-01', amount: 499 },
  { id: 'INV-2026-001', date: '2026-01-01', amount: 499 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const t      = useTranslations('billing');

  const [plan,       setPlan]       = useState<PlanId>('standard');
  const [cycle,      setCycle]      = useState<Cycle>('monthly');
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.replace('/auth/login'); return; }
    try {
      const saved = JSON.parse(localStorage.getItem('billing_prefs') || '{}');
      if (saved.plan)  setPlan(saved.plan);
      if (saved.cycle) setCycle(saved.cycle);
    } catch {}
  }, [router]);

  const saveBillingPrefs = (p: PlanId, c: Cycle) =>
    localStorage.setItem('billing_prefs', JSON.stringify({ plan: p, cycle: c }));

  // ─── Plan definitions (inside component to use t()) ─────────────────────

  const PLANS: {
    id:       PlanId;
    name:     string;
    monthly:  number;
    annual:   number;
    color:    string;
    popular?: boolean;
    features: string[];
  }[] = [
    {
      id: 'basic',
      name: t('planBasic'),
      monthly: 299,
      annual:  2870,
      color: 'border-slate-200',
      features: [
        t('f.users3'), t('f.leads50'), t('f.bankid'),
        t('f.basicPayments'), t('f.emailSupport'),
      ],
    },
    {
      id: 'standard',
      name: t('planStandard'),
      monthly: 499,
      annual:  4790,
      color: 'border-[#FF6B2C]',
      popular: true,
      features: [
        t('f.usersUnlimited'), t('f.leadsUnlimited'), t('f.bankid'),
        t('f.allPayments'), t('f.notifications'), t('f.emailSupport'),
      ],
    },
    {
      id: 'pro',
      name: t('planPro'),
      monthly: 899,
      annual:  8630,
      color: 'border-purple-400',
      features: [
        t('f.usersUnlimited'), t('f.leadsUnlimited'), t('f.bankid'),
        t('f.allPayments'), t('f.notifications'), t('f.api'),
        t('f.multiUser'), t('f.prioritySupport'),
      ],
    },
  ];

  const activePlan   = PLANS.find(p => p.id === plan) || PLANS[1];
  const displayPrice = cycle === 'annual' ? activePlan.annual : activePlan.monthly;

  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  const nextBillingStr = nextBillingDate.toLocaleDateString('sv-SE', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const handlePlanChange = (newPlan: PlanId) => {
    const planName = PLANS.find(p => p.id === newPlan)?.name || newPlan;
    setPlan(newPlan);
    saveBillingPrefs(newPlan, cycle);
    toast.success(`${t('planUpdatedToast')} ${planName}`);
  };

  const handleCycleToggle = () => {
    const next = cycle === 'monthly' ? 'annual' : 'monthly';
    setCycle(next);
    saveBillingPrefs(plan, next);
    toast.success(next === 'annual' ? t('switchedToAnnual') : t('switchedToMonthly'));
  };

  const handleCancel = () => {
    setCancelOpen(false);
    toast.success(t('cancelToast'));
  };

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">
              Inställningar
            </Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('breadcrumb')}</span>
          </nav>
          <h1 className="text-2xl font-black text-[#0b1524]">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>

        <div className="px-5 md:px-8 py-8 max-w-4xl space-y-6">

          {/* ── Current plan summary ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                  {t('currentPlan')}
                </p>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black text-[#0b1524]">{activePlan.name}</h2>
                  <span className="text-[11px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {t('active')}
                  </span>
                </div>
                <p className="text-3xl font-black text-[#FF6B2C] mt-2 leading-none">
                  {displayPrice.toLocaleString('sv-SE')} kr
                  <span className="text-sm font-normal text-slate-400 ml-1.5">
                    /{cycle === 'annual' ? t('year') : t('month')}
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-1.5">{t('vatNote')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('nextBilling')}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{nextBillingStr}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-3">{t('billingCycle')}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {cycle === 'annual' ? t('annual') : t('monthly')}
                </p>
              </div>
            </div>

            {/* Annual toggle */}
            <div className="mt-5 pt-5 border-t border-slate-50 flex items-center gap-4 flex-wrap">
              <span className={`text-sm font-medium ${cycle === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
                {t('monthly')}
              </span>
              <button
                onClick={handleCycleToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  cycle === 'annual' ? 'bg-[#FF6B2C]' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  cycle === 'annual' ? 'left-7' : 'left-1'
                }`} />
              </button>
              <span className={`text-sm font-medium flex items-center gap-2 ${
                cycle === 'annual' ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {t('annual')}
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                  {t('save20')}
                </span>
              </span>
            </div>
          </div>

          {/* ── Plan comparison ────────────────────────────────────────────── */}
          <div className="animate-fade-up">
            <h3 className="text-sm font-bold text-slate-700 mb-3">{t('choosePlan')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map(p => {
                const isCurrent = p.id === plan;
                const price     = cycle === 'annual' ? p.annual : p.monthly;
                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border-2 p-5 flex flex-col transition-all ${p.color} ${
                      isCurrent ? 'shadow-md' : 'hover:shadow-sm'
                    }`}
                  >
                    {/* Plan header */}
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-bold text-slate-900">{p.name}</p>
                      {p.popular && !isCurrent && (
                        <span className="text-[9px] font-bold text-[#FF6B2C] bg-orange-50 px-1.5 py-0.5 rounded-full">
                          {t('popular')}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                          {t('currentBadge')}
                        </span>
                      )}
                    </div>

                    {/* Price */}
                    <p className="text-xl font-black text-[#0b1524] mb-4">
                      {price.toLocaleString('sv-SE')}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        kr/{cycle === 'annual' ? t('year') : t('month')}
                      </span>
                    </p>

                    {/* Features */}
                    <ul className="space-y-1.5 flex-1 mb-5">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() => !isCurrent && handlePlanChange(p.id)}
                      disabled={isCurrent}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isCurrent
                          ? 'bg-slate-50 text-slate-400 cursor-default border border-slate-100'
                          : p.id === 'pro'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-[#FF6B2C] hover:bg-[#e55a1f] text-white'
                      }`}
                    >
                      {isCurrent ? `✓ ${t('currentBadge')}` : t('selectPlan')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Payment method + Billing contact ──────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up">

            {/* Payment method */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-900 mb-4">{t('paymentMethod')}</p>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-11 h-7 rounded-md bg-[#1a1f71] flex items-center justify-center shrink-0">
                  <span className="text-white text-[9px] font-black tracking-tight">VISA</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 tracking-widest">•••• •••• •••• 4242</p>
                  <p className="text-[11px] text-slate-400">{t('expires')} 12/28</p>
                </div>
              </div>
              <button
                onClick={() => toast.success(t('cardUpdateToast'))}
                className="mt-3 w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#FF6B2C]/40 hover:bg-orange-50 transition-all"
              >
                {t('updateCard')}
              </button>
            </div>

            {/* Billing contact */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-900 mb-4">{t('billingContact')}</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">Email</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">billing@avamc.se</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('orgNumber')}</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">556123-4567</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('vatNumber')}</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">SE556123456701</p>
                </div>
              </div>
              <button
                onClick={() => toast.success(t('contactUpdateToast'))}
                className="mt-3 w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#FF6B2C]/40 hover:bg-orange-50 transition-all"
              >
                {t('updateContact')}
              </button>
            </div>
          </div>

          {/* ── Invoice history ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-fade-up">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">{t('invoices')}</p>
              <span className="text-[11px] text-slate-400">
                {MOCK_INVOICES.length} {t('invoiceCount')}
              </span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_130px_110px_80px] px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 bg-slate-50/50">
              <span>{t('invoiceNumber')}</span>
              <span>{t('invoiceDate')}</span>
              <span>{t('invoiceAmount')}</span>
              <span>{t('invoiceStatus')}</span>
            </div>

            {MOCK_INVOICES.map(inv => (
              <div
                key={inv.id}
                className="grid grid-cols-[1fr_130px_110px_80px] px-6 py-4 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50/50 transition-colors"
              >
                <button
                  onClick={() => toast.success(`${t('downloadToast')} ${inv.id}`)}
                  className="flex items-center gap-2 text-sm font-semibold text-[#FF6B2C] hover:underline text-left"
                >
                  <span>📄</span> {inv.id}
                </button>
                <span className="text-xs text-slate-500">
                  {new Date(inv.date).toLocaleDateString('sv-SE', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {inv.amount.toLocaleString('sv-SE')} kr
                </span>
                <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">
                  {t('invoicePaid')}
                </span>
              </div>
            ))}
          </div>

          {/* ── Danger zone ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-red-100 p-6 animate-fade-up">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-bold text-red-700 mb-1">⚠️ {t('cancelZone')}</p>
                <p className="text-xs text-slate-500 max-w-lg leading-relaxed">{t('cancelDesc')}</p>
              </div>
              <button
                onClick={() => setCancelOpen(true)}
                className="shrink-0 px-4 py-2 rounded-xl border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 transition-all"
              >
                {t('cancelButton')}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Cancel confirmation modal ──────────────────────────────────────── */}
      {cancelOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setCancelOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-up">
              <p className="text-lg font-black text-slate-900 mb-2">{t('cancelConfirmTitle')}</p>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">{t('cancelConfirmDesc')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCancelOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  {t('cancelBack')}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all"
                >
                  {t('cancelConfirmButton')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
