'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface SelectedPayment {
  id:       string;
  name:     string;
  icon:     string;
  category: string;
}

interface SignRecord {
  name:           string;
  personalNumber: string;
  signedAt:       string;
}

interface SignedAgreement {
  customer: SignRecord;
  dealer:   SignRecord;
}

function buildCascadeActions(pm: SelectedPayment | null) {
  const paymentLabel = pm
    ? `${pm.icon} Betalning initierad via ${pm.name}`
    : 'Betalningsplan: 36 × 4,092 kr/mån skapad';

  return [
    { label: 'Faktura auto-genererad: FAK-2024-0365 (133,280 kr)', delay: 300 },
    { label: paymentLabel,                                          delay: 400 },
    { label: 'Leveranskontroll aktiverad (58 punkter)',             delay: 500 },
    { label: 'Fordonsstatus: Tillgänglig → Reserverad',            delay: 600 },
    { label: 'Registrering initierad via Transportstyrelsen API',  delay: 800 },
    { label: 'Kundprofil: Lead → Kund',                            delay: 900 },
    { label: 'Team notifierat: Service, Leverans, Ekonomi',        delay: 1000 },
    { label: 'Fortnox bokföring synkad',                           delay: 1200 },
    { label: 'Blocket-annons borttagen',                           delay: 1500 },
    { label: 'Provision beräknad: Monica — 2,846 kr',              delay: 1800 },
  ];
}

export default function AgreementCompletePage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';

  const [ready, setReady]               = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [allDone, setAllDone]           = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SelectedPayment | null>(null);
  const [signatures, setSignatures]     = useState<SignedAgreement | null>(null);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }

    // Read which payment method the salesperson selected on the /payment page
    try {
      const pm = JSON.parse(sessionStorage.getItem('selectedPaymentMethod') ?? 'null');
      setPaymentMethod(pm);
    } catch {
      // ignore parse errors
    }
    sessionStorage.removeItem('selectedPaymentMethod');

    // Read signature records saved by the sign page
    try {
      const sig = JSON.parse(localStorage.getItem(`agreement_signed_${id}`) ?? 'null');
      if (sig) setSignatures(sig);
    } catch {
      // ignore parse errors
    }

    setReady(true);
  }, [router, id]);

  const handleDownloadPDF = () => {
    const original = document.title;
    document.title = 'Purchase-Agreement-AGR-2024-0089-SIGNED';
    window.print();
    document.title = original;
  };

  // Cascade animation — starts once ready + payment method resolved
  useEffect(() => {
    if (!ready) return;
    const actions = buildCascadeActions(paymentMethod);
    actions.forEach((action, i) => {
      setTimeout(() => {
        setCompletedCount((prev) => prev + 1);
        if (i === actions.length - 1) {
          setTimeout(() => setAllDone(true), 200);
        }
      }, action.delay);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const cascadeActions = buildCascadeActions(paymentMethod);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      {/* Print styles — only the signed agreement card is visible when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #signed-agreement-doc, #signed-agreement-doc * { visibility: visible !important; }
          #signed-agreement-doc {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 32px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Hidden signed agreement — rendered for print only */}
      <div id="signed-agreement-doc" className="hidden">
        <div style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#FF6B2C' }}>BikeMeNow</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>AVA MC AB • Org.nr 556123-4567</span>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Köpeavtal</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>AGR-2024-0089 • Datum: 10 feb 2026</div>
          </div>
          <hr style={{ margin: '16px 0', borderColor: '#e2e8f0' }} />
          {[
            { label: 'SÄLJARE',       value: 'AVA MC AB, Kista, Stockholm' },
            { label: 'KÖPARE',        value: 'Lars Bergman, Sveavägen 42, Stockholm' },
            { label: 'FORDON',        value: 'Kawasaki Ninja ZX-6R 2024, VIN: JKBZXR636PA012345' },
            { label: 'TILLBEHÖR',     value: 'Akrapovic, Tank Pad, Crash Protectors (15 280 kr)' },
            { label: 'INBYTE',        value: 'Kawasaki Ninja 300 2020 — Inbytesvärde: 32 000 kr' },
            { label: 'TOTALPRIS',     value: '133 280 kr (inkl. moms 26 656 kr)' },
            { label: 'FINANSIERING',  value: '36 mån × 4 092 kr/mån vid 4,9 % eff. årsränta' },
            { label: 'GARANTI',       value: '3 år fabriksgaranti + 1 år återförsäljargaranti' },
            { label: 'ÅNGERRÄTT',     value: '14 dagar per Distansavtalslagen (2005:59)' },
            { label: 'LEVERANS',      value: 'Beräknad 14 feb 2026, AVA MC, Kista' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <span style={{ width: 110, flexShrink: 0, fontWeight: 600, fontSize: 11, color: '#94a3b8', paddingTop: 2 }}>{row.label}:</span>
              <span>{row.value}</span>
            </div>
          ))}
          <hr style={{ margin: '20px 0', borderColor: '#e2e8f0' }} />
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Köparens underskrift (BankID):</div>
            {signatures ? (
              <div>
                <div style={{ fontWeight: 600 }}>{signatures.customer.name} &nbsp; {signatures.customer.personalNumber}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{signatures.customer.signedAt}</div>
              </div>
            ) : (
              <div style={{ borderBottom: '1px solid #cbd5e1', height: 24, width: 280 }} />
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Säljarens underskrift (BankID):</div>
            {signatures ? (
              <div>
                <div style={{ fontWeight: 600 }}>{signatures.dealer.name} &nbsp; {signatures.dealer.personalNumber}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{signatures.dealer.signedAt}</div>
              </div>
            ) : (
              <div style={{ borderBottom: '1px solid #cbd5e1', height: 24, width: 280 }} />
            )}
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 28 }}>
            Detta avtal regleras av svensk lag. Signerat elektroniskt via BankID.
          </p>
        </div>
      </div>

      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Progress stepper */}
        <div className="px-5 md:px-8 pb-4 bg-white border-b border-slate-100">
          <div className="flex items-center pt-4">
            {(['Avtal', 'Förhandsvisning', 'Signering', 'Betalning', 'Klart'] as const).map((step, i) => {
              const isActive = i === 4;
              const isDone   = i < 4;
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
                  {i < 4 && (
                    <span className={`mx-1 text-xs ${isDone ? 'text-green-300' : 'text-slate-200'}`}>›</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 md:px-8 py-8">

          {/* Success banner */}
          <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl px-6 py-5 mb-6 animate-fade-up">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-green-800">Avtal signerat av båda parter! 🎉</h1>
              <p className="text-sm text-green-600 mt-0.5">
                AGR-2024-0089 • Lars Bergman + AVA MC • Ninja ZX-6R • 133,280 kr
                {paymentMethod && (
                  <> • {paymentMethod.icon} <strong>{paymentMethod.name}</strong></>
                )}
              </p>
            </div>
          </div>

          {/* Cascade card */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-fade-up">

            {/* Cascade header */}
            <div className="bg-[#FF6B2C] px-6 py-3 flex items-center justify-center gap-2">
              <span className="text-white font-bold text-sm tracking-widest">
                ⚡ AUTOMATION CASCADE — 10 ÅTGÄRDER PÅ 2 SEKUNDER ⚡
              </span>
            </div>

            {/* Actions list */}
            <div className="p-6 space-y-3">
              {cascadeActions.map((action, i) => {
                const done = i < completedCount;
                const timeSec = (action.delay / 1000).toFixed(1);
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-4 transition-opacity duration-300 ${done ? 'opacity-100' : 'opacity-20'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors duration-300 ${
                      done ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i + 1}
                    </div>
                    <span className="flex-1 text-sm text-slate-700">{action.label}</span>
                    {done && (
                      <span className="text-xs text-green-500 font-semibold shrink-0">{timeSec} sek</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Completion bar */}
            <div className="px-6 pb-5">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${(completedCount / cascadeActions.length) * 100}%` }}
                />
              </div>
              {allDone && (
                <p className="text-sm font-bold text-green-700 text-center animate-fade-in">
                  Alla 10 åtgärder klara på 1.8 sekunder totalt
                </p>
              )}
            </div>
          </div>

          {/* DL Prime comparison */}
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mt-4 animate-fade-up">
            <span className="text-red-500">✗</span>
            <p className="text-sm text-red-700">
              I DL Prime kräver dessa 10 åtgärder 30+ minuters manuellt arbete fördelat på 4 olika skärmar
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6 animate-fade-up">
            <Link
              href="/sales/leads"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
            >
              ← Tillbaka till pipeline
            </Link>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
            >
              ⬇ Ladda ner signerat avtal
            </button>
            <div className="flex-1" />
            <Link
              href={`/sales/leads/${id}/delivery`}
              className="px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors"
            >
              Visa leverans →
            </Link>
            <Link
              href="/invoices"
              className="px-5 py-2.5 rounded-xl bg-[#1d4ed8] hover:bg-[#1a44c4] text-white text-sm font-semibold transition-colors"
            >
              Visa faktura →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
