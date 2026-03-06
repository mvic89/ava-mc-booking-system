'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import Sidebar from '@/components/Sidebar';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentCategory =
  | 'financing'
  | 'bnpl'
  | 'instant'
  | 'card_terminal'
  | 'card_online'
  | 'bank_transfer';

type FlowStep = 'idle' | 'initiating' | 'waiting' | 'success' | 'error';

interface EnabledProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: PaymentCategory;
  capabilities: string[];
  currencies: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<PaymentCategory, {
  label: string; color: string; bg: string; dot: string; border: string;
}> = {
  financing:     { label: 'Finansiering',          color: 'text-blue-700',    bg: 'bg-blue-50',    dot: 'bg-blue-500',    border: 'border-blue-100' },
  bnpl:          { label: 'Köp nu, betala senare', color: 'text-purple-700',  bg: 'bg-purple-50',  dot: 'bg-purple-500',  border: 'border-purple-100' },
  instant:       { label: 'Direktbetalning',       color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500', border: 'border-emerald-100' },
  card_terminal: { label: 'Kortterminal',          color: 'text-slate-700',   bg: 'bg-slate-50',   dot: 'bg-slate-500',   border: 'border-slate-200' },
  card_online:   { label: 'Kortbetalning online',  color: 'text-indigo-700',  bg: 'bg-indigo-50',  dot: 'bg-indigo-500',  border: 'border-indigo-100' },
  bank_transfer: { label: 'Banköverföring',        color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-500',   border: 'border-amber-100' },
};

const CATEGORY_ORDER: PaymentCategory[] = [
  'financing', 'bnpl', 'instant', 'card_terminal', 'card_online', 'bank_transfer',
];

const STEPS = ['Avtal', 'Förhandsvisning', 'Signering', 'Betalning', 'Klart'];

// Mocked deal data (in production this comes from the lead/agreement API)
const DEAL = {
  customer:       'Lars Bergman',
  vehicle:        'Kawasaki Ninja ZX-6R 2024',
  vin:            'JKBZXR636PA012345',   // used for Svea ArticleNumber
  agreementId:    'AGR-2024-0089',
  amountDisplay:  '133 280',
  amountSek:      133280,                // numeric SEK (for Svea)
  amountMinor:    13328000,              // öre (SEK × 100)
  amountDecimal:  '133280.00',
  currency:       'SEK',
  bankgiro:       '1234-5678',
  ocr:            '20240089',
  receiver:       'AVA MC AB',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgreementPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';

  const [ready, setReady]         = useState(false);
  const [loading, setLoading]     = useState(true);
  const [providers, setProviders] = useState<EnabledProvider[]>([]);
  const [selected, setSelected]   = useState<EnabledProvider | null>(null);

  // Swish phone
  const [phone, setPhone]         = useState('');
  // Copy bank details
  const [copied, setCopied]       = useState(false);
  // Final navigation
  const [confirming, setConfirming] = useState(false);

  // Payment flow
  const [flowStep, setFlowStep]           = useState<FlowStep>('idle');
  const [flowPaymentId, setFlowPaymentId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl]     = useState<string | null>(null);
  const [flowError, setFlowError]         = useState<string | null>(null);
  const [bankNotReceived, setBankNotReceived] = useState(false);

  // Klarna session (BNPL — returns client_token + categories, no redirect URL)
  const [klarnaSession, setKlarnaSession] = useState<{
    session_id:                string;
    client_token:              string;
    payment_method_categories: Array<{ identifier: string; name: string }>;
  } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Auth + load providers
  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    const user = JSON.parse(raw);
    const dealerId = (user.dealershipName ?? user.dealership ?? 'ava-mc')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    setReady(true);
    fetch(`/api/payments/enabled?dealerId=${dealerId}`)
      .then((r) => r.json())
      .then((data) => { setProviders(data.enabledProviders ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [router]);

  // Select provider + reset flow
  const selectProvider = (p: EnabledProvider) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setSelected(p);
    setPhone('');
    setCopied(false);
    setFlowStep('idle');
    setFlowError(null);
    setFlowPaymentId(null);
    setCheckoutUrl(null);
    setKlarnaSession(null);
    setBankNotReceived(false);
  };

  // Final: save to sessionStorage and navigate to complete
  const handleConfirm = () => {
    if (!selected) return;
    setConfirming(true);
    sessionStorage.setItem('selectedPaymentMethod',
      JSON.stringify({ id: selected.id, name: selected.name, icon: selected.icon, category: selected.category }));
    setTimeout(() => router.push(`/sales/leads/${id}/agreement/complete`), 700);
  };

  // ── Card Terminal Flow ──────────────────────────────────────────────────────
  const initiateTerminalPayment = async () => {
    setFlowStep('initiating');
    setFlowError(null);
    try {
      const endpoint = selected?.id.startsWith('adyen') ? '/api/adyen/terminal/payment'
        : selected?.id.startsWith('stripe') ? '/api/stripe/terminal/readers'
        : '/api/nets/terminal/payment';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:     DEAL.amountMinor,
          currency:   DEAL.currency,
          reference:  DEAL.agreementId,
          orderItems: [{
            reference:        DEAL.agreementId,
            name:             'Köpeavtal motorcykel',
            quantity:         1,
            unit:             'pcs',
            unitPrice:        DEAL.amountMinor,
            taxRate:          2500,
            taxAmount:        Math.round(DEAL.amountMinor * 0.25 / 1.25),
            netTotalAmount:   Math.round(DEAL.amountMinor / 1.25),
            grossTotalAmount: DEAL.amountMinor,
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Terminalbetalning misslyckades');
      const pid = data.paymentId ?? data.terminalPaymentId ?? data.id ?? null;
      setFlowPaymentId(pid);
      setFlowStep('waiting');
      if (pid) startPollingTerminal(pid);
    } catch (err: any) {
      setFlowError(err.message);
      setFlowStep('error');
    }
  };

  const startPollingTerminal = (paymentId: string) => {
    const endpoint = selected?.id.startsWith('adyen')
      ? `/api/adyen/terminal/payment/${paymentId}`
      : `/api/nets/terminal/payment/${paymentId}`;

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(endpoint);
        const data = await res.json();
        const status = (data.status ?? data.state ?? '').toLowerCase();
        if (['approved', 'completed', 'succeeded', 'paid'].includes(status)) {
          clearInterval(pollRef.current!); pollRef.current = null;
          setFlowStep('success');
        } else if (['declined', 'failed', 'cancelled', 'error'].includes(status)) {
          clearInterval(pollRef.current!); pollRef.current = null;
          setFlowError('Betalning avvisad av terminalen');
          setFlowStep('error');
        }
      } catch { /* keep polling */ }
    }, 2000);
  };

  // ── Swish Flow ──────────────────────────────────────────────────────────────
  const initiateSwishPayment = async () => {
    if (!phone.trim()) return;
    setFlowStep('initiating');
    setFlowError(null);
    try {
      const normalised = phone.replace(/\D/g, '').replace(/^0/, '46');
      const res = await fetch('/api/swish/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payeePaymentReference: DEAL.agreementId,
          callbackUrl: `${window.location.origin}/api/swish/callback`,
          payerAlias:  normalised,
          amount:      DEAL.amountDecimal,
          currency:    DEAL.currency,
          message:     `Betalning ${DEAL.agreementId}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Swish-förfrågan misslyckades');
      const pid = data.paymentId ?? data.id ?? null;
      setFlowPaymentId(pid);
      setFlowStep('waiting');
      if (pid) startPollingSwish(pid);
    } catch (err: any) {
      setFlowError(err.message);
      setFlowStep('error');
    }
  };

  const startPollingSwish = (paymentId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/swish/payment/${paymentId}`);
        const data = await res.json();
        const status = (data.status ?? '').toUpperCase();
        if (status === 'PAID') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setFlowStep('success');
        } else if (['DECLINED', 'ERROR', 'CANCELLED'].includes(status)) {
          clearInterval(pollRef.current!); pollRef.current = null;
          setFlowError('Swish-betalning avvisad');
          setFlowStep('error');
        }
      } catch { /* keep polling */ }
    }, 2000);
  };

  // ── Klarna Order — called by ActionPanel after Klarna.Payments.authorize() ──
  const handleKlarnaOrder = async (authorizationToken: string) => {
    try {
      const res = await fetch('/api/klarna/order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization_token: authorizationToken,
          agreementNumber:     DEAL.agreementId,
          vehicle:             DEAL.vehicle,
          balanceDue:          DEAL.amountSek,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Klarna-order misslyckades');
      if (data.fraud_status === 'REJECTED') throw new Error('Klarna avvisade betalningen (fraud_status: REJECTED)');
      setFlowStep('success');
    } catch (err: any) {
      setFlowError(err.message);
      setFlowStep('error');
    }
  };

  // ── Checkout / Session Link Flow (BNPL, Card Online, Trustly) ──────────────
  const createCheckoutLink = async () => {
    if (!selected) return;
    setFlowStep('initiating');
    setFlowError(null);

    // ── Klarna BNPL — creates a session (client_token + categories), no redirect URL ──
    if (selected.id === 'klarna') {
      try {
        const res = await fetch('/api/klarna/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agreementNumber: DEAL.agreementId,
            vehicle:         DEAL.vehicle,
            balanceDue:      DEAL.amountSek,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Klarna-session misslyckades');
        setKlarnaSession({
          session_id:                data.session_id,
          client_token:              data.client_token ?? '',
          payment_method_categories: data.payment_method_categories ?? [],
        });
        setFlowStep('waiting');
      } catch (err: any) {
        setFlowError(err.message);
        setFlowStep('error');
      }
      return;
    }

    try {
      let endpoint = '/api/qliro/checkout';
      let body: Record<string, unknown> = {};

      if (selected.id.startsWith('stripe')) {
        endpoint = '/api/stripe/payment-intent';
        body = { amount: DEAL.amountMinor, currency: DEAL.currency.toLowerCase() };
      } else if (selected.id.startsWith('trustly')) {
        endpoint = '/api/trustly/deposit';
        body = {
          notificationUrl: `${window.location.origin}/api/trustly/callback`,
          successUrl:      `${window.location.origin}/sales/leads/${id}/agreement/complete`,
          failUrl:         `${window.location.origin}/sales/leads/${id}/agreement/payment`,
          currency:        DEAL.currency,
          amount:          DEAL.amountDecimal,
          firstname:       DEAL.customer.split(' ')[0],
          lastname:        DEAL.customer.split(' ').slice(1).join(' '),
          email:           'customer@example.com',
          mobile:          '',
        };
      } else {
        body = {
          merchantReference: DEAL.agreementId,
          currency:          DEAL.currency,
          country:           'SE',
          orderItems: [{
            productCode: DEAL.agreementId,
            productName: 'Köpeavtal motorcykel',
            price:       DEAL.amountMinor,
            quantity:    1,
            vatPercent:  25,
          }],
        };
      }

      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Länk kunde inte skapas');

      const url = data.checkoutUrl ?? data.url ?? data.redirectUrl ?? null;
      setCheckoutUrl(url);
      setFlowStep('waiting');
      if (url && url.startsWith('http')) window.open(url, '_blank');
    } catch (err: any) {
      setFlowError(err.message);
      setFlowStep('error');
    }
  };

  // ── Svea Instore SMS Flow ───────────────────────────────────────────────────
  const initiateSveaFinancing = async () => {
    if (!phone.trim()) return;
    setFlowStep('initiating');
    setFlowError(null);
    try {
      const res = await fetch('/api/svea/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementNumber: DEAL.agreementId,
          customerPhone:   phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '').replace(/^0/, '46')}`,
          vehicleName:     DEAL.vehicle,
          vin:             DEAL.vin,
          balanceDue:      DEAL.amountSek,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Svea-order misslyckades');
      // store merchantOrderNumber for polling (not the numeric orderId)
      const poll = data.merchantOrderNumber ?? String(data.orderId);
      setFlowPaymentId(poll);
      // save the direct payment link so the salesperson can share it manually
      if (data.paymentLink) setCheckoutUrl(data.paymentLink);
      setFlowStep('waiting');
      startPollingSvea(poll);
    } catch (err: any) {
      setFlowError(err.message);
      setFlowStep('error');
    }
  };

  const startPollingSvea = (merchantOrderNumber: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/svea/order/${encodeURIComponent(merchantOrderNumber)}`);
        const data = await res.json();
        const status = (data.status ?? '').toLowerCase();
        if (status === 'confirmed') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setFlowStep('success');
        } else if (status === 'cancelled' || status === 'error') {
          clearInterval(pollRef.current!); pollRef.current = null;
          setFlowError('Finansieringsansökan avvisad eller avbruten');
          setFlowStep('error');
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  // ── Bank Transfer Check ─────────────────────────────────────────────────────
  const checkBankTransfer = async () => {
    setFlowStep('initiating');
    setBankNotReceived(false);
    try {
      const res  = await fetch(`/api/bank-transfer/check/${DEAL.ocr}`);
      const data = await res.json();
      if (data.received) {
        setFlowStep('success');
      } else {
        setFlowStep('idle');
        setBankNotReceived(true);
      }
    } catch {
      setFlowStep('idle');
      setBankNotReceived(true);
    }
  };

  const copyBankDetails = () => {
    navigator.clipboard?.writeText(
      `Bankgiro: ${DEAL.bankgiro}  |  OCR: ${DEAL.ocr}  |  Belopp: ${DEAL.amountDisplay} kr`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading gate ────────────────────────────────────────────────────────────
  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Group by category
  const grouped: Partial<Record<PaymentCategory, EnabledProvider[]>> = {};
  for (const p of providers) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category]!.push(p);
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* ── Page header ── */}
        <div className="bg-white border-b border-slate-100 animate-fade-up">

          {/* Breadcrumb + title */}
          <div className="px-5 md:px-8 pt-5 pb-4">
            <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
              <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Sales</Link>
              <span className="text-slate-200">›</span>
              <Link href={`/sales/leads/${id}/agreement`} className="hover:text-[#FF6B2C] transition-colors">Lead #{id}</Link>
              <span className="text-slate-200">›</span>
              <span className="text-slate-600 font-medium">Betalning</span>
            </nav>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-[#0b1524]">💳 Välj betalningsmetod</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Välj hur kunden betalar. Endast metoder aktiverade för er återförsäljare visas.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-green-700">Avtal signerat</span>
              </div>
            </div>
          </div>

          {/* Progress stepper */}
          <div className="px-5 md:px-8 pb-4">
            <div className="flex items-center">
              {STEPS.map((step, i) => {
                const isActive = i === 3;
                const isDone   = i < 3;
                return (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      isActive ? 'bg-[#FF6B2C] text-white shadow-sm' :
                      isDone   ? 'text-green-600' : 'text-slate-300'
                    }`}>
                      {isDone ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                          isActive ? 'bg-white/30' : 'bg-slate-100 text-slate-400'
                        }`}>{i + 1}</span>
                      )}
                      {step}
                    </div>
                    {i < STEPS.length - 1 && (
                      <span className={`mx-1 text-xs ${isDone ? 'text-green-300' : 'text-slate-200'}`}>›</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deal summary strip */}
          <div className="mx-5 md:mx-8 mb-4 bg-gradient-to-r from-[#0b1524] to-[#1a2a42] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <DealPill icon="👤" label="Kund"   value={DEAL.customer} />
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <DealPill icon="🏍️" label="Fordon" value={DEAL.vehicle} />
            <div className="w-px h-8 bg-white/10 hidden sm:block" />
            <DealPill icon="📄" label="Avtal"  value={DEAL.agreementId} />
            <div className="ml-auto text-right">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Totalt belopp</p>
              <p className="text-xl font-extrabold text-[#FF6B2C]">{DEAL.amountDisplay} kr</p>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 px-5 md:px-8 py-6">

          {/* Skeleton */}
          {loading && (
            <div className="flex gap-5">
              <div className="w-60 bg-white rounded-2xl border border-slate-100 animate-pulse p-4 space-y-3">
                <div className="h-3 bg-slate-100 rounded w-28" />
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-10 bg-slate-50 rounded-xl" />
                ))}
              </div>
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 animate-pulse h-80" />
            </div>
          )}

          {/* Empty state */}
          {!loading && providers.length === 0 && (
            <div className="max-w-md mx-auto text-center py-20 animate-fade-up">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-3xl mx-auto mb-5">⚙️</div>
              <h2 className="text-base font-bold text-slate-800 mb-2">Inga betalningsmetoder konfigurerade</h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Er återförsäljare har inte aktiverat några betalningsmetoder.
                Gå till Inställningar → Betalningsleverantörer för att konfigurera.
              </p>
              <Link
                href="/settings/payments"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0b1524] text-white text-sm font-bold hover:bg-[#1a2a42] transition-colors shadow-sm"
              >
                ⚙️ Konfigurera betalningsmetoder
              </Link>
            </div>
          )}

          {/* Main layout */}
          {!loading && providers.length > 0 && (
            <div className="flex flex-col xl:flex-row gap-5 animate-fade-up">

              {/* ── LEFT: compact provider list ── */}
              <div className="xl:w-[220px] shrink-0">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                  {/* List header */}
                  <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/60">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Betalningsmetoder</p>
                  </div>

                  {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    return (
                      <div key={cat}>
                        {/* Category divider */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 ${meta.bg} border-y ${meta.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>

                        {/* Compact provider rows */}
                        {grouped[cat]!.map((p, idx) => {
                          const isSelected = selected?.id === p.id;
                          const isLast     = idx === grouped[cat]!.length - 1;
                          return (
                            <button
                              key={p.id}
                              onClick={() => selectProvider(p)}
                              className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-all duration-100 ${
                                !isLast ? 'border-b border-slate-50' : ''
                              } ${isSelected
                                ? 'bg-orange-50 border-l-[3px] border-l-[#FF6B2C]'
                                : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
                              }`}
                            >
                              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${
                                isSelected ? 'bg-[#FF6B2C]/10' : meta.bg
                              }`}>
                                {p.icon}
                              </span>
                              <span className={`text-[13px] font-semibold flex-1 truncate leading-tight ${
                                isSelected ? 'text-[#FF6B2C]' : 'text-slate-700'
                              }`}>
                                {p.name}
                              </span>
                              {isSelected && (
                                <svg className="w-3 h-3 text-[#FF6B2C] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── RIGHT: action panel ── */}
              <div className="flex-1 min-w-0">
                <div className="sticky top-6">
                  {!selected ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl mx-auto mb-4">👈</div>
                      <p className="text-sm font-semibold text-slate-600">Välj en betalningsmetod</p>
                      <p className="text-xs text-slate-400 mt-1">Betalningsflödet visas här</p>
                    </div>
                  ) : (
                    <ActionPanel
                      provider={selected}
                      phone={phone}
                      copied={copied}
                      flowStep={flowStep}
                      flowPaymentId={flowPaymentId}
                      checkoutUrl={checkoutUrl}
                      klarnaSession={klarnaSession}
                      flowError={flowError}
                      bankNotReceived={bankNotReceived}
                      onPhoneChange={setPhone}
                      onConfirm={handleConfirm}
                      onCopy={copyBankDetails}
                      onInitiateTerminal={initiateTerminalPayment}
                      onInitiateSwish={initiateSwishPayment}
                      onInitiateSvea={initiateSveaFinancing}
                      onCreateCheckout={createCheckoutLink}
                      onCheckBankTransfer={checkBankTransfer}
                      onKlarnaOrder={handleKlarnaOrder}
                      onRetry={() => { setFlowStep('idle'); setFlowError(null); setKlarnaSession(null); setBankNotReceived(false); }}
                      confirming={confirming}
                    />
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Bottom nav */}
          {!loading && (
            <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
              <Link
                href={`/sales/leads/${id}/agreement/sign`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-all"
              >
                ← Tillbaka till signering
              </Link>

              {selected && flowStep === 'success' ? (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition-all"
                >
                  {confirming
                    ? <><Spinner />Behandlar…</>
                    : <>✅ Slutför och gå till kvitto →</>}
                </button>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {selected ? 'Slutför betalningen för att fortsätta' : 'Välj en metod för att fortsätta'}
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Deal Pill ────────────────────────────────────────────────────────────────

function DealPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function ActionPanel({
  provider, phone, copied, flowStep, flowPaymentId, checkoutUrl, klarnaSession, flowError,
  bankNotReceived, onPhoneChange, onConfirm, onCopy, onInitiateTerminal,
  onInitiateSwish, onInitiateSvea, onCreateCheckout, onCheckBankTransfer, onKlarnaOrder, onRetry, confirming,
}: {
  provider:            EnabledProvider;
  phone:               string;
  copied:              boolean;
  flowStep:            FlowStep;
  flowPaymentId:       string | null;
  checkoutUrl:         string | null;
  klarnaSession:       { session_id: string; client_token: string; payment_method_categories: Array<{ identifier: string; name: string }> } | null;
  flowError:           string | null;
  bankNotReceived:     boolean;
  onPhoneChange:       (v: string) => void;
  onConfirm:           () => void;
  onCopy:              () => void;
  onInitiateTerminal:  () => void;
  onInitiateSwish:     () => void;
  onInitiateSvea:      () => void;
  onCreateCheckout:    () => void;
  onCheckBankTransfer: () => void;
  onKlarnaOrder:       (authorizationToken: string) => Promise<void>;
  onRetry:             () => void;
  confirming:          boolean;
}) {
  const cat  = provider.category;
  const meta = CATEGORY_META[cat];

  const isIdle      = flowStep === 'idle' || flowStep === 'initiating';
  const isWaiting   = flowStep === 'waiting';
  const isSuccess   = flowStep === 'success';
  const isError     = flowStep === 'error';

  // ── Klarna widget state ────────────────────────────────────────────────────
  const [klarnaSDKReady,    setKlarnaSDKReady]    = useState(false);
  const [klarnaWidgetReady, setKlarnaWidgetReady] = useState(false);
  const [klarnaAuthorizing, setKlarnaAuthorizing] = useState(false);
  const [klarnaLocalError,  setKlarnaLocalError]  = useState<string | null>(null);
  const [klarnaCategory,    setKlarnaCategory]    = useState<string>('');

  // Init + load Klarna widget when session is active and SDK is ready
  useEffect(() => {
    if (!isWaiting || !klarnaSession?.client_token || !klarnaSDKReady) return;
    const w = window as any;
    if (!w.Klarna?.Payments) return;

    const category = klarnaCategory || klarnaSession.payment_method_categories[0]?.identifier || 'pay_later';
    if (!klarnaCategory) setKlarnaCategory(category);

    w.Klarna.Payments.init({ client_token: klarnaSession.client_token });
    w.Klarna.Payments.load(
      { container: '#klarna-payments-container', payment_method_category: category },
      {},
      (res: any) => { setKlarnaWidgetReady(res?.show_form ?? false); },
    );
  }, [isWaiting, klarnaSession, klarnaSDKReady, klarnaCategory]);

  const authorizeKlarna = () => {
    const w = window as any;
    if (!w.Klarna?.Payments || !klarnaCategory) return;
    setKlarnaAuthorizing(true);
    setKlarnaLocalError(null);
    w.Klarna.Payments.authorize(
      { payment_method_category: klarnaCategory },
      {},
      async (res: any) => {
        if (!res.approved || !res.authorization_token) {
          setKlarnaAuthorizing(false);
          setKlarnaLocalError(res.error?.invalid_fields?.join(', ') || 'Klarna-auktorisering avbröts eller misslyckades');
          return;
        }
        await onKlarnaOrder(res.authorization_token);
        setKlarnaAuthorizing(false);
      },
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md animate-fade-up">

      {/* Panel header */}
      <div className={`${meta.bg} border-b ${meta.border} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${meta.bg} border border-white shadow-sm`}>
            {provider.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{provider.name}</p>
            <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          </div>
          {isSuccess && (
            <div className="flex items-center gap-1.5 bg-green-100 border border-green-200 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-green-700">Betald</span>
            </div>
          )}
        </div>
      </div>

      {/* Amount strip */}
      <div className="px-5 py-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Belopp att inkassera</p>
        <p className="text-3xl font-extrabold text-[#0b1524]">{DEAL.amountDisplay} kr</p>
        <p className="text-xs text-slate-400 mt-0.5">Avtal {DEAL.agreementId} • inkl. 25% moms</p>
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* ── SUCCESS ── */}
        {isSuccess && (
          <>
            <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-bold text-green-800">Betalning genomförd!</p>
              <p className="text-xs text-green-600 mt-1">Bekräftad via {provider.name}</p>
              {flowPaymentId && (
                <p className="text-[10px] text-green-500 mt-2 font-mono">Ref: {flowPaymentId}</p>
              )}
            </div>
            <Btn label="Slutför och gå till kvitto →" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="green" />
          </>
        )}

        {/* ── TERMINAL WAITING ── */}
        {isWaiting && cat === 'card_terminal' && <TerminalWaiting />}

        {/* ── SWISH WAITING ── */}
        {isWaiting && cat === 'instant' && provider.id === 'swish' && <SwishWaiting phone={phone} />}

        {/* ── SVEA WAITING ── */}
        {isWaiting && cat === 'financing' && provider.id === 'svea' && (
          <SveaWaiting phone={phone} merchantOrderNumber={flowPaymentId} paymentLink={checkoutUrl} />
        )}

        {/* ── ERROR ── */}
        {isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs font-bold text-red-700 mb-1">Betalning misslyckades</p>
            <p className="text-xs text-red-600 leading-relaxed">{flowError}</p>
            <button onClick={onRetry} className="mt-3 w-full py-2 rounded-xl border border-red-300 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors">
              ↩ Försök igen
            </button>
          </div>
        )}

        {/* ── IDLE / INITIATING: category-specific forms ── */}
        {isIdle && !isSuccess && (
          <>

            {/* Svea — real SMS instore flow */}
            {cat === 'financing' && provider.id === 'svea' && (
              <>
                <InfoBox color="blue">
                  Ange kundens mobilnummer. En SMS-länk skickas direkt till kundens telefon.
                  Kunden väljer finansieringsplan och signerar med <strong>BankID</strong>.
                </InfoBox>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">
                    Kundens mobilnummer
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🇸🇪</span>
                    <input
                      type="tel"
                      placeholder="070 123 45 67"
                      value={phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/20 focus:border-[#FF6B2C] transition-all"
                    />
                  </div>
                </div>
                <Row label="Avtal" value={DEAL.agreementId} />
                <Row label="Belopp" value={`${DEAL.amountDisplay} kr`} />
                <Btn
                  label="Skicka finansieringslänk via SMS"
                  icon="📱"
                  onClick={onInitiateSvea}
                  loading={flowStep === 'initiating'}
                  loadingLabel="Skickar SMS…"
                  variant="dark"
                  disabled={!phone.trim()}
                />
              </>
            )}

            {/* Other financing providers (Santander, Resurs, etc.) — manual flow */}
            {cat === 'financing' && provider.id !== 'svea' && (
              <>
                <InfoBox color="blue">
                  Finansieringsansökan skickas till <strong>{provider.name}</strong> med
                  köpeavtal {DEAL.agreementId}. Kunden aviseras via SMS och e-post.
                </InfoBox>
                <Row label="Finansiär" value={provider.name} />
                <Row label="Avtal" value={DEAL.agreementId} />
                <Btn label="Markera som finansierad" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
              </>
            )}

            {/* BNPL — Klarna (session flow) */}
            {cat === 'bnpl' && provider.id === 'klarna' && (
              <>
                <InfoBox color="purple">
                  En <strong>Klarna-session</strong> skapas och kunden väljer betalningsplan
                  (faktura, delbetalning m.m.) direkt i Klarna-widgeten på er enhet.
                </InfoBox>
                <Btn
                  label="Skapa Klarna-session"
                  icon="🟣"
                  onClick={onCreateCheckout}
                  loading={flowStep === 'initiating'}
                  loadingLabel="Skapar session…"
                  variant="outline"
                />
                <Btn label="Markera som betald" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
              </>
            )}

            {/* BNPL — other providers (checkout URL flow) */}
            {cat === 'bnpl' && provider.id !== 'klarna' && (
              <>
                <InfoBox color="purple">
                  Kunden slutför köpet i <strong>{provider.name}</strong>:s checkout-flöde.
                  En betalningslänk öppnas i nytt fönster.
                </InfoBox>
                {checkoutUrl ? (
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-purple-600 underline break-all rounded-xl bg-purple-50 border border-purple-100 px-3 py-2.5">
                    🔗 {checkoutUrl}
                  </a>
                ) : (
                  <Btn label={`Öppna ${provider.name} Checkout`} icon="🔗" onClick={onCreateCheckout} loading={flowStep === 'initiating'} loadingLabel="Öppnar checkout…" variant="outline" />
                )}
                <Btn label="Markera som betald" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
              </>
            )}

            {/* Swish */}
            {cat === 'instant' && provider.id === 'swish' && (
              <>
                <InfoBox color="green">
                  Ange kundens mobilnummer för att skicka en <strong>Swish-förfrågan</strong> på {DEAL.amountDisplay} kr direkt till deras telefon.
                </InfoBox>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">Kundens mobilnummer</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🇸🇪</span>
                    <input
                      type="tel"
                      placeholder="070 123 45 67"
                      value={phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B2C]/20 focus:border-[#FF6B2C] transition-all"
                    />
                  </div>
                </div>
                <Btn
                  label="Skicka Swish-förfrågan"
                  icon="💚"
                  onClick={onInitiateSwish}
                  loading={flowStep === 'initiating'}
                  loadingLabel="Skickar förfrågan…"
                  variant="swish"
                  disabled={!phone.trim()}
                />
              </>
            )}

            {/* Trustly / BankID Pay */}
            {cat === 'instant' && provider.id !== 'swish' && (
              <>
                <InfoBox color="green">
                  Generera en säker betalningslänk och skicka till kunden för direktbetalning via <strong>{provider.name}</strong>.
                </InfoBox>
                {checkoutUrl ? (
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-emerald-600 underline break-all rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                    🔗 {checkoutUrl}
                  </a>
                ) : (
                  <Btn label="Generera betalningslänk" icon="🔗" onClick={onCreateCheckout} loading={flowStep === 'initiating'} loadingLabel="Genererar länk…" variant="outline" />
                )}
                <Btn label="Markera som betald" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
              </>
            )}

            {/* Card Terminal */}
            {cat === 'card_terminal' && (
              <>
                <div className="rounded-xl bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Belopp till terminal</p>
                      <p className="text-2xl font-extrabold text-white">{DEAL.amountDisplay} kr</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Klicka nedan för att skicka beloppet.<br />Kunden blippar eller sätter in kortet.
                      </p>
                    </div>
                    <div className="text-5xl opacity-60">💳</div>
                  </div>
                </div>
                <Btn
                  label={`Skicka ${DEAL.amountDisplay} kr till terminal`}
                  icon="📡"
                  onClick={onInitiateTerminal}
                  loading={flowStep === 'initiating'}
                  loadingLabel="Skickar till terminal…"
                  variant="dark"
                />
              </>
            )}

            {/* Card Online */}
            {cat === 'card_online' && (
              <>
                <InfoBox color="indigo">
                  Kunden betalar via <strong>{provider.name}</strong>:s kortbetalningsformulär.
                  En betalningssession skapas och länken skickas till kunden.
                </InfoBox>
                {checkoutUrl ? (
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-indigo-600 underline break-all rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                    🔗 {checkoutUrl}
                  </a>
                ) : (
                  <Btn label="Skapa kortbetalningssession" icon="🔗" onClick={onCreateCheckout} loading={flowStep === 'initiating'} loadingLabel="Skapar session…" variant="outline" />
                )}
                <Btn label="Markera som betald" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
              </>
            )}

            {/* Bank Transfer */}
            {cat === 'bank_transfer' && (
              <>
                <InfoBox color="amber">
                  Dela nedanstående betalningsinformation med kunden. Verifiera mottagen betalning via knappen nedan.
                </InfoBox>
                <div className="bg-amber-50 border border-amber-100 rounded-xl divide-y divide-amber-100 overflow-hidden">
                  <BankRow label="Bankgiro"      value={DEAL.bankgiro} mono />
                  <BankRow label="OCR / Referens" value={DEAL.ocr}     mono />
                  <BankRow label="Belopp"         value={`${DEAL.amountDisplay} kr`} bold />
                  <BankRow label="Mottagare"      value={DEAL.receiver} />
                </div>
                <button
                  onClick={onCopy}
                  className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    copied
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {copied ? <>✓ Kopierat!</> : <>📋 Kopiera betalningsinformation</>}
                </button>
                {bankNotReceived && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5">
                    <p className="text-xs text-amber-700">⏳ Betalning ej mottagen än. Kontrollera igen om en stund.</p>
                  </div>
                )}
                <Btn label="Kontrollera betalning" icon="🔍" onClick={onCheckBankTransfer} loading={flowStep === 'initiating'} loadingLabel="Kontrollerar…" variant="outline" />
                <Btn label="Markera som betald manuellt" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
              </>
            )}
          </>
        )}

        {/* ── KLARNA WAITING: SDK + widget ── */}
        {isWaiting && cat === 'bnpl' && provider.id === 'klarna' && (
          <>
            {/* Load Klarna JS SDK once */}
            <Script
              src="https://x.klarnacdn.net/kp/lib/v1/api.js"
              strategy="afterInteractive"
              onLoad={() => setKlarnaSDKReady(true)}
            />

            <div className="rounded-2xl bg-[#17120e] p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <p className="text-sm font-bold text-white">Klarna-session aktiv</p>
              </div>

              {/* Category tabs (show when multiple plans available) */}
              {klarnaSession && klarnaSession.payment_method_categories.length > 1 && (
                <div>
                  <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider">Välj betalplan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {klarnaSession.payment_method_categories.map((c) => (
                      <button
                        key={c.identifier}
                        onClick={() => setKlarnaCategory(c.identifier)}
                        className={`text-[11px] rounded-full px-2.5 py-0.5 font-medium border transition-colors ${
                          klarnaCategory === c.identifier
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-purple-900/60 border-purple-700 text-purple-200 hover:bg-purple-800/60'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Klarna widget mount point */}
              <div
                id="klarna-payments-container"
                className="rounded-xl overflow-hidden bg-white min-h-[80px] flex items-center justify-center"
              >
                {!klarnaSDKReady && (
                  <div className="flex items-center gap-2 py-4">
                    <Spinner />
                    <span className="text-xs text-slate-400">Laddar Klarna…</span>
                  </div>
                )}
              </div>

              {/* Error */}
              {klarnaLocalError && (
                <div className="rounded-xl bg-red-900/40 border border-red-700 px-3 py-2">
                  <p className="text-xs text-red-300">{klarnaLocalError}</p>
                </div>
              )}

              {/* Instruction */}
              {klarnaWidgetReady && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kunden fyller i sina uppgifter i widgeten ovan och trycker sedan på knappen nedan för att godkänna.
                </p>
              )}
            </div>

            {/* Authorize button */}
            <Btn
              label="Betala med Klarna"
              icon="🟣"
              onClick={authorizeKlarna}
              loading={klarnaAuthorizing}
              loadingLabel="Auktoriserar…"
              variant="dark"
              disabled={!klarnaWidgetReady || klarnaAuthorizing}
            />
          </>
        )}

        {/* ── WAITING: non-terminal/swish/svea/klarna — show mark-as-paid ── */}
        {isWaiting && cat !== 'card_terminal'
          && !(cat === 'instant' && provider.id === 'swish')
          && !(cat === 'financing' && provider.id === 'svea')
          && !(cat === 'bnpl' && provider.id === 'klarna')
          && (
          <>
            <InfoBox color="amber">
              Väntar på kundens betalning. Klicka nedan när betalningen är genomförd.
            </InfoBox>
            {checkoutUrl && (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="block text-xs text-blue-600 underline break-all rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                🔗 Öppna checkout igen
              </a>
            )}
            <Btn label="Markera som betald" icon="✅" onClick={onConfirm} loading={confirming} loadingLabel="Behandlar…" variant="dark" />
          </>
        )}

      </div>
    </div>
  );
}

// ─── Terminal Waiting Animation ───────────────────────────────────────────────

function TerminalWaiting() {
  return (
    <div className="rounded-2xl bg-slate-900 p-5">
      <div className="flex flex-col items-center">
        {/* Terminal mockup */}
        <div className="w-32 h-44 bg-slate-800 rounded-2xl border-2 border-slate-700 shadow-xl flex flex-col items-center justify-start p-3 mb-4">
          {/* Screen */}
          <div className="w-full bg-[#0d1f0d] rounded-lg border border-green-900 p-2 mb-2">
            <p className="text-green-400 text-[9px] font-mono text-center font-bold">{DEAL.amountDisplay} kr</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-green-600 text-[7px] font-mono">VÄNTAR PÅ KORT</p>
            </div>
          </div>
          {/* Keypad rows */}
          {[[1,2,3],[4,5,6],[7,8,9],[null,0,null]].map((row, ri) => (
            <div key={ri} className="flex gap-1 mb-1">
              {row.map((k, ki) => (
                k !== null
                  ? <div key={ki} className="w-6 h-5 bg-slate-700 rounded text-[8px] text-slate-400 flex items-center justify-center font-mono">{k}</div>
                  : <div key={ki} className="w-6 h-5" />
              ))}
            </div>
          ))}
        </div>
        {/* Status text */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-sm font-bold text-white">Väntar på betalning…</p>
        </div>
        <p className="text-xs text-slate-400 text-center">Kunden blippar eller sätter in kortet på terminalen</p>
        {/* Animated dots */}
        <div className="flex gap-1.5 mt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Swish Waiting Animation ──────────────────────────────────────────────────

function SwishWaiting({ phone }: { phone: string }) {
  return (
    <div className="rounded-2xl bg-[#00B227] p-5 text-center">
      <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-3xl mx-auto mb-3 animate-bounce">
        💚
      </div>
      <p className="text-sm font-bold text-white mb-1">Swish-förfrågan skickad!</p>
      <p className="text-xs text-green-100 leading-relaxed mb-3">
        Förfrågan skickad till <strong className="text-white">{phone}</strong>.<br />
        Väntar på att kunden godkänner i Swish-appen.
      </p>
      <div className="flex items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-white/60 animate-bounce"
            style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Svea Waiting Animation ───────────────────────────────────────────────────

function SveaWaiting({
  phone, merchantOrderNumber, paymentLink,
}: {
  phone: string;
  merchantOrderNumber: string | null;
  paymentLink: string | null;
}) {
  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = () => {
    if (!paymentLink) return;
    navigator.clipboard?.writeText(paymentLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className="rounded-2xl bg-[#003087] p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
          <p className="text-sm font-bold text-white">SMS skickat via Svea</p>
        </div>
        <p className="text-xs text-blue-200 leading-relaxed mb-3">
          Finansieringslänk skickad till <strong className="text-white">{phone}</strong>.<br />
          Kunden väljer plan och signerar med BankID.
        </p>
        {merchantOrderNumber && (
          <p className="text-[10px] text-blue-400 font-mono">Order: {merchantOrderNumber}</p>
        )}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>

      {/* Direct link fallback — for test environments where SMS may not arrive */}
      {paymentLink ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-bold text-amber-800 mb-1">
            💡 SMS ej mottaget? Dela länken manuellt
          </p>
          <p className="text-[10px] text-amber-600 mb-2 leading-relaxed">
            I testmiljön kan SMS vara försenat. Öppna eller kopiera länken nedan.
          </p>
          <p className="text-[10px] text-amber-700 font-mono break-all bg-amber-100 rounded-lg px-2 py-1.5 mb-2">
            {paymentLink}
          </p>
          <div className="flex gap-2">
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold text-center transition-colors"
            >
              🔗 Öppna länk
            </a>
            <button
              onClick={copyLink}
              className={`flex-1 py-2 rounded-lg border text-xs font-bold transition-colors ${
                linkCopied
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
              }`}
            >
              {linkCopied ? '✓ Kopierad!' : '📋 Kopiera'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
          <p className="text-xs text-slate-500 text-center">
            ⏳ Väntar på Svea-svar för direktlänk…
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function InfoBox({ children, color }: { children: React.ReactNode; color: string }) {
  const s: Record<string, string> = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    green:  'bg-emerald-50 border-emerald-100 text-emerald-700',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
  };
  return (
    <div className={`text-xs leading-relaxed px-3.5 py-3 rounded-xl border ${s[color] ?? s.amber}`}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function BankRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 text-xs">
      <span className="text-amber-600">{label}</span>
      <span className={`text-slate-800 ${mono ? 'font-mono tracking-wide' : ''} ${bold ? 'font-extrabold text-sm' : 'font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}

function Spinner() {
  return <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-80" />;
}

function Btn({
  label, icon, onClick, loading, loadingLabel, variant = 'dark', disabled = false,
}: {
  label:       string;
  icon:        string;
  onClick:     () => void;
  loading?:    boolean;
  loadingLabel?: string;
  variant?:    'dark' | 'outline' | 'swish' | 'green';
  disabled?:   boolean;
}) {
  const base = 'w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed';
  const v: Record<string, string> = {
    dark:    'bg-[#0b1524] hover:bg-[#1a2a42] active:bg-[#071020] text-white shadow-sm',
    outline: 'border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700',
    swish:   'bg-[#00B227] hover:bg-[#009e22] active:bg-[#008a1e] text-white shadow-sm',
    green:   'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-sm',
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${v[variant]}`}>
      {loading ? <><Spinner />{loadingLabel ?? 'Behandlar…'}</> : <>{icon} {label}</>}
    </button>
  );
}
