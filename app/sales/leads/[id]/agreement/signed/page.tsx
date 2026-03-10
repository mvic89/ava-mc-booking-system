'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Sidebar from '@/components/Sidebar';
import jsPDF from 'jspdf';
import { getDealerInfo } from '@/lib/dealer';

interface SignRecord {
  name:           string;
  personalNumber: string;
  signedAt:       string;
}

interface SignedAgreement {
  customer: SignRecord;
  dealer:   SignRecord;
}

const AGR_BASE = {
  agreementNumber:   'AGR-2024-0089',
  date:              '10 feb 2026',
  buyerName:         'Lars Bergman',
  buyerAddress:      'Sveavägen 42, Stockholm',
  vehicle:           'Kawasaki Ninja ZX-6R 2024',
  vin:               'JKBZXR636PA012345',
  accessories:       'Akrapovic, Tank Pad, Crash Protectors (15 280 kr)',
  tradeIn:           'Kawasaki Ninja 300 2020 — Inbytesvärde: 32 000 kr',
  totalPrice:        '133 280 kr (inkl. moms 26 656 kr)',
  financing:         '36 mån × 4 092 kr/mån vid 4,9 % eff. årsränta',
  warranty:          '3 år fabriksgaranti + 1 år återförsäljargaranti',
  returnPolicy:      '14 dagar per Distansavtalslagen (2005:59)',
};

export default function SignedAgreementPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';
  const t = useTranslations('agreement');

  const [ready, setReady]             = useState(false);
  const [signatures, setSignatures]   = useState<SignedAgreement | null>(null);
  const [contact, setContact]         = useState<{ email: string; phone: string } | null>(null);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [sendStatus, setSendStatus]   = useState<string | null>(null);
  const [sellerName, setSellerName]   = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [sellerOrgNr, setSellerOrgNr] = useState('');

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }
    const d = getDealerInfo();
    setSellerName(d.name);
    setSellerAddress(d.city);
    setSellerOrgNr(d.orgNr);

    try {
      const sig = JSON.parse(localStorage.getItem(`agreement_signed_${id}`) ?? 'null');
      if (sig) setSignatures(sig);
    } catch {
      // ignore
    }

    try {
      const customLeads = JSON.parse(localStorage.getItem('custom_leads') || '[]');
      const lead = customLeads.find((l: any) => String(l.id) === id);
      if (lead?.email || lead?.phone) {
        setContact({ email: lead.email || '', phone: lead.phone || '' });
      }
    } catch {
      // ignore
    }

    setReady(true);
  }, [router, id]);

  // Build a jsPDF document with all agreement fields and signatures
  const buildPDF = (): jsPDF => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginL = 20;
    const marginR = 190;
    const lineH   = 7;
    let y = 20;

    // Header row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 107, 44); // #FF6B2C
    doc.text('MOTOOS', marginL, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`${sellerName}  •  Org.nr ${sellerOrgNr}`, marginR, y, { align: 'right' });

    y += 5;
    // "Fully Signed" badge
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61); // green-700
    doc.text('✓ Fully Signed', marginR, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(marginL, y, marginR, y);
    y += 10;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('KÖPEAVTAL', 105, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`${AGR_BASE.agreementNumber}  •  Datum: ${AGR_BASE.date}`, 105, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.line(marginL, y, marginR, y);
    y += 8;

    // Fields
    const fields = [
      { label: 'SÄLJARE',       value: `${sellerName}, ${sellerAddress}` },
      { label: 'KÖPARE',        value: `${AGR_BASE.buyerName}, ${AGR_BASE.buyerAddress}` },
      { label: 'FORDON',        value: `${AGR_BASE.vehicle}, VIN: ${AGR_BASE.vin}` },
      { label: 'TILLBEHÖR',     value: AGR_BASE.accessories },
      { label: 'INBYTE',        value: AGR_BASE.tradeIn },
      { label: 'TOTALPRIS',     value: AGR_BASE.totalPrice },
      { label: 'FINANSIERING',  value: AGR_BASE.financing },
      { label: 'GARANTI',       value: AGR_BASE.warranty },
      { label: 'ÅNGERRÄTT',     value: AGR_BASE.returnPolicy },
      { label: 'LEVERANS',      value: `Beräknad 14 feb 2026, ${sellerAddress}` },
    ];

    for (const row of fields) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(row.label + ':', marginL, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // slate-800

      // Wrap long values
      const lines = doc.splitTextToSize(row.value, 120);
      doc.text(lines, marginL + 38, y);
      y += lineH * (lines.length > 1 ? lines.length : 1);
    }

    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginL, y, marginR, y);
    y += 10;

    // Signatures
    const renderSig = (label: string, rec: SignRecord | undefined) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(label, marginL, y);
      y += 5;

      if (rec) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(rec.name, marginL, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(rec.personalNumber, marginL, y);
        y += 5;

        doc.setFontSize(8);
        doc.setTextColor(21, 128, 61);
        doc.text(`✓ Signed: ${rec.signedAt}`, marginL, y);
        y += 8;
      } else {
        doc.setDrawColor(203, 213, 225);
        doc.line(marginL, y + 4, marginL + 80, y + 4);
        y += 12;
      }
    };

    renderSig('Köparens underskrift (BankID):', signatures?.customer);
    renderSig('Säljarens underskrift (BankID):', signatures?.dealer);

    // Footer
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Detta avtal regleras av svensk lag. Signerat elektroniskt via BankID.', 105, y, { align: 'center' });

    return doc;
  };

  const pdfFilename = `Purchase-Agreement-${AGR_BASE.agreementNumber}-SIGNED.pdf`;

  const handleDownloadPDF = () => {
    const doc = buildPDF();
    doc.save(pdfFilename);
  };

  const handleSendEmail = async () => {
    if (!contact?.email) return;
    setSendStatus(null);

    const doc = buildPDF();
    const blob = doc.output('blob');
    const file = new File([blob], pdfFilename, { type: 'application/pdf' });

    // Try native share with file (works on iOS/Android/some desktop browsers)
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Signed Purchase Agreement — ${AGR_BASE.agreementNumber}`,
          text: `Your signed purchase agreement for ${AGR_BASE.vehicle} (${AGR_BASE.totalPrice}) is attached.`,
        });
        setSendStatus('Shared successfully via native share sheet.');
        return;
      } catch {
        // User cancelled or share failed — fall through to fallback
      }
    }

    // Fallback: download the PDF then open email client
    doc.save(pdfFilename);
    const subject = encodeURIComponent(`Your Signed Purchase Agreement — ${AGR_BASE.agreementNumber}`);
    const body = encodeURIComponent(
      `Dear ${signatures?.customer.name ?? 'Customer'},\n\n` +
      `Your purchase agreement (${AGR_BASE.agreementNumber}) has been signed by both parties and is now legally binding.\n\n` +
      `Vehicle: ${AGR_BASE.vehicle}\n` +
      `Total: ${AGR_BASE.totalPrice}\n\n` +
      `The signed PDF has been downloaded to your device — please attach it to this email before sending.\n\n` +
      `Best regards,\n${sellerName}`
    );
    window.open(`mailto:${contact.email}?subject=${subject}&body=${body}`);
    setSendStatus('PDF downloaded. Please attach it to the email that just opened.');
  };

  const handleSendSMS = async () => {
    if (!contact?.phone) return;
    setSendStatus(null);

    const doc = buildPDF();
    const blob = doc.output('blob');
    const file = new File([blob], pdfFilename, { type: 'application/pdf' });

    // Try native share with file
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Signed Agreement — ${AGR_BASE.agreementNumber}`,
          text: `Hi ${signatures?.customer.name ?? 'there'}, your signed purchase agreement (${AGR_BASE.agreementNumber}) is attached.`,
        });
        setSendStatus('Shared successfully via native share sheet.');
        return;
      } catch {
        // fall through
      }
    }

    // Fallback: download then open SMS
    doc.save(pdfFilename);
    const smsBody = encodeURIComponent(
      `Hi ${signatures?.customer.name ?? 'there'}, your signed purchase agreement (${AGR_BASE.agreementNumber}) for ${AGR_BASE.vehicle} is ready. ` +
      `The PDF has been downloaded — please check your device downloads folder.`
    );
    window.open(`sms:${contact.phone}?body=${smsBody}`);
    setSendStatus('PDF downloaded. Please attach it to the SMS that just opened.');
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const fields = [
    { label: 'SÄLJARE',       value: `${sellerName}, ${sellerAddress}` },
    { label: 'KÖPARE',        value: `${AGR_BASE.buyerName}, ${AGR_BASE.buyerAddress}` },
    { label: 'FORDON',        value: `${AGR_BASE.vehicle}, VIN: ${AGR_BASE.vin}` },
    { label: 'TILLBEHÖR',     value: AGR_BASE.accessories },
    { label: 'INBYTE',        value: AGR_BASE.tradeIn },
    { label: 'TOTALPRIS',     value: AGR_BASE.totalPrice },
    { label: 'FINANSIERING',  value: AGR_BASE.financing },
    { label: 'GARANTI',       value: AGR_BASE.warranty },
    { label: 'ÅNGERRÄTT',     value: AGR_BASE.returnPolicy },
    { label: 'LEVERANS',      value: `Beräknad 14 feb 2026, ${sellerAddress}` },
  ];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
            <Link href="/sales/leads" className="hover:text-[#FF6B2C] transition-colors">{t('breadcrumb.sales')}</Link>
            <span>→</span>
            <Link href={`/sales/leads/${id}/agreement/sign`} className="hover:text-[#FF6B2C] transition-colors">{t('signed.breadcrumbSigning')}</Link>
            <span>→</span>
            <span className="text-slate-700 font-medium">{t('signed.breadcrumbTitle')}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t('signed.title')} {AGR_BASE.agreementNumber}</h1>
              <p className="text-sm text-green-600 font-medium mt-0.5">{t('signed.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="px-5 md:px-8 pb-4 bg-white border-b border-slate-100">
          <div className="flex items-center">
            {[t('progress.step0'), t('progress.step1'), t('progress.step2'), t('progress.step3'), t('progress.step4')].map((step, i) => {
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
          <div className="max-w-2xl mx-auto">

            {/* Signed Agreement Document */}
            <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 animate-fade-up">

              {/* Document header */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
                <span className="text-xl font-extrabold tracking-tight text-[#FF6B2C]">BikeMeNow</span>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{sellerName}{sellerOrgNr ? ` • Org.nr ${sellerOrgNr}` : ''}</p>
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    ✓ {t('signed.fullySigned')}
                  </span>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-base font-bold text-slate-900 tracking-widest uppercase">
                  {t('signed.docTitle')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {AGR_BASE.agreementNumber} • Datum: {AGR_BASE.date}
                </p>
              </div>

              <div className="border-t border-slate-100 mb-5" />

              {/* Fields */}
              <div className="space-y-2.5 text-sm">
                {fields.map(row => (
                  <div key={row.label} className="flex gap-3">
                    <span className="text-slate-400 font-semibold text-xs w-28 shrink-0 pt-0.5">{row.label}:</span>
                    <span className="text-slate-800">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 mt-6 mb-5" />

              {/* Signatures */}
              <div className="space-y-4">
                {/* Customer */}
                <div className={`rounded-xl p-4 ${signatures ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('signed.buyerSig')}</p>
                  {signatures ? (
                    <>
                      <p className="text-sm font-bold text-slate-800">{signatures.customer.name}</p>
                      <p className="text-xs text-slate-500">{signatures.customer.personalNumber}</p>
                      <p className="text-xs text-green-600 mt-1 font-medium">{t('signed.signedAt')} {signatures.customer.signedAt}</p>
                    </>
                  ) : (
                    <div className="h-8 border-b border-slate-300 w-64" />
                  )}
                </div>

                {/* Dealer */}
                <div className={`rounded-xl p-4 ${signatures ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('signed.sellerSig')}</p>
                  {signatures ? (
                    <>
                      <p className="text-sm font-bold text-slate-800">{signatures.dealer.name}</p>
                      <p className="text-xs text-slate-500">{signatures.dealer.personalNumber}</p>
                      <p className="text-xs text-green-600 mt-1 font-medium">{t('signed.signedAt')} {signatures.dealer.signedAt}</p>
                    </>
                  ) : (
                    <div className="h-8 border-b border-slate-300 w-64" />
                  )}
                </div>
              </div>

              {/* Footer */}
              <p className="text-xs text-slate-400 mt-6 text-center">
                {t('signed.footer')}
              </p>
            </div>

            {/* Action buttons — all on one row */}
            <div className="flex flex-wrap items-center gap-3 mt-6 animate-fade-up">
              <Link
                href={`/sales/leads/${id}/agreement/sign`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
              >
                {t('signed.back')}
              </Link>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-300 bg-green-50 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
              >
                {t('signed.downloadPDF')}
              </button>
              <button
                onClick={() => { setShowSendPanel(p => !p); setSendStatus(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-300 bg-blue-50 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {t('signed.sendToCustomer')}
              </button>
              <Link
                href={`/sales/leads/${id}/agreement/payment`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-semibold transition-colors"
              >
                {t('signed.goToPayment')}
              </Link>
            </div>

            {/* Send to Customer panel */}
            {showSendPanel && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 animate-fade-up">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
                  {t('signed.sendPanelTitle')}
                </p>

                {sendStatus && (
                  <p className="text-xs text-blue-800 bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                    ℹ️ {sendStatus}
                  </p>
                )}

                {contact ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {contact.email && (
                      <button
                        onClick={handleSendEmail}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-blue-200 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                      >
                        📧 E-post — {contact.email}
                      </button>
                    )}
                    {contact.phone && (
                      <button
                        onClick={handleSendSMS}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-blue-200 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                      >
                        📱 SMS — {contact.phone}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-blue-600">
                    {t('signed.noContact')}
                  </p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
