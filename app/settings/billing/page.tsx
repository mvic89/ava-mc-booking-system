'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Sidebar from '@/components/Sidebar';
import { getDealerInfo, getVatNumber } from '@/lib/dealer';
import { useAutoRefresh } from '@/lib/realtime';

// ─── Stripe ───────────────────────────────────────────────────────────────────

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PK ? loadStripe(PK) : null;

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanId = 'basic' | 'standard' | 'pro';

interface BillingStatus {
  configured:    boolean;
  customerId?:   string;
  subscription?: {
    id:                string;
    status:            string;
    priceId:           string | null;
    amount:            number | null;
    currency:          string;
    interval:          string;
    periodEnd:         number;
    cancelAtPeriodEnd: boolean;
  } | null;
  card?: { brand: string; last4: string; expMonth: number; expYear: number } | null;
}

interface StripeInvoice {
  id: string; number: string; status: string;
  amount: number; currency: string; date: string;
  pdfUrl: string | null; portalUrl: string | null;
}

const PRICE_MAP: Record<PlanId, string> = {
  basic:    process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY    ?? '',
  standard: process.env.NEXT_PUBLIC_STRIPE_PRICE_STANDARD_MONTHLY ?? '',
  pro:      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY      ?? '',
};

function planFromPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return 'standard';
  if (priceId === PRICE_MAP.basic) return 'basic';
  if (priceId === PRICE_MAP.pro)   return 'pro';
  return 'standard';
}

function cardBrandIcon(brand: string) {
  switch (brand.toLowerCase()) {
    case 'visa':       return { icon: 'VISA', bg: '#1a1f71', text: '#fff' };
    case 'mastercard': return { icon: 'MC',   bg: '#eb001b', text: '#fff' };
    case 'amex':       return { icon: 'AMEX', bg: '#007bc1', text: '#fff' };
    default:           return { icon: brand.toUpperCase().slice(0, 4), bg: '#334155', text: '#fff' };
  }
}

// ─── Inline card update form (inside Elements) ────────────────────────────────

function CardUpdateForm({
  dealershipId,
  onSuccess,
  onCancel,
}: {
  dealershipId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleSave = async () => {
    if (!stripe || !elements) return;
    setSaving(true);
    try {
      // 1. Create SetupIntent
      const siRes = await fetch('/api/billing/setup-intent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealershipId }),
      });
      const siData = await siRes.json() as { clientSecret?: string; error?: string };
      if (!siRes.ok || !siData.clientSecret) throw new Error(siData.error ?? 'Could not create setup intent');

      // 2. Confirm card with Stripe.js
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element not found');

      const { setupIntent, error } = await stripe.confirmCardSetup(siData.clientSecret, {
        payment_method: { card: cardEl },
      });
      if (error) throw new Error(error.message);
      if (!setupIntent?.payment_method) throw new Error('No payment method returned');

      // 3. Tell server to set as default
      const pmId = typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      const updateRes = await fetch('/api/billing/update-payment-method', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dealershipId, paymentMethodId: pmId }),
      });
      if (!updateRes.ok) throw new Error('Could not update payment method');

      toast.success('Card updated successfully');
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Card update failed');
    }
    setSaving(false);
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="border border-slate-200 rounded-xl px-4 py-3 bg-white focus-within:border-[#FF6B2C] focus-within:ring-1 focus-within:ring-[#FF6B2C]/20 transition-all">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '14px',
                color: '#0b1524',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                '::placeholder': { color: '#94a3b8' },
              },
              invalid: { color: '#ef4444' },
            },
            hidePostalCode: true,
          }}
          onChange={e => setCardComplete(e.complete)}
        />
      </div>
      <p className="text-[10px] text-slate-400">🔒 Secured by Stripe — card details never touch our servers</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !cardComplete || !stripe}
          className="flex-1 py-2 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving
            ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            : 'Save card'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const t      = useTranslations('billing');

  const [dealershipId,   setDealershipId]   = useState('');
  const [dealer,         setDealer]         = useState({ email: '', orgNr: '', vatNr: '' });
  const [loading,        setLoading]        = useState(true);
  const [status,         setStatus]         = useState<BillingStatus | null>(null);
  const [invoices,       setInvoices]       = useState<StripeInvoice[]>([]);
  const [loadingInvoices,setLoadingInvoices]= useState(false);
  const [plan,           setPlan]           = useState<PlanId>('standard');
  const [cancelOpen,     setCancelOpen]     = useState(false);
  const [changingPlan,   setChangingPlan]   = useState<PlanId | null>(null);
  const [cancelling,     setCancelling]     = useState(false);
  const [subscribing,    setSubscribing]    = useState(false);
  const [showCardForm,   setShowCardForm]   = useState(false);

  const PLANS: { id: PlanId; name: string; monthly: number; color: string; popular?: boolean; features: string[] }[] = [
    { id: 'basic',    name: t('planBasic'),    monthly: 2000, color: 'border-slate-200',
      features: [t('f.users3'), t('f.leads50'), t('f.bankid'), t('f.basicPayments'), t('f.emailSupport')] },
    { id: 'standard', name: t('planStandard'), monthly: 5000, color: 'border-[#FF6B2C]', popular: true,
      features: [t('f.usersUnlimited'), t('f.leadsUnlimited'), t('f.bankid'), t('f.allPayments'), t('f.notifications'), t('f.emailSupport')] },
    { id: 'pro',      name: t('planPro'),      monthly: 8000, color: 'border-purple-400',
      features: [t('f.usersUnlimited'), t('f.leadsUnlimited'), t('f.bankid'), t('f.allPayments'), t('f.notifications'), t('f.api'), t('f.multiUser'), t('f.prioritySupport')] },
  ];

  const fetchStatus = useCallback(async (did: string) => {
    try {
      const res  = await fetch(`/api/billing/status?dealershipId=${encodeURIComponent(did)}`);
      if (!res.ok) return;
      const data = await res.json() as BillingStatus;
      setStatus(data);
      if (data.configured && data.subscription) setPlan(planFromPriceId(data.subscription.priceId));
    } catch {}
  }, []);

  const fetchInvoices = useCallback(async (did: string) => {
    setLoadingInvoices(true);
    try {
      const res  = await fetch(`/api/billing/invoices?dealershipId=${encodeURIComponent(did)}`);
      if (!res.ok) return;
      const data = await res.json() as { invoices: StripeInvoice[] };
      setInvoices(data.invoices ?? []);
    } catch {}
    finally { setLoadingInvoices(false); }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const u = JSON.parse(raw);
    if (u.role !== 'admin') { toast.error('Only administrators can manage billing.'); router.replace('/settings'); return; }
    const did = u.dealershipId ?? '';
    setDealershipId(did);
    const d = getDealerInfo();
    setDealer({ email: d.email, orgNr: d.orgNr, vatNr: getVatNumber(d.orgNr) });
    Promise.all([fetchStatus(did), fetchInvoices(did)]).finally(() => setLoading(false));
  }, [router, fetchStatus, fetchInvoices]);

  // Re-fetch billing data whenever Supabase emits a dealership update
  useAutoRefresh(useCallback(() => {
    const did = JSON.parse(localStorage.getItem('user') ?? '{}').dealershipId ?? '';
    if (did) { fetchStatus(did); fetchInvoices(did); }
  }, [fetchStatus, fetchInvoices]));

  // ─── Derived ────────────────────────────────────────────────────────────

  const activePlan = PLANS.find(p => p.id === plan) ?? PLANS[1];
  const hasActiveSub = !!(status?.subscription && ['active','trialing','past_due'].includes(status.subscription.status));

  const nextBillingStr = status?.subscription?.periodEnd
    ? new Date(status.subscription.periodEnd * 1000).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const subscriptionStatus = status?.subscription?.status ?? '';
  const cancelScheduled    = status?.subscription?.cancelAtPeriodEnd ?? false;
  const card = status?.card ?? null;
  const cardMeta = card ? cardBrandIcon(card.brand) : null;

  // ─── Actions ─────────────────────────────────────────────────────────────

  const getDid = () => {
    if (dealershipId) return dealershipId;
    try { return (JSON.parse(localStorage.getItem('user') ?? '{}') as { dealershipId?: string }).dealershipId ?? ''; } catch { return ''; }
  };

  const handleSubscribe = async (newPlan: PlanId) => {
    const did = getDid();
    if (!did) { toast.error('Login required'); return; }
    const priceId = PRICE_MAP[newPlan];
    if (!priceId) { toast.error('Stripe prices not configured — contact support'); return; }
    setSubscribing(true);
    try {
      const origin = window.location.origin;
      const res  = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId: did, priceId, successUrl: `${origin}/settings/billing?success=1`, cancelUrl: `${origin}/settings/billing` }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not start checkout');
      setSubscribing(false);
    }
  };

  const handleChangePlan = async (newPlan: PlanId) => {
    if (!dealershipId || newPlan === plan) return;
    const priceId = PRICE_MAP[newPlan];
    if (!priceId) { toast.error('Stripe prices not configured'); return; }
    setChangingPlan(newPlan);
    try {
      const res  = await fetch('/api/billing/change-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealershipId, priceId }) });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Plan change failed');
      setPlan(newPlan);
      toast.success(`${t('planUpdatedToast')} ${PLANS.find(p => p.id === newPlan)?.name}`);
      await fetchStatus(dealershipId);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not change plan'); }
    setChangingPlan(null);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res  = await fetch('/api/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealershipId }) });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Cancel failed');
      setCancelOpen(false);
      toast.success(t('cancelToast'));
      await fetchStatus(dealershipId);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Could not cancel subscription'); }
    setCancelling(false);
  };

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading || status === null) {
    return (
      <div className="flex min-h-screen bg-[#f5f7fa]">
        <Sidebar />
        <div className="lg:ml-64 flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/settings" className="hover:text-[#FF6B2C] transition-colors">Inställningar</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('breadcrumb')}</span>
          </nav>
          <h1 className="text-2xl font-black text-[#0b1524]">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>

        <div className="px-5 md:px-8 py-8 max-w-4xl space-y-6">

          {/* Cancel scheduled banner */}
          {cancelScheduled && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <p className="text-sm font-bold text-amber-800">Prenumeration avslutas {nextBillingStr}</p>
                <p className="text-xs text-amber-700 mt-0.5">Du har tillgång till alla funktioner till och med detta datum.</p>
              </div>
            </div>
          )}

          {/* Current plan summary — only when active */}
          {hasActiveSub && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{t('currentPlan')}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-black text-[#0b1524]">{activePlan.name}</h2>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      subscriptionStatus === 'active'   ? 'bg-green-100 text-green-700' :
                      subscriptionStatus === 'past_due' ? 'bg-red-100 text-red-700' :
                      subscriptionStatus === 'trialing' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {subscriptionStatus === 'active'   ? t('active') :
                       subscriptionStatus === 'trialing' ? 'Provperiod' :
                       subscriptionStatus === 'past_due' ? 'Betalning misslyckades' : subscriptionStatus}
                    </span>
                  </div>
                  <p className="text-3xl font-black text-[#FF6B2C] mt-2 leading-none">
                    {status?.subscription?.amount != null
                      ? (status.subscription.amount / 100).toLocaleString('sv-SE')
                      : activePlan.monthly.toLocaleString('sv-SE')} {(status?.subscription?.currency ?? 'SEK').toUpperCase()}
                    <span className="text-sm font-normal text-slate-400 ml-1.5">/{t('month')}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">{t('vatNote')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('nextBilling')}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{nextBillingStr}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-3">{t('billingCycle')}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{t('monthly')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Plan grid — always visible */}
          <div className="animate-fade-up">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              {hasActiveSub ? t('choosePlan') : 'Välj din plan'}
            </h3>
            {!hasActiveSub && (
              <p className="text-sm text-slate-500 mb-4">Ingen aktiv prenumeration. Välj ett plan nedan för att komma igång.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map(p => {
                const isCurrent  = hasActiveSub && p.id === plan;
                const isChanging = changingPlan === p.id;
                const hasPrice   = !!PRICE_MAP[p.id];
                return (
                  <div key={p.id} className={`bg-white rounded-2xl border-2 p-5 flex flex-col transition-all ${p.color} ${isCurrent ? 'shadow-md' : 'hover:shadow-sm'}`}>
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-bold text-slate-900">{p.name}</p>
                      {p.popular && !isCurrent && <span className="text-[9px] font-bold text-[#FF6B2C] bg-orange-50 px-1.5 py-0.5 rounded-full">{t('popular')}</span>}
                      {isCurrent && <span className="text-[9px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">{t('currentBadge')}</span>}
                    </div>
                    <p className="text-xl font-black text-[#0b1524] mb-4">
                      {p.monthly.toLocaleString('sv-SE')} <span className="text-xs font-normal text-slate-400">kr/{t('month')}</span>
                    </p>
                    <ul className="space-y-1.5 flex-1 mb-5">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-green-500 shrink-0 mt-0.5">✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        if (isCurrent) return;
                        if (hasActiveSub) handleChangePlan(p.id);
                        else handleSubscribe(p.id);
                      }}
                      disabled={isCurrent || isChanging || subscribing || !hasPrice}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isCurrent     ? 'bg-slate-50 text-slate-400 cursor-default border border-slate-100' :
                        !hasPrice     ? 'bg-slate-50 text-slate-400 cursor-default border border-dashed border-slate-200' :
                        p.id === 'pro'? 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60' :
                                        'bg-[#FF6B2C] hover:bg-[#e55a1f] text-white disabled:opacity-60'
                      }`}
                    >
                      {isCurrent   ? `✓ ${t('currentBadge')}` :
                       isChanging  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Byter…</> :
                       subscribing ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Dirigerar…</> :
                       !hasPrice   ? 'Konfigurera Stripe →' :
                       hasActiveSub ? t('selectPlan') : 'Prenumerera →'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment method + Billing contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-up">

            {/* Payment method — inline card form */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-900 mb-4">{t('paymentMethod')}</p>

              {card && cardMeta && !showCardForm ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3">
                  <div className="w-11 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: cardMeta.bg }}>
                    <span className="text-[9px] font-black tracking-tight" style={{ color: cardMeta.text }}>{cardMeta.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 tracking-widest">•••• •••• •••• {card.last4}</p>
                    <p className="text-[11px] text-slate-400">{t('expires')} {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}</p>
                  </div>
                </div>
              ) : !showCardForm ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3">
                  <div className="w-11 h-7 rounded-md bg-slate-200 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-slate-400">—</span>
                  </div>
                  <p className="text-xs text-slate-400">Inget kort registrerat</p>
                </div>
              ) : null}

              {showCardForm ? (
                <Elements stripe={stripePromise}>
                  <CardUpdateForm
                    dealershipId={dealershipId}
                    onSuccess={() => { setShowCardForm(false); fetchStatus(dealershipId); }}
                    onCancel={() => setShowCardForm(false)}
                  />
                </Elements>
              ) : (
                <button
                  onClick={() => setShowCardForm(true)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:border-[#FF6B2C]/40 hover:bg-orange-50 transition-all"
                >
                  {card ? t('updateCard') : '+ Add card'}
                </button>
              )}
            </div>

            {/* Billing contact */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-sm font-bold text-slate-900 mb-4">{t('billingContact')}</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">Email</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{dealer.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('orgNumber')}</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{dealer.orgNr || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">{t('vatNumber')}</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{dealer.vatNr || '—'}</p>
                </div>
                {status?.customerId && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">Stripe Customer</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{status.customerId}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice history */}
          {hasActiveSub && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-fade-up">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">{t('invoices')}</p>
                <span className="text-[11px] text-slate-400">
                  {loadingInvoices ? '…' : `${invoices.length} ${t('invoiceCount')}`}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_130px_110px_80px_60px] px-6 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 bg-slate-50/50">
                <span>{t('invoiceNumber')}</span><span>{t('invoiceDate')}</span>
                <span>{t('invoiceAmount')}</span><span>{t('invoiceStatus')}</span><span></span>
              </div>
              {loadingInvoices && (
                <div className="px-6 py-8 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loadingInvoices && invoices.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-slate-400">Inga fakturor ännu</div>
              )}
              {!loadingInvoices && invoices.map(inv => (
                <div key={inv.id} className="grid grid-cols-[1fr_130px_110px_80px_60px] px-6 py-4 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50/50 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#FF6B2C]">
                    <span>📄</span>{inv.number}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(inv.date).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{inv.amount.toLocaleString('sv-SE')} {inv.currency}</span>
                  <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">{t('invoicePaid')}</span>
                  {inv.pdfUrl
                    ? <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline font-medium">PDF ↗</a>
                    : <span />}
                </div>
              ))}
            </div>
          )}

          {/* Danger zone */}
          {hasActiveSub && !cancelScheduled && (
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
          )}

        </div>
      </div>

      {/* Cancel modal */}
      {cancelOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setCancelOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-up">
              <p className="text-lg font-black text-slate-900 mb-2">{t('cancelConfirmTitle')}</p>
              <p className="text-sm text-slate-500 mb-2 leading-relaxed">{t('cancelConfirmDesc')}</p>
              <p className="text-xs text-slate-400 mb-6">
                Prenumerationen avslutas <strong>{nextBillingStr}</strong>.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setCancelOpen(false)} disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  {t('cancelBack')}
                </button>
                <button onClick={handleCancel} disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                  {cancelling
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Avslutar…</>
                    : t('cancelConfirmButton')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
