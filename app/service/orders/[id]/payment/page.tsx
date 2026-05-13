'use client';

import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import { getDealershipId } from '@/lib/tenant';
import { getDealerInfo } from '@/lib/dealer';
import { markInvoicePaidById } from '@/lib/invoices';
import { getWorkOrder, type WorkOrder, type WorkOrderTask, type WorkOrderPart } from '@/lib/service';
import { emit } from '@/lib/realtime';

// ── Types ─────────────────────────────────────────────────────────────────────

type Method    = 'swish' | 'card' | 'bank_transfer' | 'klarna' | 'cash';
type FlowStep  = 'idle' | 'processing' | 'success' | 'failed';

interface InvoiceRow {
  id: string;
  total_amount: number;
  vat_amount:   number;
  net_amount:   number;
  status:       string;
  customer_name:string;
  vehicle:      string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return `${n.toLocaleString('sv-SE')} kr`; }

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-[#FF6B2C]' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

// ── Swish flow ─────────────────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useTranslations<'service'>>;

function SwishFlow({ amount, invoiceId, payRef, customerPhone, onPaid, t }: {
  amount: number; invoiceId: string; payRef: string; customerPhone: string; onPaid: () => void; t: TFunc;
}) {
  const dealerInfo  = getDealerInfo();
  const swishNumber = dealerInfo.swish;
  const paymentRef  = invoiceId || payRef;
  const [phone,    setPhone]    = useState(customerPhone ?? '');
  const [step,     setStep]     = useState<'idle' | 'waiting' | 'done' | 'fail'>('idle');
  const [reqId,    setReqId]    = useState('');
  const [pollCount,setPollCount]= useState(0);

  const send = async () => {
    if (!phone) { toast.error(t('payment.swish.errorPhone')); return; }
    setStep('waiting');
    try {
      const normalised = phone.startsWith('07') ? phone.replace('07', '+467') : phone;
      const res = await fetch('/api/swish/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalised, amount, message: `Serviceorder ${paymentRef}`, payerAlias: normalised, orderId: paymentRef }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReqId(data.paymentId ?? data.id ?? '');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Swish error');
      setStep('fail');
    }
  };

  useEffect(() => {
    if (step !== 'waiting' || !reqId) return;
    const iv = setInterval(async () => {
      setPollCount(c => c + 1);
      const res = await fetch(`/api/swish/payment/${reqId}`).catch(() => null);
      if (!res) return;
      const data = await res.json();
      if (data.status === 'PAID') { clearInterval(iv); setStep('done'); onPaid(); }
      else if (data.status === 'DECLINED' || data.status === 'ERROR') {
        clearInterval(iv); setStep('fail');
        toast.error(`${t('payment.swish.errorDeclined')} ${data.errorCode ?? ''}`);
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [step, reqId, onPaid, t]);

  return (
    <div className="space-y-5">
      {/* Amount */}
      <div className="bg-slate-50 rounded-xl p-5 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{t('payment.swish.amountLabel')}</p>
        <p className="text-4xl font-black text-slate-900">{amount.toLocaleString('sv-SE')} kr</p>
        <p className="text-xs text-slate-400 mt-1">{t('payment.swish.ref')} {paymentRef}</p>
      </div>

      {/* Swish number */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{t('payment.swish.merchantNum')}</p>
        {swishNumber ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00B4B0] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xs">S</span>
            </div>
            <p className="text-lg font-black text-slate-900">{swishNumber}</p>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 rounded-lg p-3">
            <span className="text-amber-500 shrink-0">⚠</span>
            <p className="text-xs"><strong>{t('payment.swish.notConfigured')}</strong>{' '}{t('payment.swish.configureLink')}{' '}
              <a href="/settings" className="underline hover:text-amber-900">{t('payment.swish.configureWhere')}</a>.</p>
          </div>
        )}
      </div>

      {step === 'idle' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t('payment.swish.sendRequest')}</p>
          <div className="flex gap-2">
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder={t('payment.swish.phonePlaceholder')}
              className="flex-1 text-sm px-4 py-3 rounded-xl border border-slate-200 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none" />
            <button onClick={send} disabled={!phone}
              className="px-5 py-3 rounded-xl bg-[#ef2362] hover:bg-[#d41d58] disabled:opacity-40 text-white text-sm font-bold transition-colors whitespace-nowrap">
              {t('payment.swish.sendBtn')}
            </button>
          </div>
          <p className="text-xs text-slate-400">{t('payment.swish.hint')}</p>
        </div>
      )}

      {step === 'waiting' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm font-bold text-amber-700">{t('payment.swish.waiting')}</p>
            </div>
            <p className="text-xs text-slate-500">{t('payment.swish.waitHint')} <strong>{fmt(amount)}</strong> {t('payment.swish.withRef')} <strong>{paymentRef}</strong>.</p>
            {reqId && <p className="text-xs text-slate-400 mt-1">{pollCount} {t('payment.swish.polls')} {reqId.slice(0,12)}…</p>}
          </div>
          <button onClick={() => { setStep('done'); onPaid(); }}
            className="w-full py-3 rounded-xl bg-[#ef2362] hover:bg-[#d41d58] text-white text-sm font-bold transition-colors">
            {t('payment.swish.confirmBtn')}
          </button>
          <button onClick={() => { setStep('idle'); setReqId(''); setPollCount(0); }}
            className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors">{t('payment.swish.cancelBtn')}</button>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-700">{t('payment.swish.confirmed')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{fmt(amount)} {t('payment.swish.received')} {paymentRef}</p>
        </div>
      )}

      {step === 'fail' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">{t('payment.swish.failed')}</p>
          <button onClick={() => setStep('idle')} className="mt-2 text-xs text-[#FF6B2C] font-semibold hover:underline">{t('payment.swish.retry')}</button>
        </div>
      )}
    </div>
  );
}

// ── Card / Nets AXEPT terminal flow ───────────────────────────────────────────

type TerminalStep = 'idle' | 'amount_shown' | 'awaiting_card' | 'processing' | 'confirmed' | 'declined';

function CardFlow({ amount, onPaid, t }: { amount: number; onPaid: () => void; t: TFunc }) {
  const [step, setStep]     = useState<TerminalStep>('idle');
  const [txId]              = useState('NETS-' + Math.random().toString(36).slice(2, 10).toUpperCase());
  const [authCode]          = useState('A' + Math.random().toString(36).slice(2, 7).toUpperCase());

  const terminalSteps = [
    { id: 'idle',          label: t('payment.card.ready'),       desc: '' },
    { id: 'amount_shown',  label: t('payment.card.waitSent'),    desc: '' },
    { id: 'awaiting_card', label: t('payment.card.waitTap'),     desc: '' },
    { id: 'processing',    label: t('payment.card.authorising'), desc: '' },
    { id: 'confirmed',     label: t('payment.card.confirmed'),   desc: '' },
  ] as const;

  const stepIndex = terminalSteps.findIndex(s => s.id === step);

  const buildScreen = () => {
    const amt = amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) + ' SEK';
    const screens: Record<TerminalStep, { line1: string; line2: string; line3: string; bg: string; textColor: string }> = {
      idle:          { line1: 'NETS AXEPT',  line2: 'NETS-STH-001', line3: t('payment.card.ready'),       bg: '#1e293b', textColor: '#94a3b8' },
      amount_shown:  { line1: 'SERVICE',     line2: amt,             line3: t('payment.card.waitSent'),    bg: '#1e3a5f', textColor: '#93c5fd' },
      awaiting_card: { line1: amt,           line2: amt,             line3: t('payment.card.waitTap'),     bg: '#1e3a5f', textColor: '#fbbf24' },
      processing:    { line1: '...',         line2: amt,             line3: t('payment.card.authorising'), bg: '#1e3a5f', textColor: '#f97316' },
      confirmed:     { line1: t('payment.card.approved'), line2: `CODE: ${authCode}`, line3: '✓', bg: '#14532d', textColor: '#86efac' },
      declined:      { line1: t('payment.card.declined'), line2: 'CODE: DECLINED', line3: t('payment.card.retry'), bg: '#7f1d1d', textColor: '#fca5a5' },
    };
    return screens[step];
  };

  const screen = buildScreen();

  const handleInitiate = () => {
    setStep('amount_shown');
    setTimeout(() => {
      setStep('awaiting_card');
      setTimeout(() => {
        setStep('processing');
        setTimeout(() => { setStep('confirmed'); onPaid(); }, 2200);
      }, 3000);
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-[#0b1524] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black">NETS</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{t('payment.card.title')}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">{t('payment.card.contactless')}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{t('payment.card.terminalId')} NETS-STH-001</p>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
          step === 'confirmed' ? 'bg-green-600 text-white' :
          step === 'declined'  ? 'bg-red-600 text-white'   :
          step === 'idle'      ? 'bg-slate-400 text-white'  : 'bg-amber-500 text-white'
        }`}>
          {step === 'idle' ? t('payment.card.ready') : step === 'confirmed' ? t('payment.card.approved') : step === 'declined' ? t('payment.card.declined') : t('payment.card.active')}
        </span>
      </div>

      {/* Contactless banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="4" fill="#2563eb" />
          <path d="M8 14a6 6 0 0 1 6-6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <path d="M8 14a6 6 0 0 0 6 6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <path d="M20 14a6 6 0 0 1-6 6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <path d="M20 14a6 6 0 0 0-6-6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
          <path d="M4.5 14a9.5 9.5 0 0 1 9.5-9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
          <path d="M4.5 14a9.5 9.5 0 0 0 9.5 9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
          <path d="M23.5 14a9.5 9.5 0 0 1-9.5 9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
          <path d="M23.5 14a9.5 9.5 0 0 0-9.5-9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
        </svg>
        <div>
          <p className="text-sm font-bold text-blue-800">{t('payment.card.tapHint')}</p>
          <p className="text-xs text-blue-600">{t('payment.card.tapSub')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Terminal screen */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{t('payment.card.screenTitle')}</p>
          <div className="rounded-xl p-5 font-mono transition-all duration-500" style={{ backgroundColor: screen.bg }}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${
                step === 'confirmed' ? 'bg-green-400' : step === 'declined' ? 'bg-red-400' :
                step === 'idle'      ? 'bg-slate-500' : 'bg-amber-400 animate-pulse'}`} />
              <span className="text-slate-500 text-[10px]">NETS AXEPT B5</span>
            </div>
            <div className="space-y-1.5" style={{ color: screen.textColor }}>
              <p className="text-[10px] opacity-60">{screen.line1}</p>
              <p className="text-xl font-bold tracking-wider">{screen.line2}</p>
              <p className={`text-xs tracking-widest mt-3 ${step === 'processing' ? 'animate-pulse' : ''}`}>{screen.line3}</p>
            </div>
            {step === 'awaiting_card' && (
              <div className="mt-4 flex flex-col items-center">
                <div className="relative flex items-center justify-center w-14 h-14">
                  <div className="absolute w-14 h-14 rounded-full border-2 border-amber-400 opacity-30 animate-ping" />
                  <div className="absolute w-10 h-10 rounded-full border-2 border-amber-400 opacity-50 animate-ping" style={{ animationDelay: '0.2s' }} />
                  <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="4" fill="#fbbf24" />
                    <path d="M8 14a6 6 0 0 1 6-6" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
                    <path d="M8 14a6 6 0 0 0 6 6" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
                    <path d="M20 14a6 6 0 0 1-6 6" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
                    <path d="M20 14a6 6 0 0 0-6-6" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
                  </svg>
                </div>
                <p className="text-[9px] text-amber-400 tracking-widest mt-1">NFC</p>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-1 rounded flex-1 transition-all duration-700 ${
                step === 'awaiting_card' || step === 'processing' ? 'bg-amber-400' :
                step === 'confirmed' ? 'bg-green-400' : 'bg-slate-700'}`} />
              <div className={`h-1 rounded flex-1 transition-all duration-700 ${
                step === 'awaiting_card' || step === 'processing' ? 'bg-amber-400' :
                step === 'confirmed' ? 'bg-green-400' : 'bg-slate-700'}`} />
            </div>
            <p className="text-slate-700 text-[9px] mt-3">{txId}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{t('payment.card.amountLabel')}</p>
            <p className="text-3xl font-black text-slate-900">{amount.toLocaleString('sv-SE')} kr</p>
            <p className="text-xs text-slate-400 mt-1">SEK · {t('payment.card.title')} · {txId}</p>
          </div>
          <div className="space-y-2">
            {terminalSteps.map((s, i) => {
              const done = stepIndex > i;
              const curr = stepIndex === i && step !== 'idle';
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
                    done ? 'bg-green-500 text-white' : curr ? 'bg-amber-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className={`text-xs font-semibold ${done ? 'text-green-700' : curr ? 'text-amber-700' : 'text-slate-400'}`}>{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {step === 'idle' && (
        <button onClick={handleInitiate}
          className="w-full py-3.5 rounded-xl bg-[#0b1524] hover:bg-[#1a2a42] text-white text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="4" fill="white" />
            <path d="M8 14a6 6 0 0 1 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M8 14a6 6 0 0 0 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M20 14a6 6 0 0 1-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M20 14a6 6 0 0 0-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
          </svg>
          {t('payment.card.sendBtn')}
        </button>
      )}

      {(step === 'amount_shown' || step === 'awaiting_card' || step === 'processing') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm font-bold text-amber-700">
            {step === 'amount_shown'  ? t('payment.card.waitSent') :
             step === 'awaiting_card' ? t('payment.card.waitTap')   : t('payment.card.authorising')}
          </p>
        </div>
      )}

      {step === 'confirmed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-700">{t('payment.card.confirmed')}</p>
          <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
            <div><p className="text-slate-400">{t('payment.card.authCode')}</p><p className="font-mono font-bold text-slate-800">{authCode}</p></div>
            <div><p className="text-slate-400">{t('payment.card.amount')}</p><p className="font-bold text-slate-800">{fmt(amount)}</p></div>
            <div><p className="text-slate-400">{t('payment.card.transaction')}</p><p className="font-mono font-bold text-slate-800 text-[10px]">{txId}</p></div>
          </div>
        </div>
      )}

      {step === 'declined' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">{t('payment.card.errorTitle')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('payment.card.errorHint')}</p>
          <button onClick={() => setStep('idle')} className="mt-2 text-xs text-red-500 hover:underline">{t('payment.card.retry')}</button>
        </div>
      )}
    </div>
  );
}

// ── Bank Transfer ──────────────────────────────────────────────────────────────

function BankTransferFlow({ invoiceId, amount, onPaid, t }: { invoiceId: string; amount: number; onPaid: () => void; t: TFunc }) {
  const dealer    = getDealerInfo();
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest">{t('payment.bank.title')}</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">{t('payment.bank.bankgiro')}</span><span className="font-bold">{dealer.bankgiro || '9999-9999'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t('payment.bank.iban')}</span><span className="font-bold font-mono text-xs">{dealer.iban || 'SE12 3456 7890 1234 5678'}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t('payment.bank.bic')}</span><span className="font-bold">{dealer.bic || 'ESSESESS'}</span></div>
          <div className="flex justify-between border-t border-blue-200 pt-2"><span className="text-slate-500">{t('payment.bank.message')}</span><span className="font-bold">{invoiceId}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">{t('payment.bank.amount')}</span><span className="font-bold text-[#FF6B2C]">{fmt(amount)}</span></div>
        </div>
      </div>
      <p className="text-xs text-slate-400 text-center">{t('payment.bank.hint')} ({invoiceId}) {t('payment.bank.hintEnd')}</p>
      {!confirmed ? (
        <button onClick={() => { setConfirmed(true); onPaid(); }}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
          {t('payment.bank.confirmBtn')}
        </button>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-sm font-bold text-emerald-700">{t('payment.bank.confirmed')}</div>
      )}
    </div>
  );
}

// ── Klarna flow ────────────────────────────────────────────────────────────────

interface KlarnaCategory { identifier: string; name: string }
type KlarnaFlowStatus = 'init' | 'sdk_loading' | 'selecting' | 'widget_loading' | 'widget_ready' | 'authorizing' | 'placing' | 'confirmed' | 'failed';

function KlarnaFlow({ amount, invoiceId, onPaid, t }: { amount: number; invoiceId: string; onPaid: () => void; t: TFunc }) {
  const [flowStatus,    setFlowStatus]    = useState<KlarnaFlowStatus>('init');
  const [categories,    setCategories]    = useState<KlarnaCategory[]>([]);
  const [selectedCat,   setSelectedCat]   = useState('');
  const [clientToken,   setClientToken]   = useState('');
  const [klarnaOrderId, setKlarnaOrderId] = useState('');
  const [errorMsg,      setErrorMsg]      = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch('/api/klarna/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agreementNumber: invoiceId, vehicle: 'Serviceorder', balanceDue: amount }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (cancelled) return;
        setClientToken(data.client_token);
        setCategories(data.payment_method_categories ?? []);
        setFlowStatus('sdk_loading');
      } catch (err: unknown) {
        if (!cancelled) { setErrorMsg(err instanceof Error ? err.message : t('payment.klarna.errorTitle')); setFlowStatus('failed'); }
      }
    })();
    return () => { cancelled = true; };
  }, [invoiceId, amount, t]);

  useEffect(() => {
    if (flowStatus !== 'sdk_loading' || !clientToken) return;
    if (window.Klarna) { window.Klarna.Payments.init({ client_token: clientToken }); setFlowStatus('selecting'); return; }
    const script   = document.createElement('script');
    script.src     = 'https://x.klarnacdn.net/kp/lib/v1/api.js';
    script.async   = true;
    script.onload  = () => { window.Klarna?.Payments.init({ client_token: clientToken }); setFlowStatus('selecting'); };
    script.onerror = () => { setErrorMsg(t('payment.klarna.errorTitle')); setFlowStatus('failed'); };
    document.head.appendChild(script);
  }, [flowStatus, clientToken, t]);

  const selectCategory = (id: string) => {
    if (!window.Klarna) return;
    setSelectedCat(id); setFlowStatus('widget_loading');
    window.Klarna.Payments.load({ container: '#klarna-payments-container', payment_method_category: id }, {}, res => {
      if (res.show_form) setFlowStatus('widget_ready');
      else { setErrorMsg(t('payment.klarna.errorShow')); setFlowStatus('selecting'); }
    });
  };

  const authorize = () => {
    if (!window.Klarna || !selectedCat) return;
    setFlowStatus('authorizing');
    window.Klarna.Payments.authorize({ payment_method_category: selectedCat, auto_finalize: true }, {}, async res => {
      if (!res.approved || !res.authorization_token) {
        setErrorMsg(t('payment.klarna.errorDeclined')); setFlowStatus('widget_ready'); return;
      }
      setFlowStatus('placing');
      try {
        const r = await fetch('/api/klarna/order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorization_token: res.authorization_token, agreementNumber: invoiceId, vehicle: 'Serviceorder', balanceDue: amount }),
        });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        setKlarnaOrderId(data.order_id);
        setFlowStatus('confirmed'); onPaid();
      } catch (err: unknown) { setErrorMsg(err instanceof Error ? err.message : t('payment.klarna.errorTitle')); setFlowStatus('widget_ready'); }
    });
  };

  const KLARNA_PINK = '#FFB3C7';
  const KLARNA_NAVY = '#17120e';

  const defaultCategories = [
    { identifier: 'pay_now',       name: t('payment.klarna.payNow') },
    { identifier: 'pay_later',     name: t('payment.klarna.payLater') },
    { identifier: 'pay_over_time', name: t('payment.klarna.payOverTime') },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: '#fdf0f5', borderColor: '#f7b3cd' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg" style={{ background: KLARNA_PINK, color: KLARNA_NAVY }}>K</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">{t('payment.klarna.title')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t('payment.klarna.subtitle')}</p>
        </div>
        {flowStatus === 'confirmed' && <span className="text-[9px] px-2 py-0.5 rounded font-bold text-white bg-green-600">{t('payment.klarna.confirmed')}</span>}
        {(flowStatus === 'init' || flowStatus === 'sdk_loading') && (
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: KLARNA_NAVY, borderTopColor: 'transparent' }} />
        )}
      </div>

      {(flowStatus === 'init' || flowStatus === 'sdk_loading') && (
        <div className="rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: '#f7b3cd', background: '#fdf0f5' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: KLARNA_NAVY, borderTopColor: 'transparent' }} />
          <p className="text-sm font-semibold text-slate-700">
            {flowStatus === 'init' ? t('payment.klarna.creatingSession') : t('payment.klarna.loadingSdk')}
          </p>
        </div>
      )}

      {(flowStatus === 'selecting' || flowStatus === 'widget_loading' || flowStatus === 'widget_ready' || flowStatus === 'authorizing' || flowStatus === 'placing') && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t('payment.klarna.selectPlan')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(categories.length > 0 ? categories : defaultCategories).map(cat => (
              <button key={cat.identifier} onClick={() => selectCategory(cat.identifier)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${selectedCat === cat.identifier ? 'border-[#FF6B2C] bg-[#FF6B2C]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                <p className="text-sm font-bold text-slate-900">{cat.name}</p>
              </button>
            ))}
          </div>
          <div id="klarna-payments-container" className="min-h-20" />
          {(flowStatus === 'widget_ready' || flowStatus === 'authorizing' || flowStatus === 'placing') && (
            <button onClick={authorize} disabled={flowStatus !== 'widget_ready'}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-50"
              style={{ background: KLARNA_NAVY }}>
              {flowStatus === 'authorizing' ? t('payment.klarna.authorising') : flowStatus === 'placing' ? t('payment.klarna.placingOrder') : t('payment.klarna.authoriseBtn')}
            </button>
          )}
          {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
        </div>
      )}

      {flowStatus === 'confirmed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-1">
          <p className="text-sm font-bold text-green-700">{t('payment.klarna.paymentConfirmed')}</p>
          {klarnaOrderId && <p className="text-xs text-slate-500 font-mono">{t('payment.klarna.orderId')} {klarnaOrderId}</p>}
        </div>
      )}

      {flowStatus === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">{t('payment.klarna.errorTitle')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

// ── Cash flow ──────────────────────────────────────────────────────────────────

function CashFlow({ amount, onPaid, t }: { amount: number; onPaid: () => void; t: TFunc }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
        <p className="text-3xl mb-2">💵</p>
        <p className="text-lg font-black text-amber-900">{fmt(amount)}</p>
        <p className="text-xs text-amber-700 mt-1">{t('payment.cash.label')}</p>
      </div>
      {!done ? (
        <button onClick={() => { setDone(true); onPaid(); }}
          className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors">
          {t('payment.cash.confirmBtn')}
        </button>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center text-sm font-bold text-emerald-700">{t('payment.cash.confirmed')}</div>
      )}
    </div>
  );
}

// ── Main payment page ─────────────────────────────────────────────────────────

function ServicePaymentContent({ id }: { id: string }) {
  const router       = useRouter();
  const params       = useSearchParams();
  const t            = useTranslations('service');
  const invoiceId    = params.get('invoiceId') ?? '';
  const [order,        setOrder]       = useState<WorkOrder | null>(null);
  const [tasks,        setTasks]       = useState<WorkOrderTask[]>([]);
  const [parts,        setParts]       = useState<WorkOrderPart[]>([]);
  const [invoice,      setInvoice]     = useState<InvoiceRow | null>(null);
  const [amountInput,  setAmountInput] = useState('');
  const [amountSaving, setAmountSaving]= useState(false);
  const [method,       setMethod]      = useState<Method>('swish');
  const [step,         setStep]        = useState<FlowStep>('idle');
  const [isPaid,       setIsPaid]      = useState(false);
  const [loading,      setLoading]     = useState(true);
  const dealershipId = getDealershipId() ?? '';

  const METHODS: { id: Method; label: string; icon: string }[] = [
    { id: 'swish',         label: t('payment.methods.swish'),         icon: '📱' },
    { id: 'card',          label: t('payment.methods.card'),          icon: '💳' },
    { id: 'bank_transfer', label: t('payment.methods.bank_transfer'), icon: '🏦' },
    { id: 'klarna',        label: t('payment.methods.klarna'),        icon: '🟣' },
    { id: 'cash',          label: t('payment.methods.cash'),          icon: '💵' },
  ];

  useEffect(() => {
    if (!localStorage.getItem('user')) { router.push('/auth/login'); return; }
    (async () => {
      const { order: o, tasks: tk, parts: p } = await getWorkOrder(Number(id));
      setOrder(o); setTasks(tk); setParts(p);

      // Compute gross from tasks + parts — same formula as the Items tab
      if (o) {
        const freshNet =
          (tk ?? []).reduce((s, t) => {
            const hrs = t.actual_hrs > 0 ? t.actual_hrs : t.estimated_hrs;
            return s + hrs * (o.labor_rate ?? 850);
          }, 0) +
          (p ?? []).reduce((s, pt) => s + pt.total_cost, 0);
        const freshGross = Math.round(freshNet * 1.25 * 100) / 100;
        setAmountInput(String(freshGross));
      }

      if (invoiceId && dealershipId) {
        const res = await fetch(`/api/invoice/by-id?id=${encodeURIComponent(invoiceId)}&dealershipId=${encodeURIComponent(dealershipId)}`);
        if (res.ok) {
          const json = await res.json() as { invoice: InvoiceRow };
          setInvoice(json.invoice ?? null);
          // Invoice already paid — show success screen immediately
          if (json.invoice?.status === 'paid') setStep('success');
        }
      }
      setLoading(false);
    })();
  }, [id, invoiceId, dealershipId, router]);

  const saveAmount = useCallback(async (val: string) => {
    const parsed = parseFloat(val.replace(',', '.'));
    if (!invoiceId || !dealershipId || isNaN(parsed) || parsed < 0) return;
    setAmountSaving(true);
    try {
      await fetch('/api/invoice/by-id', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, dealershipId, totalAmount: parsed }),
      });
      setInvoice(prev => prev ? { ...prev, total_amount: parsed, vat_amount: Math.round(parsed * 0.2 * 100) / 100, net_amount: Math.round(parsed * 0.8 * 100) / 100 } : prev);
    } finally { setAmountSaving(false); }
  }, [invoiceId, dealershipId]);

  const handlePaid = useCallback(async () => {
    setIsPaid(true);  // lock UI immediately — no second payment possible
    if (invoiceId) {
      await saveAmount(amountInput);
      await markInvoicePaidById(invoiceId, METHODS.find(m => m.id === method)?.label ?? method);
      emit({ type: 'invoice:paid', payload: { id: invoiceId, amount: invoice?.total_amount ?? 0 } });
      toast.success(`${invoiceId} ${t('payment.success.paid')}!`);
    }
    // Mark work order as invoiced (best-effort — never blocks the success screen)
    if (dealershipId) {
      fetch(`/api/service/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, status: 'invoiced' }),
      }).catch(() => {});
    }
    setStep('success');
  }, [invoiceId, method, amountInput, saveAmount, t, METHODS, id, dealershipId, invoice]);

  if (loading || !order) return (
    <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
      <div className="lg:ml-64 flex-1 flex items-center justify-center text-slate-400">
        {loading ? t('payment.loading') : t('payment.notFound')}
      </div>
    </div>
  );

  const totalAmount = parseFloat(amountInput.replace(',', '.')) || invoice?.total_amount || 0;
  const vatAmount   = Math.round(totalAmount * 0.2 * 100) / 100;   // VAT back-calc: gross * 0.2 = 25% on net
  const netAmount   = Math.round((totalAmount - vatAmount) * 100) / 100;

  if (step === 'success') {
    return (
      <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
        <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
          <div className="brand-top-bar" />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10 max-w-md w-full text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-4xl">✅</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">{t('payment.success.title')}</h1>
                <p className="text-slate-500 text-sm">{invoiceId} · {fmt(totalAmount)}</p>
                <p className="text-slate-400 text-xs mt-1">{order.customer_name} · {order.vehicle_name}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
                <InfoRow label={t('payment.success.invoice')} value={invoiceId} />
                <InfoRow label={t('payment.success.amount')}  value={fmt(totalAmount)} highlight />
                <InfoRow label={t('payment.success.method')}  value={METHODS.find(m => m.id === method)?.label ?? method} />
                <InfoRow label={t('payment.success.paid')}    value={new Date().toLocaleDateString('sv-SE')} />
              </div>
              <div className="flex gap-3">
                <Link href="/invoices" className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors text-center">{t('payment.success.invoices')}</Link>
                <Link href={`/service/orders/${id}`} className="flex-1 py-3 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors text-center">{t('payment.success.backBtn')}</Link>
              </div>
            </div>
          </div>
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
            <Link href="/service" className="hover:text-[#FF6B2C]">Service</Link>
            <span>→</span>
            <Link href={`/service/orders/${id}`} className="hover:text-[#FF6B2C]">AO-{id}</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('payment.breadcrumb')}</span>
          </nav>
          <h1 className="text-2xl font-black text-[#0b1524]">{t('payment.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{invoiceId} · {order.customer_name}</p>
        </div>

        <div className="px-5 md:px-8 py-6 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: Invoice summary ──────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{t('payment.summary.title')}</h2>

                <div className="space-y-1 mb-4">
                  <p className="text-lg font-black text-slate-900">{order.customer_name}</p>
                  {order.customer_phone && <p className="text-xs text-slate-400">{order.customer_phone}</p>}
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-xs font-semibold text-slate-700">{order.vehicle_name || t('payment.summary.vehicle')}</p>
                  {order.plate && <p className="text-[10px] text-slate-400">{order.plate}</p>}
                  {order.vin   && <p className="text-[10px] text-slate-400">VIN: {order.vin}</p>}
                </div>

                {/* Labour line items */}
                {tasks.filter(tk => tk.estimated_hrs > 0 || tk.actual_hrs > 0).length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('payment.summary.labour')}</p>
                    {tasks.filter(tk => tk.estimated_hrs > 0 || tk.actual_hrs > 0).map(tk => {
                      const hrs  = tk.actual_hrs || tk.estimated_hrs;
                      const cost = hrs * (order.labor_rate || 850);
                      return (
                        <div key={tk.id} className="flex justify-between items-baseline py-1.5 border-b border-slate-50">
                          <div>
                            <span className="text-sm text-slate-800">{tk.title}</span>
                            <span className="ml-2 text-[10px] text-slate-400">{hrs} h</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900 ml-4 shrink-0">{fmt(cost)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Parts line items */}
                {parts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t('payment.summary.parts')}</p>
                    {parts.map(p => (
                      <div key={p.id} className="flex justify-between items-baseline py-1.5 border-b border-slate-50">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-slate-800">{p.name}</span>
                          {p.part_number && <span className="ml-2 text-[10px] text-slate-400 font-mono">{p.part_number}</span>}
                          {p.quantity > 1 && <span className="ml-1 text-[10px] text-slate-400">× {p.quantity}</span>}
                        </div>
                        <span className="text-sm font-semibold text-slate-900 ml-4 shrink-0">{fmt(p.total_cost)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotals */}
                <div className="space-y-0 border-t border-slate-100 pt-2">
                  {order.labor_cost > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-xs text-slate-500">{t('payment.summary.labourTotal')}</span>
                      <span className="text-xs font-semibold text-slate-700">{fmt(order.labor_cost)}</span>
                    </div>
                  )}
                  {order.parts_cost > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-xs text-slate-500">{t('payment.summary.partsTotal')}</span>
                      <span className="text-xs font-semibold text-slate-700">{fmt(order.parts_cost)}</span>
                    </div>
                  )}

                  {/* Editable total */}
                  <div className="pt-3 pb-1 border-t border-slate-200 mt-1">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('payment.summary.totalLabel')}</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="1" value={amountInput}
                        onChange={e => setAmountInput(e.target.value)}
                        onBlur={e => saveAmount(e.target.value)}
                        className="flex-1 px-3 py-2 text-lg font-black text-[#FF6B2C] border-2 border-[#FF6B2C]/30 rounded-xl focus:outline-none focus:border-[#FF6B2C] bg-white text-right"
                        placeholder="0" />
                      <span className="text-sm font-bold text-slate-500">{t('payment.summary.kr')}</span>
                    </div>
                    {amountSaving && <p className="text-xs text-slate-400 mt-1">{t('payment.summary.saving')}</p>}
                  </div>

                  {totalAmount > 0 && (
                    <div className="pt-1 space-y-0">
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-slate-400">{t('payment.summary.vatLine')}</span>
                        <span className="text-xs text-slate-400">{fmt(vatAmount)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-xs text-slate-400">{t('payment.summary.net')}</span>
                        <span className="text-xs text-slate-400">{fmt(netAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {invoiceId && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t('payment.summary.invoiceLabel')}</span>
                  <span className="text-xs font-bold font-mono text-slate-900">{invoiceId}</span>
                </div>
              )}
            </div>

            {/* ── Right: Payment methods ────────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{t('payment.methodSelect')}</h2>

                {/* Method tabs — locked once payment is confirmed */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                  {METHODS.map(m => (
                    <button key={m.id}
                      onClick={() => { if (!isPaid) setMethod(m.id); }}
                      disabled={isPaid}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed ${
                        method === m.id ? 'border-[#FF6B2C] bg-[#FF6B2C]/5' : 'border-slate-100 hover:border-slate-300'
                      }`}>
                      <span className="text-xl">{m.icon}</span>
                      <span className="text-[11px] font-bold text-slate-900 leading-tight">{m.label}</span>
                    </button>
                  ))}
                </div>

                {/* Payment flow */}
                {method === 'swish' && (
                  <SwishFlow amount={totalAmount} invoiceId={invoiceId} payRef={`AO-${id}`} customerPhone={order.customer_phone ?? ''} onPaid={handlePaid} t={t} />
                )}
                {method === 'card' && (
                  <CardFlow amount={totalAmount} onPaid={handlePaid} t={t} />
                )}
                {method === 'bank_transfer' && (
                  <BankTransferFlow invoiceId={invoiceId} amount={totalAmount} onPaid={handlePaid} t={t} />
                )}
                {method === 'klarna' && (
                  <KlarnaFlow amount={totalAmount} invoiceId={invoiceId} onPaid={handlePaid} t={t} />
                )}
                {method === 'cash' && (
                  <CashFlow amount={totalAmount} onPaid={handlePaid} t={t} />
                )}
              </div>

              <Link href={`/service/orders/${id}`}
                className="block text-center text-xs text-slate-400 hover:text-slate-600 transition-colors">
                {t('payment.backToOrder')}
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServicePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-[#f5f7fa]"><Sidebar />
        <div className="lg:ml-64 flex-1 flex items-center justify-center text-slate-400">...</div>
      </div>
    }>
      <ServicePaymentContent id={id} />
    </Suspense>
  );
}
