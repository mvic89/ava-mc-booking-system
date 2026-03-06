'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface AgreementData {
  agreementNumber: string;
  date: string;
  sellerName: string;
  sellerAddress: string;
  buyerName: string;
  buyerAddress: string;
  personnummer: string;
  vehicle: string;
  vin: string;
  accessories: string;
  accessoriesPrice: number;
  tradeIn: string;
  tradeInCredit: number;
  totalPrice: number;
  vatAmount: number;
  financingMonths: number;
  financingMonthly: number;
  financingApr: number;
  warrantyManufacturer: number;
  warrantyDealer: number;
  deliveryDate: string;
  deliveryLocation: string;
}

const MOCK_AGREEMENT: AgreementData = {
  agreementNumber: 'AGR-2024-0089',
  date: 'Feb 10, 2026',
  sellerName: 'AVA MC AB',
  sellerAddress: 'Kista, Stockholm',
  buyerName: 'Lars Bergman',
  buyerAddress: 'Sveavägen 42, Stockholm',
  personnummer: '197506123456',
  vehicle: 'Kawasaki Ninja ZX-6R 2024',
  vin: 'JKBZXR636PA012345',
  accessories: 'Akrapovic, Tank Pad, Crash Protectors',
  accessoriesPrice: 15280,
  tradeIn: 'Kawasaki Ninja 300 2020',
  tradeInCredit: 32000,
  totalPrice: 133280,
  vatAmount: 26656,
  financingMonths: 36,
  financingMonthly: 4092,
  financingApr: 4.9,
  warrantyManufacturer: 3,
  warrantyDealer: 1,
  deliveryDate: 'Feb 14, 2026',
  deliveryLocation: 'AVA MC, Kista',
};

export default function AgreementPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';
  const [ready, setReady] = useState(false);

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

  const agr = MOCK_AGREEMENT;

  // Konsumentkreditlagen 2010:1846 — computed credit totals
  const creditAmount = agr.totalPrice - agr.tradeInCredit;
  const totalRepayable = agr.financingMonthly * agr.financingMonths;
  const totalCreditCost = totalRepayable - creditAmount;

  const fmt = (n: number) => n.toLocaleString('sv-SE');

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #agreement-doc, #agreement-doc * { visibility: visible !important; }
          #agreement-doc {
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
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">Försäljning</Link>
            <span>→</span>
            <Link href={`/sales/leads/${id}/agreement`} className="hover:text-[#FF6B2C] transition-colors">Avtal</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">Förhandsgranskning</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <h1 className="text-2xl font-bold text-slate-900">
              Förhandsgranskning: {agr.agreementNumber}
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-5 md:px-8 py-10">
          <div className="max-w-2xl mx-auto">

            {/* Legal Document */}
            <div id="agreement-doc" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 animate-fade-up">

              {/* Document header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
                <span className="text-xl font-extrabold tracking-tight text-[#FF6B2C]">MOTOOS</span>
                <div className="text-right">
                  <p className="text-xs text-slate-500">AVA MC AB • Org.nr 556123-4567</p>
                  <p className="text-xs text-slate-400">Kista, Stockholm • info@avamc.se</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-base font-bold text-slate-900 tracking-widest uppercase">
                  Köpeavtal — Motorcykel
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {agr.agreementNumber} • Datum: {agr.date}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 mb-5" />

              {/* Data fields — Swedish labels */}
              <div className="space-y-2.5 text-sm">
                {[
                  { label: 'SÄLJARE', value: `${agr.sellerName}, ${agr.sellerAddress} • Org.nr 556123-4567` },
                  { label: 'KÖPARE', value: `${agr.buyerName}, ${agr.buyerAddress} • Personnr: ${agr.personnummer}` },
                  { label: 'FORDON', value: agr.vehicle },
                  { label: 'VIN', value: agr.vin },
                  { label: 'TILLBEHÖR', value: `${agr.accessories} (${fmt(agr.accessoriesPrice)} kr)` },
                  { label: 'INBYTE', value: `${agr.tradeIn} — Kreditvärde: ${fmt(agr.tradeInCredit)} kr` },
                  { label: 'TOTALPRIS', value: `${fmt(agr.totalPrice)} kr (inkl. 25% moms ${fmt(agr.vatAmount)} kr)` },
                  { label: 'FINANSIERING', value: `${agr.financingMonths} mån × ${fmt(agr.financingMonthly)} kr/mån vid ${agr.financingApr}% eff. årsränta` },
                  { label: 'KREDITBELOPP', value: `${fmt(creditAmount)} kr` },
                  { label: 'TOTAL ATT BETALA', value: `${fmt(totalRepayable)} kr (varav ränta & avg. ${fmt(totalCreditCost)} kr)` },
                  { label: 'GARANTI', value: `${agr.warrantyManufacturer} år fabriksgaranti + ${agr.warrantyDealer} år återförsäljargaranti • Lagstadgad reklamationsrätt 3 år per Konsumentköplagen (2022:260)` },
                  { label: 'ÅNGERRÄTT', value: '14 dagar per Distansavtalslagen (2005:59) om avtal ingås på distans' },
                  { label: 'LEVERANS', value: `Beräknad ${agr.deliveryDate} på ${agr.deliveryLocation}` },
                ].map(row => (
                  <div key={row.label} className="flex gap-3">
                    <span className="text-slate-400 font-semibold text-xs w-36 shrink-0 pt-0.5">{row.label}:</span>
                    <span className="text-slate-800">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Legal prose §§ 1–11 */}
              <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Avtalsvillkor</p>

                {[
                  {
                    para: '§ 1 PARTER',
                    body: `Säljare: ${agr.sellerName}, org.nr 556123-4567, ${agr.sellerAddress}. Köpare: ${agr.buyerName}, personnr ${agr.personnummer}, ${agr.buyerAddress}.`,
                  },
                  {
                    para: '§ 2 FORDON',
                    body: `${agr.vehicle}, VIN ${agr.vin}, säljs i befintligt skick per Konsumentköplagen (2022:260). Säljaren garanterar att fordonet är fritt från dolda fel, belastningar och pantsättningar, samt uppfyller svenska myndighetskrav.`,
                  },
                  {
                    para: '§ 3 PRIS OCH BETALNING',
                    body: `Totalpris ${fmt(agr.totalPrice)} kr inkl. 25% moms per Prisinformationslagen (2004:347). Moms: ${fmt(agr.vatAmount)} kr. Betalning sker via avtalad finansiering eller kontant vid leverans.`,
                  },
                  {
                    para: '§ 4 FINANSIERING (Konsumentkreditlagen 2010:1846)',
                    body: `Kreditbelopp: ${fmt(creditAmount)} kr · Löptid: ${agr.financingMonths} månader · Månadskostnad: ${fmt(agr.financingMonthly)} kr/mån · Effektiv årsränta: ${agr.financingApr} % · Total kreditkostnad: ${fmt(totalCreditCost)} kr · Total att betala: ${fmt(totalRepayable)} kr. Köparen har rätt att betala i förtid (§ 32 KkrL). Ångerrätt för krediten 14 dagar från avtal (§ 21 KkrL).`,
                  },
                  {
                    para: '§ 5 GARANTI',
                    body: `${agr.warrantyManufacturer} års fabriksgaranti och ${agr.warrantyDealer} års återförsäljargaranti gäller från leveransdatum. Utöver avtalad garanti gäller lagstadgad reklamationsrätt i 3 år per Konsumentköplagen (2022:260) § 23, i enlighet med EU-direktiv 2019/771.`,
                  },
                  {
                    para: '§ 6 LEVERANS',
                    body: `Fordonet levereras ${agr.deliveryDate} på ${agr.deliveryLocation}. Äganderätt och risk för fordonet övergår till köparen vid full betalning och kvitterad leverans.`,
                  },
                  {
                    para: '§ 7 ÅNGERRÄTT',
                    body: 'Om avtalet ingås på distans eller utanför affärslokaler gäller 14 dagars ångerrätt per Distansavtalslagen (2005:59). Fordonet ska återlämnas i ursprungligt skick. Köparen ansvarar för värdeminskning som beror på hantering utöver vad som krävs för att fastställa varans egenskaper.',
                  },
                  {
                    para: '§ 8 TRANSPORTSTYRELSEN — ÄGARBYTE',
                    body: 'Säljaren ansvarar för att anmäla ägarbytet till Transportstyrelsen senast på leveransdagen. Köparen samtycker till ägarbytet och förbinder sig att omedelbart teckna trafikförsäkring för fordonet från och med ägarbytet.',
                  },
                  {
                    para: '§ 9 REKLAMATION',
                    body: 'Fel i fordonet ska reklameras inom skälig tid från det att köparen märkt eller borde ha märkt felet. Reklamation görs skriftligen till info@avamc.se. Vid tvist hänvisas i första hand till Allmänna Reklamationsnämnden (ARN, www.arn.se).',
                  },
                  {
                    para: '§ 10 PERSONUPPGIFTER',
                    body: 'Personuppgifter behandlas i enlighet med GDPR (EU 2016/679) och AVA MC ABs integritetspolicy (avamc.se/privacy). Uppgifterna sparas i 7 år per Bokföringslagen (1999:1078). Köparen har rätt till tillgång, rättelse, radering och portabilitet av sina uppgifter.',
                  },
                  {
                    para: '§ 11 TILLÄMPLIG LAG OCH TVIST',
                    body: 'Detta avtal regleras av svensk lag. Tvist avgörs i första hand av Allmänna Reklamationsnämnden (ARN, www.arn.se). Om ARN inte lämnar rekommendation, avgörs tvisten av Stockholms tingsrätt.',
                  },
                ].map(({ para, body }) => (
                  <div key={para}>
                    <p className="text-xs font-semibold text-slate-700">{para}</p>
                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{body}</p>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 mt-6 mb-5" />

              {/* Signatures */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-3 text-sm text-slate-500">
                  <span>Köparens underskrift:</span>
                  <span className="border-b border-slate-300 flex-1 min-w-[120px]" />
                  <span className="text-xs text-slate-400">(BankID)</span>
                </div>
                <div className="flex items-baseline gap-3 text-sm text-slate-500">
                  <span>Säljarens underskrift:</span>
                  <span className="border-b border-slate-300 flex-1 min-w-[120px]" />
                  <span className="text-xs text-slate-400">(BankID)</span>
                </div>
              </div>

              {/* Footer */}
              <p className="text-xs text-slate-400 mt-6 text-center">
                Detta avtal regleras av svensk lag. Konsumentkreditlagen 2010:1846 · Konsumentköplagen 2022:260 · Distansavtalslagen 2005:59
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-6 animate-fade-up">
              <Link
                href={`/sales/leads/${id}/agreement`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
              >
                ← Redigera
              </Link>
              <span
                title="Tillgänglig efter att båda parter har signerat med BankID"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-400 bg-slate-50 cursor-not-allowed select-none"
              >
                🔒 Ladda ner PDF
              </span>
              <Link
                href={`/sales/leads/${id}/agreement/sign`}
                className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a7d4f] hover:bg-[#156640] text-white text-sm font-semibold transition-colors"
              >
                Skicka för BankID-signering →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
