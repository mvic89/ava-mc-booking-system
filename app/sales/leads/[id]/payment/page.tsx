'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMethod = 'financing' | 'swish' | 'card' | 'bank-transfer' | 'klarna';
type FinancingBank = 'santander' | 'svea';
type PaymentStatus = 'pending' | 'processing' | 'confirmed' | 'failed';

interface FinancingApplication {
  bank: FinancingBank;
  applicationId: string;
  status: 'approved' | 'pending' | 'denied';
  monthlyAmount: number;
  apr: number;
  termMonths: number;
  payoutStatus: 'awaiting' | 'paid_out';
  payoutDate?: string;
  dealerCommission: number;
}

interface OrderSummary {
  agreementNumber: string;
  customerName: string;
  personnummer: string;
  vehicle: string;
  vehiclePrice: number;
  accessories: number;
  tradeInCredit: number;
  totalAmount: number;
  deposit: number;
  balanceDue: number;
  location: string;
}

// ─── Fake / Mock data (replace with real API calls) ──────────────────────────
// REAL DATA GUIDE:
//   orderSummary  → fetch from /api/agreements/[id]
//   financing     → fetch from /api/financing/[applicationId]
//   swishStatus   → poll GET /api/swish/payments/[paymentId]
//   cardStatus    → poll GET /api/nets/transactions/[transactionId]
//   bankTransfer  → poll GET /api/bank/transfers/[reference]

const MOCK_ORDER: OrderSummary = {
  agreementNumber: 'AGR-2024-0089',
  customerName: 'Lars Bergman',
  personnummer: '197506123456',
  vehicle: 'Kawasaki Ninja ZX-6R 2024',
  vehiclePrice: 118000,
  accessories: 15280,
  tradeInCredit: 32000,
  totalAmount: 133280,
  deposit: 13328,
  balanceDue: 119952,
  location: 'AVA MC Stockholm',
};

const MOCK_FINANCING: Record<FinancingBank, FinancingApplication> = {
  santander: {
    bank: 'santander',
    applicationId: 'SAN-2024-88123',
    status: 'approved',
    monthlyAmount: 4092,
    apr: 4.9,
    termMonths: 36,
    payoutStatus: 'awaiting',
    dealerCommission: 2846,
  },
  svea: {
    bank: 'svea',
    applicationId: 'SVEA-2024-44512',
    status: 'approved',
    monthlyAmount: 4210,
    apr: 5.4,
    termMonths: 36,
    payoutStatus: 'awaiting',
    dealerCommission: 2400,
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: PaymentStatus }) {
  const cfg: Record<PaymentStatus, { label: string; cls: string }> = {
    pending:    { label: 'Pending',    cls: 'bg-slate-100 text-slate-500' },
    processing: { label: 'Processing', cls: 'bg-amber-100 text-amber-700' },
    confirmed:  { label: 'Confirmed',  cls: 'bg-green-100 text-green-700' },
    failed:     { label: 'Failed',     cls: 'bg-red-100 text-red-700' },
  };
  const c = cfg[status];
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.cls}`}>{c.label}</span>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-[#FF6B2C]' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function DeliveryLock({ unlocked }: { unlocked: boolean }) {
  return (
    <div className={`rounded-xl border-2 p-4 flex items-center gap-3 transition-all ${
      unlocked ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'
    }`}>
      <span className="text-2xl">{unlocked ? '🔓' : '🔒'}</span>
      <div>
        <p className={`text-sm font-bold ${unlocked ? 'text-green-700' : 'text-slate-500'}`}>
          {unlocked ? 'Delivery Unlocked' : 'Delivery Locked'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {unlocked
            ? 'Payment confirmed — delivery can now proceed'
            : 'Payment must be confirmed before delivery is allowed'}
        </p>
      </div>
      {unlocked && (
        <Link
          href="#"
          className="ml-auto px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors"
        >
          Go to Delivery →
        </Link>
      )}
    </div>
  );
}

// ─── Svea Instore Flow ────────────────────────────────────────────────────────
// Uses the real Svea Instore API (webpayinstoreapistage.svea.com).
// Dealer enters customer phone → POST /api/svea/order → Svea sends SMS.
// Customer opens SMS link, picks financing plan, signs with BankID.
// Svea calls /api/svea/callback → payment confirmed → delivery unlocks.

type SveaFlowStatus = 'idle' | 'sending' | 'waiting' | 'confirmed' | 'failed';
type DeliverStatus  = 'idle' | 'delivering' | 'delivered' | 'deliver_failed';

function SveaInstoreFlow({ order }: { order: OrderSummary }) {
  const [phone, setPhone]               = useState('');
  const [flowStatus, setFlowStatus]     = useState<SveaFlowStatus>('idle');
  const [sveaOrderId, setSveaOrderId]   = useState<number | null>(null);
  const [merchantOrderNumber, setMerchantOrderNumber] = useState('');
  const [smsSent, setSmsSent]           = useState<boolean | null>(null);
  const [paymentLink, setPaymentLink]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [pollCount, setPollCount]       = useState(0);
  const [deliverStatus, setDeliverStatus] = useState<DeliverStatus>('idle');

  const isValidPhone = /^\+46\d{9}$/.test(phone) || /^07\d{8}$/.test(phone);

  const normalisePhone = (raw: string) =>
    raw.startsWith('07') ? '+46' + raw.slice(1) : raw;

  // ── Create instore order — POST /api/svea/order ───────────────────────────
  // Calls Svea Instore API: POST /api/v1/orders (Basic Auth)
  // Svea sends SMS to customer with a payment link (expires in 20 min).
  // Customer opens the link, picks a financing plan, and signs with BankID.
  // Svea Instore API fields: MerchantOrderNumber, MobilePhoneNumber, OrderItems,
  //   CallbackUri, TermsUri, RequireElectronicIdAuthentication: true
  const handleSendLink = async () => {
    setFlowStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/svea/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementNumber: order.agreementNumber,
          customerPhone:   normalisePhone(phone),
          vehicleName:     order.vehicle,
          vin:             'JKBZXR636PA012345',   // replace with real VIN from agreement
          balanceDue:      order.balanceDue,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSveaOrderId(data.orderId);
      setMerchantOrderNumber(data.merchantOrderNumber ?? order.agreementNumber);
      setSmsSent(data.smsSentSuccessfully ?? null);
      setPaymentLink(data.paymentLink ?? null);
      setFlowStatus('waiting');
    } catch (err: any) {
      setErrorMsg(err.message);
      setFlowStatus('failed');
    }
  };

  // ── Poll order status every 5 seconds ────────────────────────────────────
  // Calls Svea Instore API: GET /api/v1/orders/{merchantOrderNumber}/status (Basic Auth)
  // The Instore API uses merchantOrderNumber (e.g. "AGR-2024-0089-MM3JJSJL") as the
  // path identifier — NOT the numeric paymentOrderId.
  // Status values: "Active" → waiting, "Confirmed" → BankID signed ✅, "Cancelled"
  useEffect(() => {
    if (flowStatus !== 'waiting' || !merchantOrderNumber) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/svea/order/${encodeURIComponent(merchantOrderNumber)}`);
        const data = await res.json();
        setPollCount(c => c + 1);

        if (data.status === 'Confirmed') {
          clearInterval(interval);
          setFlowStatus('confirmed');
        } else if (data.status === 'Cancelled') {
          clearInterval(interval);
          setErrorMsg('Svea order was cancelled by the customer or expired.');
          setFlowStatus('failed');
        }
      } catch { /* network hiccup — keep polling */ }
    }, 5000);

    return () => clearInterval(interval);
  }, [flowStatus, merchantOrderNumber]);

  return (
    <div className="space-y-4">

      {/* Svea header */}
      <div className="flex items-center gap-3 p-4 bg-[#f0f4f8] rounded-xl border border-[#1a3a5c]/10">
        <div className="w-10 h-10 rounded-xl bg-[#1a3a5c] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black">SVEA</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Svea Ekonomi — Instore Financing</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer receives an SMS link → selects financing plan → signs with BankID
          </p>
        </div>
        <span className="text-[9px] bg-[#1a3a5c] text-white px-2 py-0.5 rounded font-bold">PRIMARY</span>
      </div>

      {/* How it works — shown only when idle */}
      {flowStatus === 'idle' && (
        <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">How It Works</p>
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#1a3a5c] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
              <p>Enter the customer&apos;s Swedish phone number below and click <strong>Send Svea Link</strong></p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#1a3a5c] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
              <p>Svea sends an <strong>SMS</strong> to the customer. The link expires in <strong>20 minutes</strong></p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#1a3a5c] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
              <p>Customer opens the link, sees available financing plans (e.g. 12/24/36/48 months), and selects one</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#1a3a5c] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">4</span>
              <p>Customer authenticates with <strong>BankID</strong> — Svea confirms the order</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">5</span>
              <p>This page updates automatically — <strong>delivery is unlocked</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1 — Enter phone + send */}
      {flowStatus === 'idle' && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Customer Phone Number
          </p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+46700000000 or 07XXXXXXXX"
              className="flex-1 text-sm px-4 py-3 rounded-xl border border-slate-200 focus:border-[#1a3a5c] focus:ring-1 focus:ring-[#1a3a5c] outline-none font-mono"
            />
            <button
              onClick={handleSendLink}
              disabled={!isValidPhone}
              className="px-5 py-3 rounded-xl bg-[#1a3a5c] hover:bg-[#142d47] disabled:opacity-40 text-white text-sm font-bold transition-colors whitespace-nowrap"
            >
              Send Svea Link
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Amount: <strong>{order.balanceDue.toLocaleString('sv-SE')} kr</strong> •
            Ref: <span className="font-mono">{order.agreementNumber}</span> •
            Link valid 20 min
          </p>
        </div>
      )}

      {/* Sending spinner */}
      {flowStatus === 'sending' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#1a3a5c] border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Creating Svea order…</p>
            <p className="text-xs text-slate-400 mt-0.5">Calling Svea Instore API and sending SMS to customer</p>
          </div>
        </div>
      )}

      {/* Waiting for customer */}
      {flowStatus === 'waiting' && sveaOrderId && (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm font-bold text-amber-700">SMS sent — waiting for customer</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <span className="text-slate-400">Svea Order ID</span>
              <span className="font-mono font-bold text-slate-800">{sveaOrderId}</span>
              <span className="text-slate-400">Agreement Ref</span>
              <span className="font-mono font-bold text-slate-800">{merchantOrderNumber}</span>
              <span className="text-slate-400">SMS sent</span>
              <span className={`font-bold ${smsSent === true ? 'text-green-600' : smsSent === false ? 'text-red-500' : 'text-slate-400'}`}>
                {smsSent === true ? '✅ Yes' : smsSent === false ? '❌ Failed' : '—'}
              </span>
              <span className="text-slate-400">Status</span>
              <span className="font-bold text-amber-600">Created — awaiting customer</span>
              <span className="text-slate-400">Polls</span>
              <span className="text-slate-500">{pollCount} checks (every 5 sec)</span>
            </div>
            {paymentLink && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-xs text-slate-500 mb-1">Payment link (share manually if SMS failed):</p>
                <a
                  href={paymentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline break-all font-mono"
                >
                  {paymentLink}
                </a>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-4 text-xs text-slate-500 space-y-1.5">
            <p className="font-semibold text-slate-700 mb-1">Customer journey (in their browser):</p>
            <p>📱 SMS arrives with a Svea payment link</p>
            <p>🔗 Customer opens link → sees available financing plans from Svea</p>
            <p>✅ Customer selects a plan (e.g. 36 months) and authenticates with <strong>BankID</strong></p>
            <p>🔔 Svea calls our callback → this page confirms automatically</p>
          </div>
          <button
            onClick={() => { setFlowStatus('idle'); setSveaOrderId(null); setPollCount(0); }}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            ✕ Cancel and resend to a different number
          </button>
        </div>
      )}

      {/* Confirmed */}
      {flowStatus === 'confirmed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Svea Financing Confirmed</p>
              <p className="text-xs text-green-600 mt-0.5">Customer signed with BankID — order status: Confirmed</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <span className="text-slate-400">Svea Order ID</span>
            <span className="font-mono font-bold text-slate-800">{sveaOrderId}</span>
            <span className="text-slate-400">Agreement Ref</span>
            <span className="font-mono font-bold text-slate-800">{merchantOrderNumber}</span>
            <span className="text-slate-400">Status</span>
            <span className="font-bold text-green-600">Confirmed ✅</span>
          </div>

          {/* Deliver Order */}
          <div className="pt-2 border-t border-green-200">
            {deliverStatus === 'delivered' ? (
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm font-bold">Order Delivered — funds released to AVA MC</p>
              </div>
            ) : deliverStatus === 'deliver_failed' ? (
              <div className="space-y-2">
                <p className="text-xs text-red-600 font-medium">Delivery call failed. Check terminal for details.</p>
                <button
                  onClick={async () => {
                    setDeliverStatus('delivering');
                    try {
                      const res = await fetch(`/api/svea/order/${sveaOrderId}/deliver`, { method: 'POST' });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);
                      setDeliverStatus('delivered');
                    } catch (e: any) {
                      console.error('[deliver]', e.message);
                      setDeliverStatus('deliver_failed');
                    }
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Retry delivery
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500">
                  Hand the bike to the customer, then click <strong>Confirm Delivery</strong> to release funds from Svea.
                </p>
                <button
                  disabled={deliverStatus === 'delivering'}
                  onClick={async () => {
                    setDeliverStatus('delivering');
                    try {
                      const res = await fetch(`/api/svea/order/${sveaOrderId}/deliver`, { method: 'POST' });
                      const data = await res.json();
                      if (data.error) throw new Error(data.error);
                      setDeliverStatus('delivered');
                    } catch (e: any) {
                      console.error('[deliver]', e.message);
                      setDeliverStatus('deliver_failed');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a3a5c] hover:bg-[#142d47] disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {deliverStatus === 'delivering' ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Confirming delivery…
                    </>
                  ) : (
                    <>🚚 Confirm Delivery — Release Funds</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {flowStatus === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">❌ Svea order failed</p>
          <p className="text-xs text-slate-500 mt-0.5">{errorMsg}</p>
          <button
            onClick={() => { setFlowStatus('idle'); setErrorMsg(''); }}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      <DeliveryLock unlocked={flowStatus === 'confirmed'} />
    </div>
  );
}

// ─── Financing Tab ────────────────────────────────────────────────────────────

function FinancingTab({ order }: { order: OrderSummary }) {
  // Svea is the PRIMARY financing partner — selected by default
  const [selectedBank, setSelectedBank] = useState<FinancingBank>('svea');
  const [confirming, setConfirming] = useState(false);
  const [payoutConfirmed, setPayoutConfirmed] = useState(false);
  const santanderApp = MOCK_FINANCING.santander;

  const handleConfirmPayout = () => {
    setConfirming(true);
    setTimeout(() => { setConfirming(false); setPayoutConfirmed(true); }, 1800);
  };

  return (
    <div className="space-y-5">
      {/* Bank selector */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Financing Partner</p>
        <div className="grid grid-cols-2 gap-3">

          {/* ── Svea — PRIMARY ── */}
          <button
            onClick={() => setSelectedBank('svea')}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              selectedBank === 'svea' ? 'border-[#1a3a5c] bg-[#f0f4f8]' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900">Svea Ekonomi</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-[#1a3a5c] bg-blue-50 border-blue-200">
                live
              </span>
            </div>
            <p className="text-xs text-slate-500">SMS link → customer selects plan → BankID</p>
            <p className="text-xs text-slate-400 mt-1">Instore API • Real-time confirmation</p>
            <span className="text-[9px] bg-[#1a3a5c] text-white px-1.5 py-0.5 rounded font-bold mt-2 inline-block">
              PRIMARY
            </span>
          </button>

          {/* ── Santander — ALTERNATIVE (mock) ── */}
          <button
            onClick={() => setSelectedBank('santander')}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              selectedBank === 'santander' ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900">Santander</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border text-slate-500 bg-slate-50 border-slate-200">
                mock
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {santanderApp.apr}% APR • {santanderApp.termMonths} months
            </p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {santanderApp.monthlyAmount.toLocaleString('sv-SE')} kr/mo
            </p>
            <span className="text-[9px] bg-slate-400 text-white px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
              ALTERNATIVE
            </span>
          </button>
        </div>
      </div>

      {/* ── Svea Instore flow (PRIMARY, real API) ── */}
      {selectedBank === 'svea' && (
        <SveaInstoreFlow order={order} />
      )}

      {/* ── Santander mock details (ALTERNATIVE) ── */}
      {selectedBank === 'santander' && (
        <>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
            <span className="text-amber-500 text-sm">⚠</span>
            <p className="text-xs text-amber-700">
              Santander integration is <strong>mock data</strong>. Contact your Santander account manager for API credentials.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Application Details (Mock)</p>
            <InfoRow label="Application ID" value={santanderApp.applicationId} />
            <InfoRow label="Status" value={santanderApp.status.charAt(0).toUpperCase() + santanderApp.status.slice(1)} />
            <InfoRow label="Term" value={`${santanderApp.termMonths} months`} />
            <InfoRow label="APR" value={`${santanderApp.apr}%`} />
            <InfoRow label="Monthly Payment" value={`${santanderApp.monthlyAmount.toLocaleString('sv-SE')} kr`} />
            <InfoRow label="Total Financed" value={`${(santanderApp.monthlyAmount * santanderApp.termMonths).toLocaleString('sv-SE')} kr`} />
            <InfoRow label="Dealer Commission" value={`${santanderApp.dealerCommission.toLocaleString('sv-SE')} kr`} highlight />
          </div>

          {/* Payout status */}
          <div className={`rounded-xl border p-4 ${
            payoutConfirmed ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-bold ${payoutConfirmed ? 'text-green-700' : 'text-amber-700'}`}>
                  {payoutConfirmed ? '✅ Payout Confirmed' : '⏳ Awaiting Bank Payout'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {payoutConfirmed
                    ? 'Funds received in dealer account'
                    : 'Bank will transfer funds within 1–2 business days'}
                </p>
              </div>
              {!payoutConfirmed && (
                <button
                  onClick={handleConfirmPayout}
                  disabled={confirming}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold transition-colors"
                >
                  {confirming ? 'Confirming…' : 'Confirm Payout'}
                </button>
              )}
            </div>
          </div>

          <DeliveryLock unlocked={payoutConfirmed} />
        </>
      )}
    </div>
  );
}

// ─── Swish Tab ────────────────────────────────────────────────────────────────

function SwishTab({ order }: { order: OrderSummary }) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [paymentRef] = useState('BIKE-' + Math.random().toString(36).slice(2, 8).toUpperCase());

  // REAL DATA GUIDE:
  // POST https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests
  // Headers: Certificate (m2m), Content-Type: application/json
  // Body: { payeeAlias: "1231234567", amount: order.balanceDue, message: paymentRef,
  //         callbackUrl: "https://yoursite.se/api/swish/callback" }
  // Each location has its own Swish merchant number (e.g. 123 456 78 90)
  // Callback updates payment status in DB → unlocks delivery

  const handleSendRequest = () => {
    if (!phone.match(/^07\d{8}$/)) return;
    setSending(true);
    setPaymentStatus('processing');
    // Simulate Swish callback after 3 seconds
    setTimeout(() => {
      setSending(false);
      setPaymentStatus('confirmed');
    }, 3000);
  };

  return (
    <div className="space-y-5">
      {/* Amount */}
      <div className="bg-slate-50 rounded-xl p-5 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Amount to collect</p>
        <p className="text-4xl font-black text-slate-900">
          {order.balanceDue.toLocaleString('sv-SE')} kr
        </p>
        <p className="text-xs text-slate-400 mt-1">Ref: {paymentRef}</p>
      </div>

      {/* Swish number */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Location Swish Number</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00B4B0] flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">S</span>
          </div>
          <div>
            <p className="text-lg font-black text-slate-900">123 456 78 90</p>
            <p className="text-xs text-slate-400">AVA MC Stockholm — Swish Merchant</p>
          </div>
        </div>
        {/* REAL DATA GUIDE: Each location registers a Swish Handel number via swish.nu.
            Store per-location Swish numbers in your DB: locations.swish_number */}
      </div>

      {/* Send payment request */}
      {paymentStatus === 'pending' && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Send Payment Request to Customer
          </p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="flex-1 text-sm px-4 py-3 rounded-xl border border-slate-200 focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C] outline-none"
            />
            <button
              onClick={handleSendRequest}
              disabled={!phone.match(/^07\d{8}$/) || sending}
              className="px-5 py-3 rounded-xl bg-[#00B4B0] hover:bg-[#009e9a] disabled:opacity-40 text-white text-sm font-bold transition-colors whitespace-nowrap"
            >
              Send Request
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Customer receives a Swish push notification to approve the payment.
          </p>
        </div>
      )}

      {/* Processing */}
      {paymentStatus === 'processing' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-700">Waiting for customer approval…</p>
            <p className="text-xs text-slate-500">Customer has 3 minutes to approve in Swish app</p>
          </div>
        </div>
      )}

      {/* Confirmed */}
      {paymentStatus === 'confirmed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-700">✅ Swish Payment Confirmed</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {order.balanceDue.toLocaleString('sv-SE')} kr received • Ref: {paymentRef}
          </p>
        </div>
      )}

      {/* Real data guide */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
        <p className="font-bold">📋 Real Integration Guide</p>
        <p>• Register as Swish Handel merchant at <strong>swish.nu</strong></p>
        <p>• Use M2M certificates for server-to-server API calls</p>
        <p>• One Swish number per location for clean per-store accounting</p>
        <p>• Implement callback endpoint at <code>/api/swish/callback</code> to auto-confirm</p>
        <p>• Swish API sandbox: <code>mss.cpc.getswish.net/swish-cpcapi/api/v2</code></p>
      </div>

      <DeliveryLock unlocked={paymentStatus === 'confirmed'} />
    </div>
  );
}

// ─── Blipp / Kortbetalning Tab (Nets AXEPT Terminal) ─────────────────────────

type TerminalStep = 'idle' | 'amount_shown' | 'awaiting_card' | 'processing' | 'confirmed' | 'declined';

const TERMINAL_STEPS: { id: TerminalStep; label: string; desc: string }[] = [
  { id: 'idle',          label: 'Terminal redo',              desc: 'Terminalen är online och redo' },
  { id: 'amount_shown',  label: 'Belopp skickat till terminal', desc: 'Kunden ser beloppet på skärmen' },
  { id: 'awaiting_card', label: 'Väntar på blipp / kort',    desc: 'Kunden blipper eller sätter i kortet' },
  { id: 'processing',    label: 'Auktoriserar…',             desc: 'Kontrollerar med kortnätverket' },
  { id: 'confirmed',     label: 'Godkänd ✓',                 desc: 'Beloppet reserverat — kvitto skrivs ut' },
];

const TERMINAL_SCREEN: Record<TerminalStep, { line1: string; line2: string; line3: string; bg: string; textColor: string }> = {
  idle:          { line1: 'NETS AXEPT',       line2: 'NETS-STH-001',        line3: 'REDO',                       bg: '#1e293b', textColor: '#94a3b8' },
  amount_shown:  { line1: 'AVA MC AB',        line2: '119 952,00 SEK',       line3: 'VÄNTAR PÅ KUNDEN',           bg: '#1e3a5f', textColor: '#93c5fd' },
  awaiting_card: { line1: 'BELOPP:',          line2: '119 952,00 SEK',       line3: 'BLIPP ELLER SÄTT I KORTET', bg: '#1e3a5f', textColor: '#fbbf24' },
  processing:    { line1: 'BEHANDLAR...',     line2: '119 952,00 SEK',       line3: 'VÄNLIGEN VÄNTA',             bg: '#1e3a5f', textColor: '#f97316' },
  confirmed:     { line1: 'GODKÄND',          line2: 'KOD: A8F3K2',          line3: 'TACK FÖR KÖPET!',           bg: '#14532d', textColor: '#86efac' },
  declined:      { line1: 'NEKAD',            line2: 'KOD: DECLINED',        line3: 'FÖRSÖK IGEN',                bg: '#7f1d1d', textColor: '#fca5a5' },
};

function CardTab({ order }: { order: OrderSummary }) {
  const [step, setStep]               = useState<TerminalStep>('idle');
  const [transactionId]               = useState('NETS-' + Math.random().toString(36).slice(2, 10).toUpperCase());
  const [authCode]                    = useState('A' + Math.random().toString(36).slice(2, 7).toUpperCase());

  // REAL DATA GUIDE:
  // Nets Easy API: https://developers.nets.eu/nets-easy/
  // POST https://api.dibspayment.eu/v1/payments → get paymentId
  // Cloud terminal: POST /v1/payments/{paymentId}/charge with { terminalId }
  // Poll GET /v1/payments/{paymentId} for chargeId (= confirmed)
  // Terminal supports: NFC blipp, chip+PIN, magnetic stripe, Apple/Google Pay
  // Each location has a Terminal ID — store in locations.nets_terminal_id

  const handleInitiate = () => {
    // Step 1: Send amount to terminal
    setStep('amount_shown');
    setTimeout(() => {
      // Step 2: Terminal ready for card
      setStep('awaiting_card');
      setTimeout(() => {
        // Step 3: Card presented — processing
        setStep('processing');
        setTimeout(() => {
          // Step 4: Approved
          setStep('confirmed');
        }, 2200);
      }, 3000);
    }, 1500);
  };

  const screen = TERMINAL_SCREEN[step];
  const stepIndex = TERMINAL_STEPS.findIndex(s => s.id === step);

  return (
    <div className="space-y-5">

      {/* Terminal header */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-[#0b1524] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black">NETS</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-900">Blipp &amp; Kortbetalning</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">Kontaktlös</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Nets AXEPT · Terminal ID: NETS-STH-001 · AVA MC Stockholm</p>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
          step === 'confirmed' ? 'bg-green-600 text-white' :
          step === 'declined'  ? 'bg-red-600 text-white'   :
          step === 'idle'      ? 'bg-slate-400 text-white'  :
          'bg-amber-500 text-white'
        }`}>
          {step === 'idle' ? 'REDO' : step === 'confirmed' ? 'GODKÄND' : step === 'declined' ? 'NEKAD' : 'AKTIV'}
        </span>
      </div>

      {/* Blipp instruction banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex items-center gap-3">
        <div className="text-2xl shrink-0">
          {/* NFC / contactless wave icon */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="4" fill="#2563eb" />
            <path d="M8 14a6 6 0 0 1 6-6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <path d="M8 14a6 6 0 0 0 6 6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <path d="M4.5 14a9.5 9.5 0 0 1 9.5-9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <path d="M4.5 14a9.5 9.5 0 0 0 9.5 9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <path d="M20 14a6 6 0 0 1-6 6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <path d="M20 14a6 6 0 0 0-6-6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <path d="M23.5 14a9.5 9.5 0 0 1-9.5 9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <path d="M23.5 14a9.5 9.5 0 0 0-9.5-9.5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-blue-800">Blipp — håll kortet nära terminalen</p>
          <p className="text-xs text-blue-600">Kontaktlös betalning · Chip &amp; PIN · Magnetremsa — alla kort accepteras</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Terminal screen simulation */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Terminal Screen</p>
          <div
            className="rounded-xl p-5 font-mono transition-all duration-500"
            style={{ backgroundColor: screen.bg }}
          >
            {/* Status LED */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${
                step === 'confirmed' ? 'bg-green-400' :
                step === 'declined'  ? 'bg-red-400' :
                step === 'idle'      ? 'bg-slate-500' :
                'bg-amber-400 animate-pulse'
              }`} />
              <span className="text-slate-500 text-[10px]">NETS AXEPT B5</span>
            </div>

            {/* Screen lines */}
            <div className="space-y-1.5" style={{ color: screen.textColor }}>
              <p className="text-[10px] opacity-60">{screen.line1}</p>
              <p className="text-xl font-bold tracking-wider">{screen.line2}</p>
              <p className={`text-xs tracking-widest mt-3 ${
                step === 'processing' ? 'animate-pulse' : ''
              }`}>{screen.line3}</p>
            </div>

            {/* Contactless NFC zone — shown when waiting for card */}
            {step === 'awaiting_card' && (
              <div className="mt-4 flex flex-col items-center">
                <div className="relative flex items-center justify-center w-14 h-14">
                  {/* Animated ripple rings */}
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
                <p className="text-[9px] text-amber-400 tracking-widest mt-1">NFC AKTIV</p>
              </div>
            )}

            {/* Card slot illustration */}
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-1 rounded flex-1 transition-all duration-700 ${
                step === 'awaiting_card' || step === 'processing' ? 'bg-amber-400' :
                step === 'confirmed'                              ? 'bg-green-400' :
                'bg-slate-700'
              }`} />
              <span className="text-slate-600 text-[9px]">KORTSLOT</span>
              <div className={`h-1 rounded flex-1 transition-all duration-700 ${
                step === 'awaiting_card' || step === 'processing' ? 'bg-amber-400' :
                step === 'confirmed'                              ? 'bg-green-400' :
                'bg-slate-700'
              }`} />
            </div>

            {/* Transaction ref */}
            <p className="text-slate-700 text-[9px] mt-3">{transactionId}</p>
          </div>
        </div>

        {/* Steps + amount */}
        <div className="space-y-4">
          {/* Amount */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Belopp att betala</p>
            <p className="text-3xl font-black text-slate-900">
              {order.balanceDue.toLocaleString('sv-SE')} kr
            </p>
            <p className="text-xs text-slate-400 mt-1">SEK · Kortbetalning · {transactionId}</p>
          </div>

          {/* Progress steps */}
          <div className="space-y-2">
            {TERMINAL_STEPS.map((s, i) => {
              const done    = stepIndex > i;
              const current = stepIndex === i && step !== 'idle';
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-all ${
                    done    ? 'bg-green-500 text-white' :
                    current ? 'bg-amber-500 text-white animate-pulse' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${
                      done ? 'text-green-700' : current ? 'text-amber-700' : 'text-slate-400'
                    }`}>{s.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action */}
      {step === 'idle' && (
        <button
          onClick={handleInitiate}
          className="w-full py-3.5 rounded-xl bg-[#0b1524] hover:bg-[#1a2a42] text-white text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="4" fill="white" />
            <path d="M8 14a6 6 0 0 1 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M8 14a6 6 0 0 0 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M20 14a6 6 0 0 1-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M20 14a6 6 0 0 0-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            <path d="M4.5 14a9.5 9.5 0 0 1 9.5-9.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            <path d="M4.5 14a9.5 9.5 0 0 0 9.5 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            <path d="M23.5 14a9.5 9.5 0 0 1-9.5 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            <path d="M23.5 14a9.5 9.5 0 0 0-9.5-9.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
          </svg>
          Skicka belopp till terminal — aktivera blipp →
        </button>
      )}

      {(step === 'amount_shown' || step === 'awaiting_card' || step === 'processing') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-700">
              {step === 'amount_shown'  ? 'Belopp skickat — väntar på kunden…' :
               step === 'awaiting_card' ? 'Kunden: blippa, sätt i eller dra kortet' :
               'Auktoriserar med kortnätverket…'}
            </p>
            <p className="text-xs text-slate-500">
              {step === 'amount_shown'  ? 'Terminalen visar beloppet för kunden' :
               step === 'awaiting_card' ? 'Kontaktlös blipp, chip med PIN eller magnetremsa accepteras' :
               'Kontrollerar med Nets — vanligtvis 2–5 sekunder'}
            </p>
          </div>
        </div>
      )}

      {step === 'confirmed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-bold text-green-700">✅ Kortbetalning godkänd</p>
          <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
            <div>
              <p className="text-slate-400">Auth code</p>
              <p className="font-mono font-bold text-slate-800">{authCode}</p>
            </div>
            <div>
              <p className="text-slate-400">Amount</p>
              <p className="font-bold text-slate-800">{order.balanceDue.toLocaleString('sv-SE')} kr</p>
            </div>
            <div>
              <p className="text-slate-400">Transaction</p>
              <p className="font-mono font-bold text-slate-800 text-[10px]">{transactionId}</p>
            </div>
          </div>
        </div>
      )}

      {step === 'declined' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">❌ Kort nekat</p>
          <p className="text-xs text-slate-500 mt-1">Be kunden prova ett annat kort eller en annan betalningsmetod.</p>
          <button onClick={() => setStep('idle')} className="mt-2 text-xs text-red-500 hover:underline">
            Försök igen
          </button>
        </div>
      )}

      {/* Real data guide */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
        <p className="font-bold">📋 Integrationsguide (Nets Easy)</p>
        <p>• Registrera dig för <strong>Nets Easy</strong> på nets.eu — fordon/bilhandel-kategori</p>
        <p>• En AXEPT-terminal per lokal, kopplad till gemensam HQ-rapportering</p>
        <p>• Terminalen stödjer: <strong>Blipp (NFC)</strong>, chip + PIN, magnetremsa, Apple/Google Pay</p>
        <p>• Webhook på <code>/api/nets/callback</code> bekräftar betalning automatiskt i DMS</p>
        <p>• Daglig avräkningsrapport exporteras automatiskt till Fortnox</p>
      </div>

      <DeliveryLock unlocked={step === 'confirmed'} />
    </div>
  );
}

// ─── Klarna Tab ────────────────────────────────────────────────────────────────
// Real Klarna Payments SDK integration.
//
// Flow:
//   1. On mount → POST /api/klarna/session → receive client_token + payment_method_categories
//   2. Load Klarna JS SDK (https://x.klarnacdn.net/kp/lib/v1/api.js)
//   3. Klarna.Payments.init({ client_token }) — initialise the SDK
//   4. Dealer selects a payment category → Klarna.Payments.load() renders iframe into container
//   5. Customer fills in details inside the Klarna widget
//   6. Dealer clicks "Authorise" → Klarna.Payments.authorize() → returns authorization_token
//   7. POST /api/klarna/order with authorization_token → get order_id + fraud_status
//   8. Delivery unlocked on ACCEPTED / PENDING

// Tell TypeScript about the Klarna global injected by the SDK script
declare global {
  interface Window {
    Klarna?: {
      Payments: {
        init: (config: { client_token: string }) => void;
        load: (
          config: { container: string; payment_method_category: string },
          data: object,
          callback: (res: { show_form: boolean; error?: object }) => void,
        ) => void;
        authorize: (
          config: { payment_method_category: string; auto_finalize?: boolean },
          data: object,
          callback: (res: {
            approved: boolean;
            authorization_token?: string;
            finalize_required?: boolean;
            error?: object;
          }) => void,
        ) => void;
      };
    };
  }
}

interface KlarnaCategory {
  identifier:  string;
  name:        string;
  asset_urls?: { descriptive?: string; standard?: string };
}

type KlarnaFlowStatus =
  | 'init'           // fetching session from backend
  | 'sdk_loading'    // session ready — loading klarna.js
  | 'selecting'      // SDK ready — waiting for plan selection
  | 'widget_loading' // Klarna.Payments.load() in progress
  | 'widget_ready'   // iframe shown — customer filling in details
  | 'authorizing'    // Klarna.Payments.authorize() called
  | 'placing'        // POSTing authorization_token to /api/klarna/order
  | 'confirmed'      // order confirmed
  | 'failed';        // error

// Human-readable names for Klarna's identifier strings
const CATEGORY_LABELS: Record<string, { label: string; sub: string }> = {
  pay_now:       { label: 'Pay Now',         sub: 'Immediate payment — card or bank' },
  pay_later:     { label: 'Pay in 30 Days',  sub: 'Invoice — customer pays later' },
  pay_over_time: { label: 'Instalments',     sub: 'Split into monthly payments' },
};

function KlarnaTab({ order }: { order: OrderSummary }) {
  const [flowStatus, setFlowStatus]         = useState<KlarnaFlowStatus>('init');
  const [categories, setCategories]         = useState<KlarnaCategory[]>([]);
  const [selectedCat, setSelectedCat]       = useState<string>('');
  const [sessionId, setSessionId]           = useState('');
  const [clientToken, setClientToken]       = useState('');
  const [klarnaOrderId, setKlarnaOrderId]   = useState('');
  const [fraudStatus, setFraudStatus]       = useState('');
  const [errorMsg, setErrorMsg]             = useState('');
  // ── Step 1: Create Klarna session on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/klarna/session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agreementNumber: order.agreementNumber,
            vehicle:         order.vehicle,
            balanceDue:      order.balanceDue,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (cancelled) return;

        setSessionId(data.session_id);
        setClientToken(data.client_token);
        setCategories(data.payment_method_categories ?? []);
        setFlowStatus('sdk_loading');
      } catch (err: any) {
        if (!cancelled) { setErrorMsg(err.message); setFlowStatus('failed'); }
      }
    })();
    return () => { cancelled = true; };
  }, [order.agreementNumber, order.vehicle, order.balanceDue]);

  // ── Step 2: Load Klarna JS SDK once we have client_token ───────────────
  useEffect(() => {
    if (flowStatus !== 'sdk_loading' || !clientToken) return;
    if (window.Klarna) {
      // SDK already present (e.g. HMR / tab switch)
      window.Klarna.Payments.init({ client_token: clientToken });
      setFlowStatus('selecting');
      return;
    }
    const script    = document.createElement('script');
    script.src      = 'https://x.klarnacdn.net/kp/lib/v1/api.js';
    script.async    = true;
    script.onload   = () => {
      window.Klarna?.Payments.init({ client_token: clientToken });
      setFlowStatus('selecting');
    };
    script.onerror  = () => {
      setErrorMsg('Failed to load Klarna SDK. Check network/CSP settings.');
      setFlowStatus('failed');
    };
    document.head.appendChild(script);
    return () => {
      // Don't remove the script — Klarna adds global state we need to keep
    };
  }, [flowStatus, clientToken]);

  // ── Step 3: Load widget when a category is selected ────────────────────
  const handleSelectCategory = (identifier: string) => {
    if (!window.Klarna) return;
    setSelectedCat(identifier);
    setFlowStatus('widget_loading');

    window.Klarna.Payments.load(
      { container: '#klarna-payments-container', payment_method_category: identifier },
      {},
      (res) => {
        if (res.show_form) {
          setFlowStatus('widget_ready');
        } else {
          setErrorMsg('Klarna could not display this payment option. Try another plan.');
          setFlowStatus('selecting');
        }
      },
    );
  };

  // ── Step 4: Authorize — customer has filled in the Klarna widget ────────
  const handleAuthorize = () => {
    if (!window.Klarna || !selectedCat) return;
    setFlowStatus('authorizing');

    window.Klarna.Payments.authorize(
      { payment_method_category: selectedCat, auto_finalize: true },
      {},
      async (res) => {
        if (!res.approved || !res.authorization_token) {
          setErrorMsg('Klarna authorisation was not approved. Ask the customer to try again.');
          setFlowStatus('widget_ready');
          return;
        }

        // ── Step 5: Place the Klarna order on the server ──────────────────
        setFlowStatus('placing');
        try {
          const placeRes = await fetch('/api/klarna/order', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              authorization_token: res.authorization_token,
              agreementNumber:     order.agreementNumber,
              vehicle:             order.vehicle,
              balanceDue:          order.balanceDue,
            }),
          });
          const data = await placeRes.json();
          if (data.error) throw new Error(data.error);
          setKlarnaOrderId(data.order_id);
          setFraudStatus(data.fraud_status);
          setFlowStatus('confirmed');
          console.log(`[Klarna] Order placed — order_id: ${data.order_id}, fraud: ${data.fraud_status}`);
        } catch (err: any) {
          setErrorMsg(err.message);
          setFlowStatus('widget_ready');
        }
      },
    );
  };

  const KLARNA_PINK   = '#FFB3C7';
  const KLARNA_NAVY   = '#17120e';

  return (
    <div className="space-y-5">

      {/* Klarna header */}
      <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: '#fdf0f5', borderColor: '#f7b3cd' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-lg" style={{ background: KLARNA_PINK, color: KLARNA_NAVY }}>
          K
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Klarna — Pay Now / Later / Instalments</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Embedded Klarna widget — customer fills in details directly on screen
          </p>
        </div>
        {(flowStatus === 'confirmed') && (
          <span className="text-[9px] px-2 py-0.5 rounded font-bold text-white bg-green-600">CONFIRMED</span>
        )}
        {(flowStatus === 'init' || flowStatus === 'sdk_loading') && (
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: KLARNA_NAVY, borderTopColor: 'transparent' }} />
        )}
      </div>

      {/* ── Loading session / SDK ─────────────────────────────────────────── */}
      {(flowStatus === 'init' || flowStatus === 'sdk_loading') && (
        <div className="rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: '#f7b3cd', background: '#fdf0f5' }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: KLARNA_NAVY, borderTopColor: 'transparent' }} />
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {flowStatus === 'init' ? 'Creating Klarna session…' : 'Loading Klarna SDK…'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {flowStatus === 'init'
                ? 'Calling POST /payments/v1/sessions'
                : 'Injecting Klarna JS SDK and initialising with client_token'}
            </p>
          </div>
        </div>
      )}

      {/* ── Plan selector (shown when SDK is ready) ───────────────────────── */}
      {(flowStatus === 'selecting' || flowStatus === 'widget_loading' || flowStatus === 'widget_ready' || flowStatus === 'authorizing' || flowStatus === 'placing') && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            1. Select Klarna Payment Method
          </p>

          {categories.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No payment methods available for this market/merchant.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {categories.map(cat => {
                const meta     = CATEGORY_LABELS[cat.identifier] ?? { label: cat.name, sub: '' };
                const isActive = selectedCat === cat.identifier;
                return (
                  <button
                    key={cat.identifier}
                    onClick={() => handleSelectCategory(cat.identifier)}
                    disabled={flowStatus !== 'selecting' && flowStatus !== 'widget_ready'}
                    className={`rounded-xl border-2 p-3 text-left transition-all disabled:opacity-60 ${
                      isActive ? 'border-[#17120e] bg-[#fdf0f5]' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900">{meta.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{meta.sub}</p>
                    <p className="text-[9px] font-mono text-slate-300 mt-1">{cat.identifier}</p>
                  </button>
                );
              })}
            </div>
          )}

          {sessionId && (
            <p className="text-[10px] text-slate-300 mt-2 font-mono">session: {sessionId}</p>
          )}
        </div>
      )}

      {/* ── Klarna widget container (the SDK renders an iframe here) ──────── */}
      {(flowStatus === 'widget_loading' || flowStatus === 'widget_ready' || flowStatus === 'authorizing' || flowStatus === 'placing') && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            2. Customer Completes Details in Klarna Widget
          </p>

          {flowStatus === 'widget_loading' && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <div className="w-3 h-3 border border-t-transparent rounded-full animate-spin" style={{ borderColor: KLARNA_NAVY, borderTopColor: 'transparent' }} />
              Loading Klarna widget…
            </div>
          )}

          {/* The SDK injects an <iframe> into this div */}
          <div
            id="klarna-payments-container"
            className="rounded-xl border border-slate-200 overflow-hidden min-h-[120px]"
          />

          <p className="text-[10px] text-slate-400 mt-1.5">
            The Klarna widget above is an iframe served directly by Klarna — all sensitive data is handled on Klarna&apos;s servers.
          </p>
        </div>
      )}

      {/* ── Authorise button ──────────────────────────────────────────────── */}
      {(flowStatus === 'widget_ready' || flowStatus === 'authorizing' || flowStatus === 'placing') && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            3. Authorise Payment
          </p>
          <button
            onClick={handleAuthorize}
            disabled={flowStatus !== 'widget_ready'}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: KLARNA_NAVY }}
          >
            {flowStatus === 'authorizing' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Klarna authorising…
              </>
            ) : flowStatus === 'placing' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Placing order with Klarna…
              </>
            ) : (
              <>Authorise Klarna Payment — {order.balanceDue.toLocaleString('sv-SE')} kr</>
            )}
          </button>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Calls <code>Klarna.Payments.authorize()</code> → on approval, places order via <code>POST /api/klarna/order</code>
          </p>
        </div>
      )}

      {/* ── Confirmed ─────────────────────────────────────────────────────── */}
      {flowStatus === 'confirmed' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-green-800">Klarna Order Confirmed</p>
              <p className="text-xs text-green-600 mt-0.5">
                {fraudStatus === 'ACCEPTED' ? 'Payment accepted — funds guaranteed by Klarna' :
                 fraudStatus === 'PENDING'   ? 'Under review — Klarna will notify shortly' :
                 'Order placed'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <span className="text-slate-400">Klarna Order ID</span>
            <span className="font-mono font-bold text-slate-800">{klarnaOrderId}</span>
            <span className="text-slate-400">Agreement Ref</span>
            <span className="font-mono font-bold text-slate-800">{order.agreementNumber}</span>
            <span className="text-slate-400">Fraud Status</span>
            <span className={`font-bold ${fraudStatus === 'ACCEPTED' ? 'text-green-600' : 'text-amber-600'}`}>
              {fraudStatus}
            </span>
            <span className="text-slate-400">Amount</span>
            <span className="font-bold text-slate-800">{order.balanceDue.toLocaleString('sv-SE')} kr</span>
          </div>
          {fraudStatus === 'PENDING' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>Pending review</strong> — Klarna will send a callback to <code>/api/klarna/callback</code> when the decision is made.
            </div>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {flowStatus === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">❌ Klarna error</p>
          <p className="text-xs text-slate-500 mt-0.5">{errorMsg}</p>
          <button
            onClick={() => { setFlowStatus('init'); setErrorMsg(''); setSelectedCat(''); setCategories([]); setClientToken(''); }}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Integration notes ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
        <p className="font-bold">📋 Integration Notes</p>
        <p>• Env vars needed: <code>KLARNA_API_URL</code>, <code>KLARNA_API_USERNAME</code>, <code>KLARNA_API_PASSWORD</code></p>
        <p>• Test environment: <code>https://api.playground.klarna.com</code></p>
        <p>• Add <code>x.klarnacdn.net</code> to your <code>next.config.js</code> <code>scriptSrc</code> CSP</p>
        <p>• Add <code>/api/klarna/callback</code> route to receive fraud / capture webhooks</p>
        <p>• Klarna pays out dealer T+1 regardless of customer plan (pay later / instalments)</p>
      </div>

      <DeliveryLock unlocked={flowStatus === 'confirmed' && fraudStatus !== 'REJECTED'} />
    </div>
  );
}

// ─── Bank Transfer Tab ────────────────────────────────────────────────────────

function BankTransferTab({ order }: { order: OrderSummary }) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [confirming, setConfirming] = useState(false);
  const reference = `BKE${order.agreementNumber.replace(/\D/g, '')}`;

  // REAL DATA GUIDE:
  // Bank transfer clearing in Sweden happens via Bankgiro (BGC).
  // Register with Bankgirot at bankgirot.se
  // BGC sends a daily transaction file (BGMAX format) — parse this to auto-confirm transfers.
  // Alternatively use Open Banking / PSD2: Tink or Intergiro APIs to verify
  // incoming transfers in real-time.

  const handleManualConfirm = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      setPaymentStatus('confirmed');
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Bank details */}
      <div className="bg-slate-50 rounded-xl p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          Bank Details — Give to Customer
        </p>
        <div className="space-y-3">
          {[
            { label: 'Company',    value: 'AVA MC AB' },
            { label: 'Bank',       value: 'Handelsbanken' },
            { label: 'Bankgiro',   value: '123-4567' },
            { label: 'IBAN',       value: 'SE35 5000 0000 0549 1000 0003' },
            { label: 'BIC/SWIFT',  value: 'HANDSESS' },
            { label: 'Amount',     value: `${order.balanceDue.toLocaleString('sv-SE')} kr` },
            { label: 'Reference',  value: reference },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-xs text-slate-400">{row.label}</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{row.value}</span>
            </div>
          ))}
        </div>
        {/* REAL DATA GUIDE: Each location gets its own Bankgiro number.
            Store in locations.bankgiro — used for per-store reconciliation.
            Reference format: BIKE{agreementId} — parse from BGMAX file for auto-matching. */}
      </div>

      {/* Copy notice */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
        <span className="text-amber-500 shrink-0">⚠</span>
        <p className="text-xs text-amber-700">
          Customer must include reference <strong>{reference}</strong> exactly.
          Without it, auto-matching fails and manual reconciliation is required.
        </p>
      </div>

      {/* Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-700">Transfer Status</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {paymentStatus === 'pending'
                ? 'Typically clears within 1–2 business days'
                : paymentStatus === 'confirmed'
                ? `${order.balanceDue.toLocaleString('sv-SE')} kr received and matched`
                : 'Checking...'}
            </p>
          </div>
          <StatusPill status={paymentStatus} />
        </div>

        {paymentStatus === 'pending' && (
          <button
            onClick={handleManualConfirm}
            disabled={confirming}
            className="mt-3 w-full py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-50 transition-colors"
          >
            {confirming ? 'Confirming…' : 'Mark as Received (Manual)'}
          </button>
        )}

        {paymentStatus === 'confirmed' && (
          <p className="text-xs text-green-600 font-semibold mt-2">✅ bank_transfer_status = CLEARED</p>
        )}
      </div>

      {/* Real data guide */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700 space-y-1">
        <p className="font-bold">📋 Real Integration Guide</p>
        <p>• Register a <strong>Bankgiro number</strong> at bankgirot.se (one per location)</p>
        <p>• Enable BGMAX file delivery — Bankgirot sends daily transfer files to your SFTP</p>
        <p>• Parse BGMAX: match by reference → auto-set <code>bank_transfer_status = CLEARED</code></p>
        <p>• Or use <strong>Tink (tink.com)</strong> for real-time Open Banking — instant confirmation</p>
        <p>• Auto-unlock delivery when status = CLEARED (no manual override without HQ)</p>
      </div>

      <DeliveryLock unlocked={paymentStatus === 'confirmed'} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'financing',     label: 'Financing',     icon: '🏦' },
  { id: 'swish',         label: 'Swish',         icon: '📱' },
  { id: 'card',          label: 'Blipp / Kort',  icon: '📡' },
  { id: 'klarna',        label: 'Klarna',         icon: '🛍' },
  { id: 'bank-transfer', label: 'Bank Transfer',  icon: '🏛' },
];

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';

  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentMethod>('financing');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }
    setReady(true);
  }, [router]);

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const order = MOCK_ORDER;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Sales</Link>
            <span>→</span>
            <Link href={`/sales/leads/${id}/agreement`} className="hover:text-[#FF6B2C] transition-colors">Agreement</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">Payment</span>
          </nav>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Payment — {order.agreementNumber}</h1>
                <p className="text-sm text-slate-400 mt-0.5">{order.location}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 md:px-8 py-8">
          <div className="flex flex-col xl:flex-row gap-6">

            {/* Left: Order Summary */}
            <div className="xl:w-80 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-100 p-5 sticky top-6 animate-fade-up">
                <h2 className="text-sm font-bold text-slate-900 mb-4">Order Summary</h2>

                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-50">
                  <div className="w-10 h-10 rounded-xl bg-[#0b1524] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {order.customerName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{order.customerName}</p>
                    <p className="text-xs text-slate-400">{order.personnummer}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mb-3 font-medium">{order.vehicle}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vehicle</span>
                    <span className="font-medium">{order.vehiclePrice.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Accessories</span>
                    <span className="font-medium">+{order.accessories.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Trade-in credit</span>
                    <span className="font-medium">−{order.tradeInCredit.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900">
                    <span>Total</span>
                    <span>{order.totalAmount.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>Deposit paid</span>
                    <span>−{order.deposit.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="flex justify-between font-black text-lg text-[#FF6B2C]">
                    <span>Balance due</span>
                    <span>{order.balanceDue.toLocaleString('sv-SE')} kr</span>
                  </div>
                </div>

                {/* Commission summary */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Revenue Split</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bike margin</span>
                      <span className="font-bold text-slate-700">~18,000 kr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">F&I commission</span>
                      <span className="font-bold text-slate-700">2,846 kr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Salesperson</span>
                      <span className="font-bold text-[#FF6B2C]">2,846 kr</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Payment methods */}
            <div className="flex-1 animate-fade-up">
              {/* Tab selector */}
              <div className="bg-white rounded-2xl border border-slate-100 p-1.5 flex gap-1 mb-5">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-[#0b1524] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                {activeTab === 'financing'     && <FinancingTab order={order} />}
                {activeTab === 'swish'         && <SwishTab order={order} />}
                {activeTab === 'card'          && <CardTab order={order} />}
                {activeTab === 'klarna'        && <KlarnaTab order={order} />}
                {activeTab === 'bank-transfer' && <BankTransferTab order={order} />}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
