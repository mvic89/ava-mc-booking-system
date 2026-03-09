'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult } from '@/types';
import { notify } from '@/lib/notifications';

type SignStep = 'customer-pending' | 'customer-signing' | 'dealer-pending' | 'dealer-signing' | 'complete';

interface SignRecord {
  name: string;
  personalNumber: string;
  signedAt: string;
}

export default function BankIDSigningPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';
  const tNotif = useTranslations('notifications');

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<SignStep>('customer-pending');
  const [customerRecord, setCustomerRecord] = useState<SignRecord | null>(null);
  const [dealerRecord, setDealerRecord] = useState<SignRecord | null>(null);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }
    setReady(true);
  }, [router]);

  const now = () =>
    new Date().toLocaleString('sv-SE', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' via BankID';

  const handleCustomerComplete = (result: BankIDResult) => {
    setCustomerRecord({
      name: result.user.name,
      personalNumber: result.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2'),
      signedAt: now(),
    });
    setStep('dealer-pending');
  };

  const handleDealerComplete = (result: BankIDResult) => {
    const dealerRec: SignRecord = {
      name: result.user.name,
      personalNumber: result.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2'),
      signedAt: now(),
    };
    setDealerRecord(dealerRec);
    setStep('complete');
    // Persist both signatures so the complete page can offer the signed PDF download
    localStorage.setItem(
      `agreement_signed_${id}`,
      JSON.stringify({ customer: customerRecord, dealer: dealerRec }),
    );
    notify('agreementSigned', {
      type:    'agreement',
      title:   tNotif('actions.agreementSigned.title'),
      message: `${tNotif('actions.agreementSigned.signedBy')} ${customerRecord?.name ?? 'kund'} ${tNotif('actions.agreementSigned.and')} ${dealerRec.name} ${tNotif('actions.agreementSigned.viaBankID')}`,
      href:    `/sales/leads/${id}/agreement/signed`,
    });
    setTimeout(() => router.push(`/sales/leads/${id}/agreement/signed`), 1200);
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const customerDone = !!customerRecord;
  const dealerDone = !!dealerRecord;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Försäljning</Link>
            <span>→</span>
            <Link href={`/sales/leads/${id}/agreement/preview`} className="hover:text-[#FF6B2C] transition-colors">Avtal</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">BankID-signering</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪪</span>
            <h1 className="text-2xl font-bold text-slate-900">BankID-signering: AGR-2024-0089</h1>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="px-5 md:px-8 pb-4 bg-white border-b border-slate-100">
          <div className="flex items-center">
            {(['Avtal', 'Förhandsvisning', 'Signering', 'Betalning', 'Klart'] as const).map((step, i) => {
              const isActive = i === 2;
              const isDone   = i < 2;
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
        <div className="flex-1 px-5 md:px-8 py-10">
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-fade-up">

              <div className="text-center mb-6">
                <h2 className="text-base font-bold text-slate-900">Signeringsstatus</h2>
                <p className="text-xs text-slate-400 mt-1">Båda parter måste signera med BankID</p>
              </div>

              {/* ── Customer Signature ── */}
              <div className={`rounded-xl border p-4 mb-4 transition-colors ${
                customerDone ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${customerDone ? 'text-green-700' : 'text-slate-600'}`}>
                    {customerDone ? '✅ Kundens underskrift — Klar' : '1️⃣ Kundens underskrift'}
                  </span>
                  {!customerDone && (
                    <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">Väntar</span>
                  )}
                </div>

                {customerDone && customerRecord ? (
                  <>
                    <p className="text-sm text-slate-700 font-medium">{customerRecord.name} ({customerRecord.personalNumber})</p>
                    <p className="text-xs text-slate-500 mt-0.5">Signerad: {customerRecord.signedAt}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-green-600">✓ Identitet verifierad</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-green-600">✓ Juridiskt bindande</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500">Kunden signerar avtalet först</p>
                    <button
                      onClick={() => setStep('customer-signing')}
                      className="mt-3 w-full py-2.5 rounded-xl bg-[#0b1524] hover:bg-[#1a2a42] text-white text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🪪</span> Signera som kund
                    </button>
                  </>
                )}
              </div>

              {/* ── Dealer Signature ── */}
              <div className={`rounded-xl border p-4 mb-6 transition-colors ${
                dealerDone
                  ? 'border-green-200 bg-green-50'
                  : customerDone
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-100 bg-slate-50 opacity-50'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${
                    dealerDone ? 'text-green-700' : customerDone ? 'text-amber-700' : 'text-slate-400'
                  }`}>
                    {dealerDone ? '✅ Återförsäljarens underskrift — Klar' : customerDone ? '⏳ Återförsäljarens underskrift — Väntar' : '2️⃣ Återförsäljarens underskrift'}
                  </span>
                  {!dealerDone && !customerDone && (
                    <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">Väntar på kund</span>
                  )}
                </div>

                {dealerDone && dealerRecord ? (
                  <>
                    <p className="text-sm text-slate-700 font-medium">{dealerRecord.name} ({dealerRecord.personalNumber})</p>
                    <p className="text-xs text-slate-500 mt-0.5">Signerad: {dealerRecord.signedAt}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-green-600">✓ Identitet verifierad</span>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-green-600">✓ Juridiskt bindande</span>
                    </div>
                  </>
                ) : customerDone ? (
                  <>
                    <p className="text-sm text-amber-700">Återförsäljaren signerar — öppna BankID-appen</p>
                    <button
                      onClick={() => setStep('dealer-signing')}
                      className="mt-3 w-full py-2.5 rounded-xl bg-[#0b1524] hover:bg-[#1a2a42] text-white text-sm font-bold tracking-wide transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🪪</span> Signera som återförsäljare
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Väntar på kundens signatur…</p>
                )}
              </div>

              {/* Completing message */}
              {step === 'complete' && (
                <div className="flex items-center justify-center gap-2 py-3 text-green-700 font-semibold text-sm animate-fade-in">
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  Båda parter signerat — bearbetar automation…
                </div>
              )}

              {/* Footer note */}
              {!dealerDone && (
                <p className="text-xs text-amber-600 text-center">
                  ⚡ Efter båda signaturer: 10 automatiska åtgärder utförs omedelbart (faktura, betalningsplan, leverans…)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BankID Modal: Customer ── */}
      {step === 'customer-signing' && (
        <BankIDModal
          mode="sign"
          signText="Jag signerar köpeavtal AGR-2024-0089 för Kawasaki Ninja ZX-6R 2024, totalt 133 280 kr."
          title="Signera köpeavtal"
          subtitle="Kunden signerar köpeavtalet digitalt. Juridiskt bindande signatur."
          onComplete={handleCustomerComplete}
          onCancel={() => setStep('customer-pending')}
          autoStart
        />
      )}

      {/* ── BankID Modal: Dealer ── */}
      {step === 'dealer-signing' && (
        <BankIDModal
          mode="sign"
          signText="Jag signerar köpeavtal AGR-2024-0089 som auktoriserad representant för AVA MC AB."
          title="Signera köpeavtal — Återförsäljare"
          subtitle="Återförsäljaren signerar köpeavtalet som juridiskt ombud."
          onComplete={handleDealerComplete}
          onCancel={() => setStep('dealer-pending')}
          autoStart
        />
      )}
    </div>
  );
}
