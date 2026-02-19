'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import type { BankIDResult, Demo } from '@/types';
import DemoCard from '@/components/DemoCard';
import Field from '@/components/Field';

export default function BankIDTestPage() {
  const [activeDemo, setActiveDemo] = useState<Demo>('none');
  const [lastResult, setLastResult] = useState<BankIDResult | null>(null);

  const handleComplete = (result: BankIDResult) => {
    setLastResult(result);
    // Close modal after a short delay to show success state
    setTimeout(() => setActiveDemo('none'), 1500);
  };

  return (
    <div className="max-w-225 mx-auto px-6 py-10">

       {/* New Lead Page Component */}
      <div className="mt-16 border-b border-slate-200 pt-16">
       <Sidebar/>
      </div>

      {/* Header */}
      <div className="mb-10">
        <h2 className="text-[22px] font-bold mt-2">
          BankID v6.0 — Test Environment
        </h2>
        <p className="text-slate-500 mt-1 text-sm">
          Reusable BankID component for identification and signing.
          Uses animated QR codes (HMAC-SHA256). Works on every page.
        </p>
      </div>

      {/* Use Case Buttons */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <DemoCard
          title="Identifiera kund"
          description="Customer scans QR → Returns personnummer + name"
          tag="POST /auth"
          tagColor="#2563eb"
          onClick={() => setActiveDemo('identify')}
        />
        <DemoCard
          title="Signera ansvarsfriskrivning"
          description="Customer signs test drive waiver via BankID"
          tag="POST /sign"
          tagColor="#16a34a"
          onClick={() => setActiveDemo('sign-waiver')}
        />
        <DemoCard
          title="Signera köpeavtal"
          description="Customer signs purchase agreement"
          tag="POST /sign"
          tagColor="#16a34a"
          onClick={() => setActiveDemo('sign-agreement')}
        />
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-10">
          <h3 className="text-base font-bold mb-3">
            ✅ Last BankID Result
          </h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-8">
            <Field label="Namn" value={lastResult.user.name} source="BankID" />
            <Field label="Personnummer" value={lastResult.user.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')} source="BankID" />
            <Field label="Födelsedatum" value={lastResult.user.dateOfBirth} source="Personnummer" />
            <Field label="Risk" value={lastResult.risk} source="BankID" />
            <Field label="IP" value={lastResult.device.ipAddress} source="Device" />
            <Field label="BankID utfärdat" value={lastResult.bankIdIssueDate} source="BankID" />

            {/* Roaring.io data */}
            {lastResult.roaring && (
              <>
                {lastResult.roaring.address && (
                  <>
                    <Field label="Adress" value={lastResult.roaring.address.street} source="Roaring.io" />
                    <Field label="Postnummer" value={lastResult.roaring.address.postalCode} source="Roaring.io" />
                    <Field label="Stad" value={lastResult.roaring.address.city} source="Roaring.io" />
                  </>
                )}
                {lastResult.roaring.gender && (
                  <Field label="Kön" value={lastResult.roaring.gender === 'M' ? 'Man' : 'Kvinna'} source="Roaring.io" />
                )}
                {lastResult.roaring.citizenship && (
                  <Field label="Medborgarskap" value={lastResult.roaring.citizenship} source="Roaring.io" />
                )}
              </>
            )}
          </div>
          {!lastResult.roaring && (
            <div className="mt-4 px-3.5 py-2.5 bg-amber-100 rounded-lg text-sm text-amber-900">
              <strong>Note:</strong> Roaring.io data could not be fetched. Please check your ROARING_API_KEY environment variable.
            </div>
          )}
          {lastResult.roaring && (
            <div className="mt-4 px-3.5 py-2.5 bg-green-50 rounded-lg text-sm text-green-600">
              ✅ <strong>Complete!</strong> BankID authentication and Roaring.io data successfully combined.
            </div>
          )}
        </div>
      )}

      {/* Setup Guide */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-bold mb-3">📋 Setup</h3>
        <ol className="pl-5 text-sm text-slate-600 leading-8">
          <li>Download test cert from <code>bankid.com/en/utvecklare/test</code> → <code>FPTestcert4_20230629.p12</code></li>
          <li>Place in <code>./certs/</code> directory</li>
          <li>Install BankID app on phone → switch to test environment</li>
          <li>Create test person at <code>demo.bankid.com</code></li>
          <li>Run <code>npm install && npm run dev</code></li>
          <li>Click any button above → scan QR with test BankID</li>
        </ol>

        <h4 className="text-sm font-bold mt-5 mb-2">
          Using BankIDModal on any page:
        </h4>
        <pre className="bg-slate-800 text-slate-200 p-4 rounded-lg text-xs leading-relaxed overflow-auto">{`import BankIDModal from '@/components/BankIDModal';

// For identification:
<BankIDModal
  mode="auth"
  onComplete={(result) => {
    console.log(result.user.personalNumber);
    console.log(result.user.name);
  }}
  onCancel={() => setShowBankID(false)}
/>

// For signing:
<BankIDModal
  mode="sign"
  signText="Jag signerar köpeavtal #SA-2026-042"
  onComplete={(result) => { ... }}
  onCancel={() => { ... }}
/>`}</pre>
      </div>

      {/* ── BankID Modals ── */}
      {activeDemo === 'identify' && (
        <BankIDModal
          mode="auth"
          title="Identifiera kund"
          subtitle="Be kunden skanna QR-koden med BankID-appen."
          onComplete={handleComplete}
          onCancel={() => setActiveDemo('none')}
          autoStart
        />
      )}

      {activeDemo === 'sign-waiver' && (
        <BankIDModal
          mode="sign"
          signText="Jag godkänner ansvarsfriskrivningen för provkörning av Kawasaki Ninja ZX-6R hos AVA Motorcyklar."
          title="Signera ansvarsfriskrivning"
          subtitle="Kunden signerar provkörningsvillkor."
          onComplete={handleComplete}
          onCancel={() => setActiveDemo('none')}
          autoStart
        />
      )}

      {activeDemo === 'sign-agreement' && (
        <BankIDModal
          mode="sign"
          signText="Jag signerar köpeavtal #SA-2026-042 för Kawasaki Ninja ZX-6R, totalt 98 280 kr."
          title="Signera köpeavtal"
          subtitle="Kunden signerar köpeavtalet digitalt."
          onComplete={handleComplete}
          onCancel={() => setActiveDemo('none')}
          autoStart
        />
      )}
    </div>
  );
}
