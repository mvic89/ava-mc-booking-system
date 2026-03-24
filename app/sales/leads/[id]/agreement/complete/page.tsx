'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import jsPDF from 'jspdf';
import Sidebar from '@/components/Sidebar';
import { getDealerInfo } from '@/lib/dealer';
import { convertLeadToCustomer } from '@/lib/leads';
import { emit } from '@/lib/realtime';
import { toast } from 'sonner';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId } from '@/lib/tenant';

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

function buildCascadeActions(
  pm:             SelectedPayment | null,
  invoiceId:      string | null,
  invTotal:       number,
  salesperson:    string,
  transferCaseId: string | null,
  blocketDeleted: boolean,
) {
  const paymentLabel = pm
    ? `${pm.icon} Betalning initierad via ${pm.name}`
    : 'Betalningsplan: 36 × 4,092 kr/mån skapad';
  const invoiceLabel = invoiceId
    ? `Faktura auto-genererad: ${invoiceId} (${invTotal.toLocaleString('sv-SE')} kr)`
    : 'Faktura auto-genererad…';
  const provisionAmt   = invTotal > 0 ? Math.round(invTotal * 0.022).toLocaleString('sv-SE') : '—';
  const provisionLabel = `Provision beräknad: ${salesperson || '—'} — ${provisionAmt} kr`;
  const transportLabel = transferCaseId
    ? `Ägarbyte initierat via Transportstyrelsen: Ärende ${transferCaseId}`
    : 'Registrering initierad via Transportstyrelsen API';
  const blocketLabel = blocketDeleted
    ? 'Blocket-annons borttagen ✓'
    : 'Blocket-annons borttagen';

  return [
    { label: paymentLabel,                                   delay: 300  },
    { label: 'Leveranskontroll aktiverad (58 punkter)',      delay: 500  },
    { label: 'Fordonsstatus: Tillgänglig → Reserverad',     delay: 600  },
    { label: transportLabel,                                 delay: 800  },
    { label: 'Kundprofil: Lead → Kund',                     delay: 900  },
    { label: 'Team notifierat: Service, Leverans, Ekonomi',  delay: 1000 },
    { label: invoiceLabel,                                   delay: 1400 },
    { label: 'Fortnox bokföring synkad',                    delay: 1800 },
    { label: blocketLabel,                                   delay: 2100 },
    { label: provisionLabel,                                 delay: 2400 },
  ];
}

export default function AgreementCompletePage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || 'default';
  const t = useTranslations('agreement');

  const [ready, setReady]               = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [allDone, setAllDone]           = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SelectedPayment | null>(null);
  const [signatures, setSignatures]     = useState<SignedAgreement | null>(null);
  const [sellerName, setSellerName]     = useState('');
  const [sellerOrgNr, setSellerOrgNr]   = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [buyerName, setBuyerName]       = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerBike, setBuyerBike]       = useState('');
  const [buyerValue, setBuyerValue]     = useState('');
  const [invoiceId, setInvoiceId]         = useState<string | null>(null);
  const [invoiceTotal, setInvoiceTotal]   = useState(0);
  const [salesperson, setSalesperson]     = useState('');
  const [transferCaseId, setTransferCaseId] = useState<string | null>(null);
  const [blocketDeleted, setBlocketDeleted] = useState(false);

  // Agreement data from localStorage (written by agreement editor)
  const [storedAgr, setStoredAgr] = useState({
    agreementNumber: '',
    date:            '',
    vehicle:         '',
    vin:                '',
    registrationNumber: '',
    accessories:        '',
    tradeIn:            '',
    tradeInCredit:      0,
    totalPrice:         0,
    vatAmount:          0,
    financingMonths:    0,
    financingMonthly:   0,
    financingApr:       0,
    personnummer:       '',
  });

  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    if (!userRaw) { router.replace('/auth/login'); return; }

    // Dealer info
    const d = getDealerInfo();
    setSellerName(d.name);
    setSellerOrgNr(d.orgNr);
    setSellerAddress(d.city);

    // Salesperson name from session
    try {
      const u = JSON.parse(userRaw);
      setSalesperson((u.givenName ?? u.name ?? '') as string);
    } catch { /* ignore */ }

    // Payment method (read before clearing)
    try {
      const pm = JSON.parse(sessionStorage.getItem('selectedPaymentMethod') ?? 'null');
      setPaymentMethod(pm);
    } catch { /* ignore */ }
    sessionStorage.removeItem('selectedPaymentMethod');

    // Signature records
    try {
      const sig = JSON.parse(localStorage.getItem(`agreement_signed_${id}`) ?? 'null');
      if (sig) setSignatures(sig);
    } catch { /* ignore */ }

    // Agreement fields from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(`agreement_${id}`) ?? '{}');
      const autoAgrNum = `AGR-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;
      setStoredAgr({
        agreementNumber:  stored.agreementNumber  || autoAgrNum,
        date:             new Date().toLocaleDateString('sv-SE'),
        vehicle:            stored.vehicle            || '',
        vin:                stored.vin                || '',
        registrationNumber: stored.registrationNumber || '',
        accessories:        stored.accessories        || '',
        tradeIn:          stored.tradeIn          || '',
        tradeInCredit:    stored.tradeInCredit    ?? 0,
        totalPrice:       stored.totalPrice       ?? 0,
        vatAmount:        stored.vatAmount        ?? (stored.totalPrice ? Math.round(stored.totalPrice * 0.2) : 0),
        financingMonths:  stored.financingMonths  ?? 0,
        financingMonthly: stored.financingMonthly ?? 0,
        financingApr:     stored.financingApr     ?? 0,
        personnummer:     stored.personnummer      || '',
      });
    } catch { /* ignore */ }

    // Fetch live buyer info from Supabase, then ensure paid invoice exists
    const leadId       = Number(id);
    const dealershipId = getDealershipId();
    if (!Number.isNaN(leadId) && dealershipId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getSupabaseBrowser() as any)
        .from('leads')
        .select('name, bike, value, customer_id, address, city')
        .eq('id', leadId)
        .eq('dealership_id', dealershipId)
        .maybeSingle()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(async ({ data: lead }: any) => {
          if (!lead) return;
          let name = (lead.name as string) ?? '';

          // Prefer canonical name from customers table if already converted
          if (lead.customer_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: cust } = await (getSupabaseBrowser() as any)
              .from('customers')
              .select('first_name, last_name, address, city')
              .eq('id', lead.customer_id)
              .eq('dealership_id', dealershipId)
              .maybeSingle();
            if (cust) {
              name = `${cust.first_name} ${cust.last_name}`.trim();
              const addr = [cust.address, cust.city].filter(Boolean).join(', ');
              if (addr) setBuyerAddress(addr);
            }
          } else {
            const addr = [lead.address, lead.city].filter(Boolean).join(', ');
            if (addr) setBuyerAddress(addr);
          }

          setBuyerName(name);
          setBuyerBike((lead.bike as string) ?? '');
          const val = parseFloat(lead.value ?? '0');
          setBuyerValue(val > 0 ? `${val.toLocaleString('sv-SE')} kr` : '');

          // ── Ensure a paid invoice exists (idempotent — route deduplicates) ──
          try {
            let pmName = '—';
            try {
              const pmRaw = sessionStorage.getItem('selectedPaymentMethod');
              if (pmRaw) pmName = (JSON.parse(pmRaw) as { name: string }).name ?? '—';
            } catch { /* ignore */ }

            let agreementRef = '';
            let totalAmount  = val;
            try {
              const agr = JSON.parse(localStorage.getItem(`agreement_${id}`) ?? '{}');
              if (agr.agreementNumber) agreementRef = agr.agreementNumber as string;
              if (typeof agr.totalPrice === 'number' && agr.totalPrice > 0) {
                totalAmount = agr.totalPrice;
              }
            } catch { /* ignore */ }

            const res  = await fetch('/api/payment/record', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId:        String(leadId),
                dealershipId,
                status:        'paid',
                paymentMethod: pmName,
                vehicle:       (lead.bike as string) ?? '',
                customerName:  name,
                agreementRef,
                totalAmount,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (json.invoiceId) {
              setInvoiceId(json.invoiceId as string);
              setInvoiceTotal(totalAmount);
            }
            emit({ type: 'data:refresh' });

            // ── Background: sync to Fortnox ──
            syncToFortnox({
              dealershipId,
              buyerName:       name,
              personnummer:    storedAgr.personnummer,
              agreementNumber: agreementRef,
              vehicle:         (lead.bike as string) ?? '',
              totalAmount,
              vatAmount:       Math.round(totalAmount * 0.2),
            }).catch((err) => console.warn('[complete] Fortnox sync skipped:', err));

            // ── Background: Transportstyrelsen ownership transfer ──
            const regNr = (JSON.parse(localStorage.getItem(`agreement_${id}`) ?? '{}') as { registrationNumber?: string }).registrationNumber ?? '';
            if (regNr && storedAgr.personnummer) {
              const sellerPnr = (() => { try { return (JSON.parse(localStorage.getItem('user') ?? '{}') as { personalNumber?: string }).personalNumber ?? ''; } catch { return ''; } })();
              syncToTransportstyrelsen({
                dealershipId,
                registrationNumber: regNr,
                sellerPersonNumber: sellerPnr,
                buyerPersonNumber:  storedAgr.personnummer,
                purchaseDate:       new Date().toISOString().slice(0, 10),
                purchasePrice:      totalAmount,
              }).then((caseId) => { if (caseId) setTransferCaseId(caseId); })
                .catch((err) => console.warn('[complete] Transportstyrelsen skipped:', err));
            }

            // ── Background: remove Blocket listing ──
            syncToBlocket({
              dealershipId,
              vehicleName: (lead.bike as string) ?? '',
              vin:         (JSON.parse(localStorage.getItem(`agreement_${id}`) ?? '{}') as { vin?: string }).vin ?? '',
            }).then((deleted) => { if (deleted) setBlocketDeleted(true); })
              .catch((err) => console.warn('[complete] Blocket delete skipped:', err));
          } catch (err) {
            console.error('[complete] ensure invoice:', err);
          }
        });
    }

    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  // Close lead + create customer once page is ready (runs once)
  useEffect(() => {
    if (!ready) return;
    const leadId = Number(id);
    if (Number.isNaN(leadId)) return;

    convertLeadToCustomer(leadId).then(({ customerId, created }) => {
      emit({ type: 'lead:updated', payload: { id: String(leadId), status: 'closed' } });

      if (created && customerId) {
        emit({ type: 'customer:created', payload: { id: customerId, name: '' } });
        toast.success('Lead converted to customer and saved in the customer database.');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Cascade animation — starts once ready
  useEffect(() => {
    if (!ready) return;
    const actions = buildCascadeActions(paymentMethod, invoiceId, invoiceTotal, salesperson, transferCaseId, blocketDeleted);
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

  // ── PDF generation (same structure as signed/page.tsx) ──
  const fmt = (n: number) => n.toLocaleString('sv-SE');
  const hasFinancing = storedAgr.financingMonths > 0;

  const totalStr = storedAgr.totalPrice > 0
    ? `${fmt(storedAgr.totalPrice)} kr (inkl. moms ${fmt(storedAgr.vatAmount)} kr)`
    : (buyerValue || '—');
  const financingStr = hasFinancing
    ? `${storedAgr.financingMonths} mån × ${fmt(storedAgr.financingMonthly)} kr/mån vid ${storedAgr.financingApr} % eff. årsränta`
    : '—';
  const vehicleStr = [storedAgr.vehicle || buyerBike, storedAgr.vin ? `VIN: ${storedAgr.vin}` : ''].filter(Boolean).join(', ') || '—';
  const tradeInStr = storedAgr.tradeIn
    ? `${storedAgr.tradeIn}${storedAgr.tradeInCredit > 0 ? ` — Inbytesvärde: ${fmt(storedAgr.tradeInCredit)} kr` : ''}`
    : '—';
  const pdfFilename = `Purchase-Agreement-${storedAgr.agreementNumber || 'AGR'}-SIGNED.pdf`;

  const buildPDF = (): jsPDF => {
    const doc     = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginL = 20;
    const marginR = 190;
    const lineH   = 7;
    let y = 20;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 107, 44);
    doc.text(sellerName || 'AVA MC', marginL, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`${sellerName}  •  Org.nr ${sellerOrgNr}`, marginR, y, { align: 'right' });

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text('✓ Fully Signed', marginR, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(marginL, y, marginR, y);
    y += 10;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('KÖPEAVTAL', 105, y, { align: 'center' });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`${storedAgr.agreementNumber}  •  Datum: ${storedAgr.date}`, 105, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.line(marginL, y, marginR, y);
    y += 8;

    // Fields
    const pdfFields: Array<{ label: string; value: string }> = [
      { label: 'SÄLJARE',   value: [sellerName, sellerAddress].filter(Boolean).join(', ') || '—' },
      { label: 'KÖPARE',    value: [buyerName, buyerAddress].filter(Boolean).join(', ') || '—' },
      { label: 'FORDON',    value: vehicleStr },
      ...(storedAgr.accessories ? [{ label: 'TILLBEHÖR',   value: storedAgr.accessories }] : []),
      ...(storedAgr.tradeIn     ? [{ label: 'INBYTE',      value: tradeInStr }] : []),
      { label: 'TOTALPRIS', value: totalStr },
      ...(hasFinancing          ? [{ label: 'FINANSIERING', value: financingStr }] : []),
      { label: 'GARANTI',   value: '3 år fabriksgaranti + 1 år återförsäljargaranti' },
      { label: 'ÅNGERRÄTT', value: '14 dagar per Distansavtalslagen (2005:59)' },
      { label: 'LEVERANS',  value: sellerAddress || '—' },
    ];

    for (const row of pdfFields) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(row.label + ':', marginL, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
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
      doc.setTextColor(100, 116, 139);
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

  const handleDownloadPDF = () => {
    const doc = buildPDF();
    doc.save(pdfFilename);
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const cascadeActions = buildCascadeActions(paymentMethod, invoiceId, invoiceTotal, salesperson, transferCaseId, blocketDeleted);
  const dealPrice = storedAgr.totalPrice > 0 ? storedAgr.totalPrice : 0;
  const provisionKr = dealPrice > 0 ? Math.round(dealPrice * 0.022) : (invoiceTotal > 0 ? Math.round(invoiceTotal * 0.022) : 0);

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Progress stepper */}
        <div className="px-5 md:px-8 pb-4 bg-white border-b border-slate-100">
          <div className="flex items-center pt-4">
            {[t('progress.step0'), t('progress.step1'), t('progress.step2'), t('progress.step3'), t('progress.step4')].map((step, i) => {
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

        {/* Main content */}
        <div className="flex-1 px-5 md:px-8 py-8">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* ── Hero deal-closed banner ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600 via-green-600 to-emerald-700 px-8 py-8 shadow-lg animate-fade-up">
              {/* Decorative circles */}
              <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute right-8 top-12 w-28 h-28 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute -right-4 bottom-0 w-20 h-20 rounded-full bg-white/5" />

              <div className="relative flex items-center gap-6">
                {/* Checkmark */}
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold tracking-widest text-green-200 uppercase">Avtal signerat</span>
                    {storedAgr.agreementNumber && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-green-400" />
                        <span className="text-xs text-green-200 font-mono">{storedAgr.agreementNumber}</span>
                      </>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                    {t('complete.successTitle')}
                  </h1>
                  <p className="mt-1.5 text-sm text-green-100">
                    {[buyerName, storedAgr.vehicle || buyerBike].filter(Boolean).join(' · ')}
                    {paymentMethod && (
                      <span className="ml-2 font-medium">{paymentMethod.icon} {paymentMethod.name}</span>
                    )}
                  </p>
                </div>

                {/* Deal price */}
                {dealPrice > 0 && (
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-4xl font-extrabold text-white tabular-nums">
                      {fmt(dealPrice)}
                    </p>
                    <p className="text-sm text-green-200 mt-0.5">kr inkl. moms</p>
                  </div>
                )}
              </div>

              {/* Signature pills */}
              {signatures && (
                <div className="relative mt-5 flex flex-wrap gap-2">
                  {[
                    { label: 'Köpare', rec: signatures.customer },
                    { label: 'Säljare', rec: signatures.dealer },
                  ].map(({ label, rec }) => (
                    <div key={label} className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3.5 py-1.5">
                      <svg className="w-3 h-3 text-green-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-green-100 font-medium">{label}:</span>
                      <span className="text-xs text-white font-semibold">{rec.name}</span>
                      <span className="text-xs text-green-300">{rec.signedAt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Two-column grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-up">

              {/* Left column: KPI stats + actions */}
              <div className="lg:col-span-2 flex flex-col gap-4">

                {/* KPI stats */}
                <div className="grid grid-cols-2 gap-3">

                  {/* Deal value */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Affärsvärde</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
                      {dealPrice > 0 ? fmt(dealPrice) : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {storedAgr.vatAmount > 0 ? `varav moms ${fmt(storedAgr.vatAmount)} kr` : 'kr inkl. moms'}
                    </p>
                  </div>

                  {/* Payment */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Betalning</p>
                    <p className="text-lg font-extrabold text-slate-900 leading-tight">
                      {paymentMethod
                        ? paymentMethod.name
                        : (hasFinancing ? `${storedAgr.financingMonths} mån` : 'Kontant')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {hasFinancing
                        ? `${fmt(storedAgr.financingMonthly)} kr/mån · ${storedAgr.financingApr}%`
                        : (paymentMethod?.icon ?? '—')}
                    </p>
                  </div>

                  {/* Provision — full width */}
                  <div className="col-span-2 bg-white rounded-2xl border border-slate-100 p-5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Provision</p>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-2xl font-extrabold text-[#FF6B2C] tabular-nums leading-none">
                          {provisionKr > 0 ? `${fmt(provisionKr)} kr` : '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1.5">
                          {salesperson || '—'} · 2,2% av affärsvärdet
                        </p>
                      </div>
                      {invoiceId && (
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Faktura</p>
                          <p className="text-sm font-bold text-slate-700 font-mono mt-0.5">{invoiceId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Nästa steg</p>

                  {/* 2-column grid — compact, auto-sized buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={`/sales/leads/${id}/delivery`}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-all shadow-sm hover:shadow-md"
                    >
                      {t('complete.viewDelivery')}
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>

                    <Link
                      href="/invoices"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1d4ed8] hover:bg-[#1a44c4] text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                    >
                      {t('complete.viewInvoice')}
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>

                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-green-300 bg-green-50 hover:bg-green-100 text-green-800 text-sm font-semibold transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {t('complete.download')}
                    </button>

                    <Link
                      href="/sales/leads"
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      {t('complete.back')}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right column: automation cascade */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden h-full flex flex-col">

                  {/* Cascade header */}
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FF6B2C]/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#FF6B2C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{t('complete.cascadeHeader')}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {completedCount} / {cascadeActions.length} åtgärder slutförda
                        </p>
                      </div>
                    </div>
                    {allDone && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Klart
                      </span>
                    )}
                  </div>

                  {/* Thin progress bar */}
                  <div className="h-0.5 bg-slate-100">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                      style={{ width: `${(completedCount / cascadeActions.length) * 100}%` }}
                    />
                  </div>

                  {/* Actions list */}
                  <div className="flex-1 p-4 space-y-0.5">
                    {cascadeActions.map((action, i) => {
                      const done    = i < completedCount;
                      const timeSec = (action.delay / 1000).toFixed(1);
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                            done ? 'bg-slate-50' : 'opacity-25'
                          }`}
                        >
                          {/* Status dot */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                            done ? 'bg-green-100' : 'bg-slate-100'
                          }`}>
                            {done ? (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400">{i + 1}</span>
                            )}
                          </div>

                          <span className={`flex-1 text-sm transition-colors duration-300 ${done ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                            {action.label}
                          </span>

                          {done && (
                            <span className="text-[11px] text-emerald-500 font-semibold shrink-0 tabular-nums">{timeSec}s</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Completion footer */}
                  {allDone && (
                    <div className="mx-4 mb-4 px-4 py-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 text-center">
                      <p className="text-sm font-bold text-green-700">{t('complete.allDone')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Background Fortnox sync ──────────────────────────────────────────────────
// Called fire-and-forget from the init effect.
// Step 1: upsert the customer in Fortnox, get CustomerNumber.
// Step 2: create a Fortnox invoice referencing that customer.
// Fails silently if the dealership hasn't configured a Fortnox access token.
async function syncToFortnox(opts: {
  dealershipId:    string;
  buyerName:       string;
  personnummer:    string;
  agreementNumber: string;
  vehicle:         string;
  totalAmount:     number;
  vatAmount:       number;
}) {
  const { dealershipId, buyerName, personnummer, agreementNumber, vehicle, totalAmount, vatAmount } = opts;
  if (!buyerName || totalAmount <= 0) return;

  // Step 1: customer
  const custRes = await fetch('/api/fortnox/customer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealerId:       dealershipId,
      name:           buyerName,
      personalNumber: personnummer || undefined,
    }),
  });
  if (!custRes.ok) {
    const err = await custRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Fortnox customer sync failed');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custJson = await custRes.json() as { customer?: any };
  const customerNumber = custJson.customer?.CustomerNumber as string | undefined;
  if (!customerNumber) return;

  // Step 2: invoice
  await fetch('/api/fortnox/invoice', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealerId:        dealershipId,
      customerNumber,
      agreementNumber: agreementNumber || `AGR-${new Date().getFullYear()}`,
      vehicle:         vehicle || 'Motorcykel',
      totalAmount,
      vatAmount,
    }),
  });
}

// ── Background Transportstyrelsen ownership transfer ─────────────────────────
// Returns the caseId on success, null if API key not configured.
async function syncToTransportstyrelsen(opts: {
  dealershipId:       string;
  registrationNumber: string;
  sellerPersonNumber: string;
  buyerPersonNumber:  string;
  purchaseDate:       string;
  purchasePrice:      number;
}): Promise<string | null> {
  const res = await fetch('/api/transportstyrelsen/register', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealerId:           opts.dealershipId,
      registrationNumber: opts.registrationNumber,
      sellerPersonNumber: opts.sellerPersonNumber,
      buyerPersonNumber:  opts.buyerPersonNumber,
      purchaseDate:       opts.purchaseDate,
      purchasePrice:      opts.purchasePrice,
      odometerReading:    0,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Transportstyrelsen request failed');
  }
  const json = await res.json() as { transfer?: { caseId?: string } };
  return json.transfer?.caseId ?? null;
}

// ── Background Blocket ad removal ────────────────────────────────────────────
// Fetches all active listings, finds the one matching the sold vehicle (by VIN
// first, then vehicle name), and deletes it.
// Returns true if an ad was successfully deleted.
async function syncToBlocket(opts: {
  dealershipId: string;
  vehicleName:  string;
  vin:          string;
}): Promise<boolean> {
  const { dealershipId, vehicleName, vin } = opts;

  // 1. List active ads
  const listRes = await fetch(`/api/blocket/listings?dealerId=${encodeURIComponent(dealershipId)}`);
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Blocket listings fetch failed');
  }
  const listJson = await listRes.json() as { ads?: Array<{ id: string; subject?: string; parameters?: { vin?: string } }> };
  const ads = listJson.ads ?? [];
  if (ads.length === 0) return false;

  // 2. Find matching ad — VIN is most reliable, fall back to subject text match
  const vinUpper = vin.toUpperCase();
  let match = ads.find(a => a.parameters?.vin?.toUpperCase() === vinUpper && vinUpper !== '');
  if (!match && vehicleName) {
    const nameLower = vehicleName.toLowerCase();
    match = ads.find(a => (a.subject ?? '').toLowerCase().includes(nameLower));
  }
  if (!match) return false;

  // 3. Delete the matched ad
  const delRes = await fetch(`/api/blocket/ad/${encodeURIComponent(match.id)}?dealerId=${encodeURIComponent(dealershipId)}`, {
    method: 'DELETE',
  });
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Blocket ad delete failed');
  }
  return true;
}
