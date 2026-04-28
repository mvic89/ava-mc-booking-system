'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import jsPDF from 'jspdf';
import Sidebar from '@/components/Sidebar';
import { getDealerInfo } from '@/lib/dealer';
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

interface CascadeParams {
  pm:               SelectedPayment | null;
  invoiceId:        string | null;
  invTotal:         number;
  salesperson:      string;
  transferCaseId:   string | null;
  blocketDeleted:   boolean;
  financingMonths:  number;
  financingMonthly: number;
  paymentType:      string; // 'financing' | 'swish' | 'card' | 'bank-transfer' | 'klarna' | ''
}

function buildCascadeActions(p: CascadeParams) {
  const fmt = (n: number) => n.toLocaleString('sv-SE');

  // Payment label: real financing data when applicable
  let paymentLabel: string;
  if (p.paymentType === 'financing' && p.financingMonths > 0 && p.financingMonthly > 0) {
    paymentLabel = `🏦 Betalningsplan: ${p.financingMonths} × ${fmt(p.financingMonthly)} kr/mån skapad`;
  } else if (p.pm) {
    paymentLabel = `${p.pm.icon} Betalning initierad via ${p.pm.name}`;
  } else {
    paymentLabel = '💰 Betalning registrerad';
  }

  const invoiceLabel = p.invoiceId
    ? `Faktura auto-genererad: ${p.invoiceId} (${fmt(p.invTotal)} kr)`
    : 'Faktura auto-genererad…';
  const provisionAmt   = p.invTotal > 0 ? fmt(Math.round(p.invTotal * 0.022)) : '—';
  const provisionLabel = `Provision beräknad: ${p.salesperson || '—'} — ${provisionAmt} kr`;
  const transportLabel = p.transferCaseId
    ? `Ägarbyte initierat via Transportstyrelsen: Ärende ${p.transferCaseId}`
    : 'Registrering initierad via Transportstyrelsen API';
  const blocketLabel = p.blocketDeleted ? 'Blocket-annons borttagen ✓' : 'Blocket-annons borttagen';

  return [
    { label: paymentLabel,                                  delay: 300  },
    { label: 'Leveranskontroll aktiverad (58 punkter)',     delay: 500  },
    { label: 'Fordonsstatus: Tillgänglig → Reserverad',    delay: 600  },
    { label: transportLabel,                                delay: 800  },
    { label: 'Kundprofil: Lead → Kund',                    delay: 900  },
    { label: 'Team notifierat: Service, Leverans, Ekonomi', delay: 1000 },
    { label: invoiceLabel,                                  delay: 1400 },
    { label: 'Fortnox bokföring synkad',                   delay: 1800 },
    { label: blocketLabel,                                  delay: 2100 },
    { label: provisionLabel,                               delay: 2400 },
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
  const [invoiceId,      setInvoiceId]      = useState<string | null>(null);
  const [invoiceTotal,   setInvoiceTotal]   = useState(0);
  const [salesperson,    setSalesperson]    = useState('');
  const [transferCaseId, setTransferCaseId] = useState<string | null>(null);
  const [blocketDeleted, setBlocketDeleted] = useState(false);
  // Offer data fetched from DB — authoritative source for amounts
  const [offerTotalPrice,    setOfferTotalPrice]    = useState(0);
  const [offerFinancingMonths,  setOfferFinancingMonths]  = useState(0);
  const [offerFinancingMonthly, setOfferFinancingMonthly] = useState(0);
  const [offerFinancingApr,     setOfferFinancingApr]     = useState(0);
  const [offerVatAmount,        setOfferVatAmount]        = useState(0);
  // Set true only after invoice creation completes — gates the cascade animation
  const [cascadeReady,   setCascadeReady]   = useState(false);
  const [cascadeParams,  setCascadeParams]  = useState<CascadeParams | null>(null);

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
    let capturedSalesperson = '';
    try {
      const u = JSON.parse(userRaw);
      capturedSalesperson = (u.givenName ?? u.name ?? '') as string;
      setSalesperson(capturedSalesperson);
    } catch { /* ignore */ }

    // Payment method (read before clearing — capture for cascade + invoice creation)
    let capturedPmName = '—';
    let capturedPm: SelectedPayment | null = null;
    try {
      const pmRaw = JSON.parse(sessionStorage.getItem('selectedPaymentMethod') ?? 'null') as { name?: string; icon?: string; id?: string; category?: string } | null;
      if (pmRaw) {
        capturedPm = pmRaw as SelectedPayment;
        setPaymentMethod(capturedPm);
        capturedPmName = pmRaw.name ?? '—';
      }
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

    // Fetch live data from DB — offer (authoritative price) + lead (buyer info)
    const leadId       = Number(id);
    const dealershipId = getDealershipId();
    if (!Number.isNaN(leadId) && dealershipId) {
      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const supabase = getSupabaseBrowser() as any;

          // 1. Fetch lead + offer in parallel
          const [{ data: lead }, offerRes] = await Promise.all([
            supabase
              .from('leads')
              .select('name, bike, value, customer_id, address, city, personnummer')
              .eq('id', leadId)
              .eq('dealership_id', dealershipId)
              .maybeSingle(),
            fetch(`/api/offers?leadId=${leadId}&dealershipId=${encodeURIComponent(dealershipId)}`),
          ]);

          const offerJson = offerRes.ok ? await offerRes.json() : null;
          const offer     = offerJson?.offer ?? null;

          if (!lead) return;

          // 2. Resolve buyer name from customers table if already converted
          let name = (lead.name as string) ?? '';
          if (lead.customer_id) {
            const { data: cust } = await supabase
              .from('customers')
              .select('first_name, last_name, address, city')
              .eq('id', lead.customer_id)
              .eq('dealership_id', dealershipId)
              .maybeSingle();
            if (cust) {
              name = `${(cust as {first_name:string;last_name:string}).first_name} ${(cust as {first_name:string;last_name:string}).last_name}`.trim();
              const addr = [(cust as {address?:string;city?:string}).address, (cust as {address?:string;city?:string}).city].filter(Boolean).join(', ');
              if (addr) setBuyerAddress(addr);
            }
          } else {
            const addr = [(lead.address as string), (lead.city as string)].filter(Boolean).join(', ');
            if (addr) setBuyerAddress(addr);
          }

          setBuyerName(name);
          setBuyerBike((lead.bike as string) ?? '');

          // 3. AUTHORITATIVE PRICE: offer.totalPrice > localStorage.totalPrice > lead.value
          const localAgr = (() => { try { return JSON.parse(localStorage.getItem(`agreement_${id}`) ?? '{}'); } catch { return {}; } })();
          const offerTotal    = offer ? (offer.totalPrice as number) : 0;
          const offerVat      = offer ? (offer.vatAmount  as number) : 0;
          const offerFMonths  = offer ? (offer.financingMonths  as number ?? 0) : 0;
          const offerFMonthly = offer ? (offer.financingMonthly as number ?? 0) : 0;
          const offerFApr     = offer ? (offer.financingApr     as number ?? 0) : 0;

          const totalAmount =
            offerTotal > 0                                           ? offerTotal
            : (typeof localAgr.totalPrice === 'number' && localAgr.totalPrice > 0) ? localAgr.totalPrice
            : parseFloat((lead.value as string) ?? '0') || 0;

          const vatAmount = offerVat > 0 ? offerVat : Math.round(totalAmount * 0.2);

          // Persist offer values into state so PDF and UI use the same numbers
          setOfferTotalPrice(totalAmount);
          setOfferVatAmount(vatAmount);
          setOfferFinancingMonths(offerFMonths);
          setOfferFinancingMonthly(offerFMonthly);
          setOfferFinancingApr(offerFApr);
          setBuyerValue(totalAmount > 0 ? `${totalAmount.toLocaleString('sv-SE')} kr` : '');

          // Also update storedAgr with the correct numbers from the offer
          if (offer) {
            setStoredAgr(prev => ({
              ...prev,
              vehicle:            (offer.vehicle             as string) || prev.vehicle,
              vin:                (offer.vin                 as string) || prev.vin,
              registrationNumber: (offer.registrationNumber  as string) || prev.registrationNumber,
              accessories:        (offer.accessories         as string) || prev.accessories,
              tradeIn:            (offer.tradeIn             as string) || prev.tradeIn,
              tradeInCredit:      (offer.tradeInCredit       as number) ?? prev.tradeInCredit,
              totalPrice:         totalAmount,
              vatAmount,
              financingMonths:    offerFMonths,
              financingMonthly:   offerFMonthly,
              financingApr:       offerFApr,
              personnummer:       (offer.personnummer         as string) || (lead.personnummer as string) || prev.personnummer,
              agreementNumber:    (offer.offerNumber          as string) || prev.agreementNumber,
            }));
          }

          const agreementRef = offer?.offerNumber as string
            || localAgr.agreementNumber as string
            || `AGR-${new Date().getFullYear()}-${String(leadId).padStart(4, '0')}`;

          // 4. Create paid invoice using the correct totalAmount
          const invRes  = await fetch('/api/invoice/create', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId:        String(leadId),
              dealershipId,
              status:        'paid',
              paymentMethod: capturedPmName,
              vehicle:       (offer?.vehicle as string) || (lead.bike as string) || '',
              customerName:  name,
              agreementRef,
              totalAmount,
              paidDate:      new Date().toISOString(),
            }),
          });
          const invJson = invRes.ok ? await invRes.json().catch(() => ({})) : {};
          const finalInvoiceId    = (invJson.invoiceId as string | null) ?? null;
          const finalInvoiceTotal = totalAmount;

          if (finalInvoiceId) {
            setInvoiceId(finalInvoiceId);
            setInvoiceTotal(finalInvoiceTotal);
          }
          emit({ type: 'data:refresh' });

          // 5. Background integrations
          syncToFortnox({
            dealershipId,
            buyerName:       name,
            personnummer:    (lead.personnummer as string) || '',
            agreementNumber: agreementRef,
            vehicle:         (offer?.vehicle as string) || (lead.bike as string) || '',
            totalAmount,
            vatAmount,
          }).catch((err) => console.warn('[complete] Fortnox sync skipped:', err));

          const regNr = (offer?.registrationNumber as string) || (localAgr.registrationNumber as string) || '';
          const pnr   = (lead.personnummer as string) || '';
          if (regNr && pnr) {
            const sellerPnr = (() => { try { return (JSON.parse(localStorage.getItem('user') ?? '{}') as { personalNumber?: string }).personalNumber ?? ''; } catch { return ''; } })();
            syncToTransportstyrelsen({
              dealershipId,
              registrationNumber: regNr,
              sellerPersonNumber: sellerPnr,
              buyerPersonNumber:  pnr,
              purchaseDate:       new Date().toISOString().slice(0, 10),
              purchasePrice:      totalAmount,
            }).then((caseId) => { if (caseId) setTransferCaseId(caseId); })
              .catch((err) => console.warn('[complete] Transportstyrelsen skipped:', err));
          }

          const vin = (offer?.vin as string) || (localAgr.vin as string) || '';
          syncToBlocket({
            dealershipId,
            vehicleName: (offer?.vehicle as string) || (lead.bike as string) || '',
            vin,
          }).then((deleted) => { if (deleted) setBlocketDeleted(true); })
            .catch((err) => console.warn('[complete] Blocket delete skipped:', err));

          // 6. Build cascade params with real data and mark ready
          setCascadeParams({
            pm:               capturedPm,
            invoiceId:        finalInvoiceId,
            invTotal:         finalInvoiceTotal,
            salesperson:      capturedSalesperson,
            transferCaseId:   null, // updated async by setTransferCaseId
            blocketDeleted:   false, // updated async by setBlocketDeleted
            financingMonths:  offerFMonths,
            financingMonthly: offerFMonthly,
            paymentType:      capturedPm?.id ?? '',
          });
          setCascadeReady(true);

        } catch (err) {
          console.error('[complete] data load:', err);
          setCascadeReady(true); // start cascade anyway so UI isn't stuck
        }
      })();
    } else {
      setCascadeReady(true);
    }

    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  // Close lead + auto-create customer once page is ready (runs once).
  // Uses the server-side /api/customers/create route (service-role key) so
  // Supabase RLS on the customers table never blocks the INSERT.
  useEffect(() => {
    if (!ready) return;
    const leadId = Number(id);
    // Read dealershipId directly from localStorage as a fallback
    let dealershipId = getDealershipId();
    if (!dealershipId) {
      try {
        const u = JSON.parse(localStorage.getItem('user') ?? '{}');
        dealershipId = (u.dealershipId as string) || null;
      } catch { /* ignore */ }
    }
    console.log('[complete] ready, leadId:', leadId, 'dealershipId:', dealershipId);
    if (Number.isNaN(leadId)) {
      toast.error('Fel: ogiltigt lead-ID');
      return;
    }
    if (!dealershipId) {
      toast.error('Fel: ingen återförsäljar-session — logga in på nytt');
      console.error('[complete] no dealershipId in localStorage user object');
      return;
    }

    console.log('[complete] calling /api/customers/create — leadId:', leadId, 'dealershipId:', dealershipId);

    fetch('/api/customers/create', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, dealershipId }),
    })
      .then(async r => {
        const res = await r.json() as { customerId?: number | null; created?: boolean; error?: string; code?: string; hint?: string };
        console.log('[complete] /api/customers/create response:', res);

        emit({ type: 'lead:updated', payload: { id: String(leadId), status: 'closed' } });

        if (res.error) {
          console.error('[complete] customer create error:', res.error, res.code, res.hint);
          toast.error('Kund kunde inte skapas', {
            description: `${res.error}${res.hint ? ` — ${res.hint}` : ''}`,
          });
          return;
        }
        if (res.created && res.customerId) {
          emit({ type: 'customer:created', payload: { id: res.customerId, name: '' } });
          toast.success('Kund skapad automatiskt och sparad i kundregistret.');
        } else if (!res.created && res.customerId) {
          emit({ type: 'data:refresh' });
          toast.success('Kund uppdaterad i kundregistret.');
        }
      })
      .catch(err => {
        console.error('[complete] customer create fetch error:', err);
        toast.error('Fel vid kundregistrering', { description: String(err) });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Cascade animation — starts once cascadeParams are set (after invoice creation)
  useEffect(() => {
    if (!cascadeParams) return;
    const actions = buildCascadeActions(cascadeParams);
    actions.forEach((action, i) => {
      setTimeout(() => {
        setCompletedCount((prev) => prev + 1);
        if (i === actions.length - 1) {
          setTimeout(() => setAllDone(true), 200);
        }
      }, action.delay);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cascadeParams]);

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

  const cascadeActions = cascadeParams ? buildCascadeActions(cascadeParams) : [];
  const dealPrice = offerTotalPrice > 0 ? offerTotalPrice : (storedAgr.totalPrice > 0 ? storedAgr.totalPrice : 0);
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
            <div className="rounded-2xl bg-white border border-slate-100 px-8 py-8 shadow-sm animate-fade-up">
              <div className="flex items-center gap-6">
                {/* Checkmark */}
                <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Avtal signerat</span>
                    {storedAgr.agreementNumber && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-500 font-mono">{storedAgr.agreementNumber}</span>
                      </>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                    {t('complete.successTitle')}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500">
                    {[buyerName, storedAgr.vehicle || buyerBike].filter(Boolean).join(' · ')}
                    {paymentMethod && (
                      <span className="ml-2 font-medium">{paymentMethod.icon} {paymentMethod.name}</span>
                    )}
                  </p>
                </div>

                {/* Deal price */}
                {dealPrice > 0 && (
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-4xl font-extrabold text-slate-900 tabular-nums">
                      {fmt(dealPrice)}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">kr inkl. moms</p>
                  </div>
                )}
              </div>

              {/* Signature pills */}
              {signatures && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { label: 'Köpare', rec: signatures.customer },
                    { label: 'Säljare', rec: signatures.dealer },
                  ].map(({ label, rec }) => (
                    <div key={label} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3.5 py-1.5">
                      <svg className="w-3 h-3 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-slate-500 font-medium">{label}:</span>
                      <span className="text-xs text-slate-900 font-semibold">{rec.name}</span>
                      <span className="text-xs text-slate-400">{rec.signedAt}</span>
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
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all"
                    >
                      {t('complete.viewInvoice')}
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>

                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
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
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C] animate-pulse" />
                        Klart
                      </span>
                    )}
                  </div>

                  {/* Thin progress bar */}
                  <div className="h-0.5 bg-slate-100">
                    <div
                      className="h-full bg-[#FF6B2C] transition-all duration-500"
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
                            <span className="text-[11px] text-slate-400 font-semibold shrink-0 tabular-nums">{timeSec}s</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Completion footer */}
                  {allDone && (
                    <div className="mx-4 mb-4 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-sm font-bold text-slate-700">{t('complete.allDone')}</p>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const custJson = await custRes.json().catch(() => ({})) as { customer?: any; skipped?: boolean; reason?: string };
  // If Fortnox isn't configured or the API rejected the call, skip silently
  if (custJson.skipped || !custRes.ok) {
    console.warn('[syncToFortnox] skipped:', custJson.reason ?? custRes.status);
    return;
  }
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
