'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import BankIDModal from '@/components/bankIdModel';
import { getDealershipId, getDealershipProfile } from '@/lib/tenant';
import { emit } from '@/lib/realtime';
import { upsertAgreement } from '@/lib/agreements';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SigProof {
  name:           string;
  personalNumber: string;
  signedAt:       string;
  verified:       boolean;
}

type PaymentType      = 'cash' | 'financing';
type VehicleCondition = 'new'  | 'used';

interface AgrForm {
  // Meta
  offerNumber:        string;
  agreementNumber:    string;
  // Customer
  customerName:       string;
  personnummer:       string;
  customerAddress:    string;
  customerPhone:      string;
  customerEmail:      string;
  // Vehicle
  vehicle:            string;
  vehicleColor:       string;
  vehicleCondition:   VehicleCondition;
  vin:                string;
  registrationNumber: string;
  // Pricing
  listPrice:          number;
  discount:           number;
  accessories:        string;
  accessoriesCost:    number;
  tradeIn:            string;
  tradeInCredit:      number;
  totalPrice:         number;
  vatAmount:          number;
  // Payment
  paymentType:        PaymentType;
  downPayment:        number;
  financingMonths:    number;
  financingMonthly:   number;
  financingApr:       number;
  nominalRate:        number;
  // Delivery
  deliveryWeeks:      number;
  validUntil:         string;
  notes:              string;
  // Signatures
  sellerSignature:    string;
  buyerSignature:     string;
}

const BLANK: AgrForm = {
  offerNumber: '', agreementNumber: '',
  customerName: '', personnummer: '', customerAddress: '', customerPhone: '', customerEmail: '',
  vehicle: '', vehicleColor: '', vehicleCondition: 'new', vin: '', registrationNumber: '',
  listPrice: 0, discount: 0, accessories: '', accessoriesCost: 0,
  tradeIn: '', tradeInCredit: 0, totalPrice: 0, vatAmount: 0,
  paymentType: 'cash', downPayment: 0, financingMonths: 36,
  financingMonthly: 0, financingApr: 4.9, nominalRate: 3.9,
  deliveryWeeks: 4, validUntil: '', notes: '',
  sellerSignature: '', buyerSignature: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSig(s: string): SigProof | null {
  if (!s) return null;
  try { return JSON.parse(s) as SigProof; } catch { return null; }
}

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('sv-SE');
}

const inputCls     = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20';
const readonlyCls  = 'w-full text-sm border border-slate-100 rounded-lg px-3 py-2 text-slate-600 bg-slate-50';

// ─── Sub-components ───────────────────────────────────────────────────────────

function DocLine({ label, value, bold, indent, negative, highlight }: {
  label: string; value: string; bold?: boolean; indent?: boolean; negative?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between py-1.5 ${highlight ? 'border-t-2 border-slate-900 mt-1 pt-2' : 'border-b border-slate-100'}`}>
      <span className={`text-sm ${indent ? 'pl-4' : ''} ${bold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-mono tabular-nums ${bold ? 'font-bold text-slate-900' : negative ? 'text-red-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 pb-1 border-b border-slate-200">{title}</div>
      {children}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function TxtIn({ value, onChange, placeholder, readOnly }: { value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean }) {
  return (
    <input type="text" value={value} readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
      className={readOnly ? readonlyCls : inputCls} />
  );
}

function NumIn({ value, onChange, suffix, step = 1 }: { value: number; onChange: (v: number) => void; suffix?: string; step?: number }) {
  return (
    <div className="relative">
      <input type="number" value={value || ''} step={step}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className={`${inputCls} ${suffix ? 'pr-14' : ''}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

// ─── BankID Signature Block ───────────────────────────────────────────────────

function SigBlock({
  label, sigJson, signText, onSigned, party,
}: {
  label:    string;
  sigJson:  string;
  signText: string;
  onSigned: (proof: SigProof) => void;
  party:    'seller' | 'buyer';
}) {
  const [showModal, setShowModal] = useState(false);
  const proof = parseSig(sigJson);

  return (
    <div className={`rounded-xl border-2 p-4 transition-colors ${proof ? 'border-emerald-200 bg-emerald-50' : 'border-dashed border-slate-200 bg-white'}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{label}</p>
      {proof ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">✓</span>
            <span className="font-semibold text-emerald-800 text-sm">{proof.name}</span>
          </div>
          <p className="text-xs text-emerald-700 ml-8">{proof.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}</p>
          <p className="text-xs text-emerald-600 ml-8">
            Signerat {new Date(proof.signedAt).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          <div className="ml-8 mt-1 flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#235971] rounded-sm flex items-center justify-center">
              <span className="text-white text-[8px] font-bold leading-none">B</span>
            </div>
            <span className="text-[11px] font-semibold text-[#235971]">BankID verifierat</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {party === 'seller' ? 'Säljaren signerar med sitt BankID' : 'Köparen signerar med sitt BankID'}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#235971] text-white text-sm font-semibold hover:bg-[#1a4557] transition-colors w-full justify-center"
          >
            <div className="w-5 h-5 bg-white/20 rounded-sm flex items-center justify-center">
              <span className="text-white text-[10px] font-extrabold leading-none">B</span>
            </div>
            Signera med BankID
          </button>
        </div>
      )}
      {showModal && (
        <BankIDModal
          mode="sign"
          signText={signText}
          title={party === 'seller' ? 'Säljaren signerar köpeavtalet' : 'Köparen signerar köpeavtalet'}
          subtitle={party === 'seller'
            ? 'Öppna BankID-appen och signera.'
            : 'Be kunden öppna BankID-appen och scanna QR-koden.'}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onComplete={(data: any) => {
            setShowModal(false);
            if (data?.user) {
              onSigned({
                name:           data.user.name,
                personalNumber: data.user.personalNumber,
                signedAt:       new Date().toISOString(),
                verified:       true,
              });
            }
          }}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgreementPage() {
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();
  const leadId       = Number((params?.id as string) || '0');
  const paymentTab   = searchParams?.get('paymentTab') ?? 'financing';

  const [ready,     setReady]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [offerId,   setOfferId]   = useState<number | null>(null);
  const [form,      setForm]      = useState<AgrForm>(BLANK);
  const [isEditing, setIsEditing] = useState(false);
  const [draft,     setDraft]     = useState<AgrForm | null>(null);
  const [dealer,    setDealer]    = useState({ name: '', address: '', phone: '', email: '', orgNr: '' });

  // ── Load offer from Supabase ──────────────────────────────────────────────

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.replace('/auth/login'); return; }
    if (!leadId || Number.isNaN(leadId)) { setReady(true); return; }

    const dealershipId = getDealershipId();
    const profile      = getDealershipProfile();
    const parsed       = JSON.parse(raw);

    setDealer({
      name:    profile.name    || 'Återförsäljare',
      address: profile.address || '',
      phone:   profile.phone   || '',
      email:   profile.email   || '',
      orgNr:   (parsed.orgNr as string) || '',
    });

    (async () => {
      const res  = await fetch(`/api/offers?leadId=${leadId}&dealershipId=${dealershipId}`);
      const json = await res.json();
      const o    = json.offer;

      if (o) {
        setOfferId(o.id);
        const agrNum = `AGR-${new Date().getFullYear()}-${String(o.id).padStart(4, '0')}`;
        setForm({
          offerNumber:        o.offerNumber        ?? '',
          agreementNumber:    agrNum,
          customerName:       o.customerName        ?? '',
          personnummer:       o.personnummer         ?? '',
          customerAddress:    o.customerAddress     ?? '',
          customerPhone:      o.customerPhone       ?? '',
          customerEmail:      o.customerEmail       ?? '',
          vehicle:            o.vehicle             ?? '',
          vehicleColor:       o.vehicleColor        ?? '',
          vehicleCondition:   o.vehicleCondition    ?? 'new',
          vin:                o.vin                 ?? '',
          registrationNumber: o.registrationNumber  ?? '',
          listPrice:          o.listPrice           ?? 0,
          discount:           o.discount            ?? 0,
          accessories:        o.accessories         ?? '',
          accessoriesCost:    o.accessoriesCost     ?? 0,
          tradeIn:            o.tradeIn             ?? '',
          tradeInCredit:      o.tradeInCredit       ?? 0,
          totalPrice:         o.totalPrice          ?? 0,
          vatAmount:          o.vatAmount           ?? 0,
          paymentType:        o.paymentType         ?? 'cash',
          downPayment:        o.downPayment         ?? 0,
          financingMonths:    o.financingMonths     ?? 36,
          financingMonthly:   o.financingMonthly    ?? 0,
          financingApr:       o.financingApr        ?? 4.9,
          nominalRate:        o.nominalRate         ?? 3.9,
          deliveryWeeks:      o.deliveryWeeks       ?? 4,
          validUntil:         o.validUntil          ?? '',
          notes:              o.notes               ?? '',
          sellerSignature:    o.sellerSignature     ?? '',
          buyerSignature:     o.buyerSignature      ?? '',
        });
      }
      setReady(true);
    })();
  }, [leadId, router]);

  // ── Edit helpers ─────────────────────────────────────────────────────────

  const upd = useCallback(<K extends keyof AgrForm>(key: K, val: AgrForm[K]) => {
    setDraft(d => d ? { ...d, [key]: val } : d);
  }, []);

  async function save() {
    if (!draft || !offerId) return;
    const dealershipId = getDealershipId();
    setSaving(true);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, ...draft }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setForm(draft);
      setDraft(null);
      setIsEditing(false);
      toast.success('Köpeavtal uppdaterat');
    } catch (err) {
      toast.error(`Kunde inte spara: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  // ── BankID signing ────────────────────────────────────────────────────────

  function buildSignText(party: 'seller' | 'buyer') {
    const vehicle = form.vehicle   || 'fordonet';
    const price   = form.totalPrice
      ? `${form.totalPrice.toLocaleString('sv-SE')} kr inkl. moms`
      : 'överenskommet pris';
    const agrNum  = form.agreementNumber || 'köpeavtalet';
    if (party === 'seller') {
      return btoa(unescape(encodeURIComponent(
        `Jag bekräftar köpeavtal ${agrNum} avseende ${vehicle} till ett pris av ${price} på uppdrag av ${dealer.name}.`
      )));
    }
    return btoa(unescape(encodeURIComponent(
      `Jag accepterar och undertecknar köpeavtal ${agrNum}. Jag köper ${vehicle} för ${price}. Avtalet är juridiskt bindande.`
    )));
  }

  async function handleSigned(party: 'seller' | 'buyer', proof: SigProof) {
    const field      = party === 'seller' ? 'sellerSignature' : 'buyerSignature';
    const otherField = party === 'seller' ? 'buyerSignature'  : 'sellerSignature';
    const proofJson  = JSON.stringify(proof);
    const dealershipId = getDealershipId();

    setForm(f => ({ ...f, [field]: proofJson }));

    if (!offerId) { toast.error('Ingen offert kopplad till avtalet'); return; }

    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, [field]: proofJson }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      toast.success(`✓ ${proof.name} har signerat köpeavtalet med BankID`);

      const otherSig = form[otherField as keyof AgrForm] as string;
      if (otherSig) {
        // Both signed — derive both sigs for the agreement record
        const sellerSigJson = party === 'seller' ? proofJson : (form.sellerSignature as string);
        const buyerSigJson  = party === 'buyer'  ? proofJson : (form.buyerSignature  as string);
        const sellerProofParsed = sellerSigJson ? (() => { try { return JSON.parse(sellerSigJson); } catch { return null; } })() : null;

        // Save trade-in if present
        if (form.tradeIn && form.tradeInCredit > 0) {
          await fetch('/api/trade-ins', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dealershipId, leadId, offerId,
              description: form.tradeIn,
              creditValue: form.tradeInCredit,
            }),
          });
        }

        // Persist agreement to agreements table
        try {
          await upsertAgreement({
            dealershipId:       dealershipId ?? '',
            leadId:             leadId || null,
            offerId:            offerId || null,
            agreementNumber:    form.agreementNumber,
            status:             'signed',
            customerName:       form.customerName,
            personnummer:       form.personnummer,
            customerAddress:    form.customerAddress,
            customerPhone:      form.customerPhone,
            customerEmail:      form.customerEmail,
            vehicle:            form.vehicle,
            vehicleColor:       form.vehicleColor,
            vehicleCondition:   form.vehicleCondition,
            vin:                form.vin,
            registrationNumber: form.registrationNumber,
            listPrice:          form.listPrice,
            discount:           form.discount,
            accessories:        form.accessories,
            accessoriesCost:    form.accessoriesCost,
            tradeIn:            form.tradeIn,
            tradeInCredit:      form.tradeInCredit,
            totalPrice:         form.totalPrice,
            vatAmount:          form.vatAmount,
            paymentType:        form.paymentType,
            downPayment:        form.downPayment,
            financingMonths:    form.financingMonths,
            financingMonthly:   form.financingMonthly,
            financingApr:       form.financingApr,
            nominalRate:        form.nominalRate,
            deliveryWeeks:      form.deliveryWeeks,
            validUntil:         form.validUntil,
            notes:              form.notes,
            sellerName:         sellerProofParsed?.name ?? dealer.name,
            sellerSignature:    sellerSigJson,
            buyerSignature:     buyerSigJson,
            signedAt:           new Date().toISOString(),
          });
        } catch (agrErr) {
          console.error('[agreement] Failed to save agreement record:', agrErr);
          // Non-fatal — continue with offer/lead updates
        }

        await fetch(`/api/offers/${offerId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, status: 'accepted' }),
        });
        await fetch(`/api/leads/${leadId}/stage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, stage: 'pending_payment' }),
        });
        emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
        setForm(f => ({ ...f, status: 'accepted' } as AgrForm));
        toast.success('Köpeavtalet är underskrivet av båda parter!');
      }
    } catch (err) {
      toast.error(`Underskrift misslyckades: ${err}`);
      setForm(f => ({ ...f, [field]: '' }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const d           = isEditing && draft ? draft : form;
  const sellerProof = parseSig(form.sellerSignature);
  const buyerProof  = parseSig(form.buyerSignature);
  const bothSigned  = !!sellerProof && !!buyerProof;

  const priceAfterDiscount = d.listPrice - d.discount;
  const exVat              = Math.round(d.totalPrice / 1.25);

  const today              = new Date().toLocaleDateString('sv-SE');

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex min-h-screen bg-[#f5f7fa]">
        <div className="no-print"><Sidebar /></div>

        <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
          <div className="brand-top-bar no-print" />

          {/* ── Top bar ── */}
          <div className="no-print px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Link href="/sales/leads" className="text-slate-400 hover:text-slate-600">Pipeline</Link>
                <span className="text-slate-300">/</span>
                <Link href={`/sales/leads/${leadId}`} className="text-slate-400 hover:text-slate-600">Lead #{leadId}</Link>
                <span className="text-slate-300">/</span>
                <Link href={`/sales/leads/${leadId}/offer`} className="text-slate-400 hover:text-slate-600">Offert</Link>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">Köpeavtal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">{d.agreementNumber}</span>
                {bothSigned && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Signerat
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {!isEditing ? (
                <>
                  <button onClick={() => { setDraft({ ...form }); setIsEditing(true); }}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    ✏️ Redigera
                  </button>
                  <button onClick={() => window.print()}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    🖨 Skriv ut
                  </button>
                  {bothSigned && (
                    <Link href={`/sales/leads/${leadId}/payment?tab=${paymentTab}`}
                      className="px-3 py-1.5 text-sm font-medium bg-[#FF6B2C] text-white rounded-lg hover:bg-[#e85a1e]">
                      Gå till betalning →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => { setDraft(null); setIsEditing(false); }}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    Avbryt
                  </button>
                  <button onClick={save} disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium bg-[#FF6B2C] text-white rounded-lg hover:bg-[#e85a1e] disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <><span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />Sparar…</> : 'Spara'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="flex-1 p-4 md:p-6">
            <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto">

              {/* ══ LEFT: Document ══ */}
              <div className="flex-1 min-w-0">

                {isEditing ? (

                  /* ── EDIT FORM ── */
                  <div className="space-y-5">

                    {/* Customer */}
                    <div className="bg-white rounded-2xl border border-[#FF6B2C]/30 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Köpare</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <F label="För- och efternamn">
                          <TxtIn value={draft!.customerName} onChange={v => upd('customerName', v)} />
                        </F>
                        <F label="Personnummer">
                          <TxtIn value={draft!.personnummer} onChange={v => upd('personnummer', v)} />
                        </F>
                        <F label="Adress">
                          <TxtIn value={draft!.customerAddress} onChange={v => upd('customerAddress', v)} />
                        </F>
                        <F label="Telefon">
                          <TxtIn value={draft!.customerPhone} onChange={v => upd('customerPhone', v)} />
                        </F>
                        <F label="E-post">
                          <TxtIn value={draft!.customerEmail} onChange={v => upd('customerEmail', v)} />
                        </F>
                      </div>
                    </div>

                    {/* Vehicle */}
                    <div className="bg-white rounded-2xl border border-[#FF6B2C]/30 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Fordon</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <F label="Märke / modell / årsmodell">
                          <TxtIn value={draft!.vehicle} onChange={v => upd('vehicle', v)} />
                        </F>
                        <F label="Färg">
                          <TxtIn value={draft!.vehicleColor} onChange={v => upd('vehicleColor', v)} />
                        </F>
                        <F label="Skick">
                          <select value={draft!.vehicleCondition}
                            onChange={e => upd('vehicleCondition', e.target.value as VehicleCondition)}
                            className={inputCls}>
                            <option value="new">Ny</option>
                            <option value="used">Begagnad</option>
                          </select>
                        </F>
                        <F label="Chassinummer (VIN)">
                          <TxtIn value={draft!.vin} onChange={v => upd('vin', v)} />
                        </F>
                        <F label="Registreringsnummer">
                          <TxtIn value={draft!.registrationNumber} onChange={v => upd('registrationNumber', v.toUpperCase())} />
                        </F>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-white rounded-2xl border border-[#FF6B2C]/30 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Priskalkyl</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <F label="Ordinarie pris inkl. moms">
                          <NumIn value={draft!.listPrice} onChange={v => upd('listPrice', v)} suffix="kr" />
                        </F>
                        <F label="Rabatt">
                          <NumIn value={draft!.discount} onChange={v => upd('discount', v)} suffix="kr" />
                        </F>
                        <F label="Tillbehör (beskrivning)">
                          <TxtIn value={draft!.accessories} onChange={v => upd('accessories', v)} />
                        </F>
                        <F label="Tillbehörspris inkl. moms">
                          <NumIn value={draft!.accessoriesCost} onChange={v => upd('accessoriesCost', v)} suffix="kr" />
                        </F>
                        <F label="Inbytesobjekt">
                          <TxtIn value={draft!.tradeIn} onChange={v => upd('tradeIn', v)} />
                        </F>
                        <F label="Inbytesvärde">
                          <NumIn value={draft!.tradeInCredit} onChange={v => upd('tradeInCredit', v)} suffix="kr" />
                        </F>
                        <F label="Totalt att betala inkl. moms">
                          <NumIn value={draft!.totalPrice} onChange={v => upd('totalPrice', v)} suffix="kr" />
                        </F>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="bg-white rounded-2xl border border-[#FF6B2C]/30 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Betalning</p>
                      <div className="flex gap-3 mb-4">
                        {(['cash', 'financing'] as PaymentType[]).map(pt => (
                          <button key={pt} onClick={() => upd('paymentType', pt)}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${
                              draft!.paymentType === pt
                                ? 'bg-[#FF6B2C] text-white border-[#FF6B2C]'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                            {pt === 'cash' ? '💵 Kontant' : '📊 Finansiering'}
                          </button>
                        ))}
                      </div>
                      {draft!.paymentType === 'financing' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                          <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-blue-800">Finansieringsvillkor bestäms av banken</p>
                            <p className="text-xs text-blue-600 mt-0.5">Ränta, löptid och månadsbetalning fastställs av banken (Svea, Santander, Klarna m.fl.) och väljs av kunden i betalningssteget efter kreditprövning.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Delivery */}
                    <div className="bg-white rounded-2xl border border-[#FF6B2C]/30 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Leverans & villkor</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <F label="Leveranstid"><NumIn value={draft!.deliveryWeeks} onChange={v => upd('deliveryWeeks', v)} suffix="veckor" /></F>
                        <F label="Giltig till">
                          <input type="date" value={draft!.validUntil}
                            onChange={e => upd('validUntil', e.target.value)} className={inputCls} />
                        </F>
                        <div className="sm:col-span-2">
                          <F label="Övriga villkor">
                            <textarea value={draft!.notes} onChange={e => upd('notes', e.target.value)}
                              rows={2} className={`${inputCls} resize-none`} />
                          </F>
                        </div>
                      </div>
                    </div>

                  </div>

                ) : (

                  /* ── DOCUMENT VIEW ── */
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                    {/* Dark header */}
                    <div className="bg-[#0b1524] text-white px-8 py-6">
                      <div className="flex items-start justify-between gap-6 flex-wrap">
                        <div>
                          <h1 className="text-2xl font-bold tracking-tight">{dealer.name || 'Återförsäljare'}</h1>
                          {dealer.address && <p className="text-sm text-white/70 mt-1">{dealer.address}</p>}
                          <div className="flex gap-4 mt-1 flex-wrap">
                            {dealer.phone && <span className="text-sm text-white/70">📞 {dealer.phone}</span>}
                            {dealer.email && <span className="text-sm text-white/70">✉ {dealer.email}</span>}
                            {dealer.orgNr && <span className="text-sm text-white/70">Org.nr {dealer.orgNr}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-black tracking-widest text-[#FF6B2C]">KÖPEAVTAL</div>
                          <p className="text-sm text-white/70 mt-1">Nr: <span className="font-mono font-semibold text-white">{d.agreementNumber}</span></p>
                          <p className="text-sm text-white/70">Baserat på offert: <span className="font-semibold text-white">{d.offerNumber}</span></p>
                          <p className="text-sm text-white/70">Datum: {today}</p>
                          {d.validUntil && <p className="text-sm text-white/70">Giltig till: <span className="font-semibold text-white">{fmtDate(d.validUntil)}</span></p>}
                        </div>
                      </div>
                    </div>

                    {/* Parties */}
                    <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                      <div className="px-8 py-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Säljare</p>
                        <p className="font-bold text-slate-900">{dealer.name}</p>
                        {dealer.address && <p className="text-sm text-slate-600 mt-0.5">{dealer.address}</p>}
                        {dealer.phone   && <p className="text-sm text-slate-600">Tel: {dealer.phone}</p>}
                        {dealer.email   && <p className="text-sm text-slate-600">{dealer.email}</p>}
                        {dealer.orgNr   && <p className="text-sm text-slate-500 mt-1">Org.nr: {dealer.orgNr}</p>}
                      </div>
                      <div className="px-8 py-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Köpare</p>
                        <p className="font-bold text-slate-900">{d.customerName || '—'}</p>
                        {d.customerPhone   && <p className="text-sm text-slate-600 mt-0.5">Tel: {d.customerPhone}</p>}
                        {d.personnummer    && <p className="text-sm text-slate-600">Personnr: {d.personnummer}</p>}
                        {d.customerAddress && <p className="text-sm text-slate-600 mt-0.5">{d.customerAddress}</p>}
                        {d.customerEmail   && <p className="text-sm text-slate-500">{d.customerEmail}</p>}
                      </div>
                    </div>

                    {/* Body sections */}
                    <div className="px-8 py-6 space-y-0">

                      {/* Vehicle */}
                      <DocSection title="Fordon">
                        <div className="grid grid-cols-2 gap-x-8">
                          <div>
                            <DocLine label="Märke / modell / årsmodell" value={d.vehicle || '—'} />
                            <DocLine label="Chassinummer (VIN)"         value={d.vin || '—'} />
                            <DocLine label="Registreringsnummer"        value={d.registrationNumber || '—'} />
                          </div>
                          <div>
                            <DocLine label="Färg"  value={d.vehicleColor || '—'} />
                            <DocLine label="Skick" value={d.vehicleCondition === 'new' ? 'Ny' : 'Begagnad'} />
                          </div>
                        </div>
                      </DocSection>

                      {/* Pricing */}
                      <DocSection title="Priskalkyl">
                        <DocLine label="Ordinarie pris inkl. moms" value={fmt(d.listPrice)} />
                        {d.discount > 0 && (
                          <>
                            <DocLine label="Rabatt"                value={`− ${fmt(d.discount)}`} negative indent />
                            <DocLine label="Fordonspris efter rabatt" value={fmt(priceAfterDiscount)} bold />
                          </>
                        )}
                        {d.accessories && (() => {
                          try {
                            const items = JSON.parse(d.accessories) as { id: string; name: string; qty: number; unitPrice: number }[];
                            if (Array.isArray(items) && items[0]?.id) {
                              return items.map(item => (
                                <DocLine key={item.id} indent
                                  label={`${item.name}${item.qty > 1 ? ` × ${item.qty}` : ''}`}
                                  value={`+ ${fmt(item.qty * item.unitPrice)}`}
                                />
                              ));
                            }
                          } catch { /* plain text */ }
                          return <DocLine label={`Tillbehör: ${d.accessories}`} value={`+ ${fmt(d.accessoriesCost)}`} indent />;
                        })()}
                        {d.tradeIn && (
                          <DocLine label={`Inbyte: ${d.tradeIn}`} value={`− ${fmt(d.tradeInCredit)}`} negative indent />
                        )}
                        <div className="my-2 border-t-2 border-slate-900" />
                        <div className="flex items-baseline justify-between py-2">
                          <span className="text-base font-black text-slate-900">Totalt att betala inkl. moms</span>
                          <span className="text-2xl font-black text-[#0b1524] font-mono">{fmt(d.totalPrice)}</span>
                        </div>
                        <div className="flex gap-6 mt-1">
                          <span className="text-xs text-slate-500">varav moms 25%: <strong>{fmt(d.vatAmount)}</strong></span>
                          <span className="text-xs text-slate-500">nettopris exkl. moms: <strong>{fmt(exVat)}</strong></span>
                        </div>
                      </DocSection>

                      {/* Payment */}
                      <DocSection title="Betalningsinformation">
                        <DocLine label="Betalningssätt" value={d.paymentType === 'financing' ? 'Finansiering' : 'Kontant betalning'} bold />
                        <DocLine label="Totalt att betala inkl. moms" value={fmt(d.totalPrice)} bold />
                        {d.paymentType === 'financing' ? (
                          <p className="text-xs text-slate-500 mt-2">
                            Finansiering sker via godkänd kreditgivare (t.ex. Svea, Santander eller Klarna). Ränta, löptid och månadsbetalning fastställs av banken efter kreditprövning och bekräftas i betalningssteget.
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 mt-2">Hela beloppet {fmt(d.totalPrice)} betalas kontant vid leverans.</p>
                        )}
                      </DocSection>

                      {/* Delivery & Terms */}
                      <DocSection title="Leverans &amp; villkor">
                        <DocLine label="Beräknad leveranstid" value={`ca ${d.deliveryWeeks} veckor från undertecknande`} />
                        <DocLine label="Leveransort"          value={dealer.address || '—'} />
                        {d.validUntil && <DocLine label="Avtal giltigt till" value={fmtDate(d.validUntil)} bold />}
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-slate-600">• Priserna inkluderar 25% mervärdesskatt (moms).</p>
                          <p className="text-xs text-slate-600">• Fordonet levereras med 3 års garanti (Konsumentköplagen 2022:260).</p>
                          <p className="text-xs text-slate-600">• Köparen har ångerfrist om 14 dagar enligt Distansavtalslagen.</p>
                          {d.notes && <p className="text-xs text-slate-600">• {d.notes}</p>}
                        </div>
                      </DocSection>

                      {/* Legal */}
                      <DocSection title="Juridiska villkor">
                        <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                          <p><strong>§ 1 Äganderättens övergång.</strong> Äganderätten övergår till köparen när full betalning mottagits och bekräftats av säljaren.</p>
                          <p><strong>§ 2 Leverans.</strong> Fordonet levereras på {dealer.address || 'säljarens adress'}. Risken för fordonet övergår till köparen vid leveranstillfället.</p>
                          <p><strong>§ 3 Garanti.</strong> Fordonet levereras med 3 (tre) års garanti enligt Konsumentköplagen (2022:260). Garantin täcker fabrikationsfel och dolda fel.</p>
                          <p><strong>§ 4 Ångerfrist.</strong> Köparen har rätt att frånträda avtalet inom 14 dagar från leverans (Distansavtalslagen 2005:59), förutsatt att fordonet är i oförändrat skick.</p>
                          <p><strong>§ 5 Finansiering.</strong> {d.paymentType === 'financing' ? `Finansiering sker i enlighet med Konsumentkreditlagen (2010:1846). Kredit beviljas efter godkänd kreditprövning.` : 'Betalning sker kontant vid leverans.'}</p>
                          {d.tradeIn && <p><strong>§ 6 Inbytesfordon.</strong> Inbytesfordon ("{d.tradeIn}") värderat till {fmt(d.tradeInCredit)} avräknas mot köpeskillingen. Inbytet sker i befintligt skick om inget annat avtalats.</p>}
                          <p><strong>§ {d.tradeIn ? '7' : '6'} Tvist.</strong> Tvist ska i första hand lösas via Allmänna reklamationsnämnden (ARN). Svensk lag tillämpas.</p>
                          <p><strong>§ {d.tradeIn ? '8' : '7'} Personuppgifter.</strong> Personuppgifter behandlas i enlighet med GDPR (EU 2016/679). Se vår integritetspolicy på säljarens webbplats.</p>
                        </div>
                      </DocSection>

                      {/* Signatures */}
                      <DocSection title="Underskrifter">
                        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                          Genom underskrift med BankID bekräftas att köpeavtalet accepteras och att parterna förbinder sig att uppfylla
                          avtalets villkor. Signeringen är juridiskt bindande enligt lagen om elektroniska signaturer (2016/910/EU).
                        </p>

                        {!bothSigned && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 no-print">
                            <SigBlock
                              label="Säljarens underskrift"
                              sigJson={form.sellerSignature}
                              signText={buildSignText('seller')}
                              onSigned={proof => handleSigned('seller', proof)}
                              party="seller"
                            />
                            <SigBlock
                              label="Köparens underskrift"
                              sigJson={form.buyerSignature}
                              signText={buildSignText('buyer')}
                              onSigned={proof => handleSigned('buyer', proof)}
                              party="buyer"
                            />
                          </div>
                        )}

                        {bothSigned && (
                          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 mb-5 no-print">
                            <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">✓</span>
                            <div>
                              <p className="font-semibold text-emerald-800 text-sm">Köpeavtalet är underskrivet av båda parter via BankID</p>
                              <p className="text-xs text-emerald-600 mt-0.5">Signering är juridiskt giltig enligt eIDAS-förordningen.</p>
                            </div>
                          </div>
                        )}

                        {/* Static sig lines (always visible for print) */}
                        <div className="grid grid-cols-2 gap-8">
                          {(['seller', 'buyer'] as const).map(party => {
                            const proof = parseSig(party === 'seller' ? form.sellerSignature : form.buyerSignature);
                            return (
                              <div key={party}>
                                {proof ? (
                                  <div className="mb-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <p className="text-sm font-semibold text-slate-900">{proof.name}</p>
                                    <p className="text-xs text-slate-500">{proof.personalNumber.replace(/(\d{8})(\d{4})/, '$1-$2')}</p>
                                    <p className="text-xs text-slate-400">BankID • {new Date(proof.signedAt).toLocaleString('sv-SE')}</p>
                                  </div>
                                ) : (
                                  <div className="border-b-2 border-slate-300 h-14 mb-2" />
                                )}
                                <p className="text-xs text-slate-500 mb-0.5">Ort och datum</p>
                                <p className="text-xs font-semibold text-slate-700 mt-1">
                                  {party === 'seller'
                                    ? `Säljarens underskrift — ${dealer.name}`
                                    : `Köparens underskrift — ${d.customerName || '—'}`}
                                </p>
                                {!proof && <p className="text-xs text-slate-400 mt-0.5">Namnförtydligande</p>}
                              </div>
                            );
                          })}
                        </div>
                      </DocSection>

                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
                      <p className="text-[10px] text-slate-400">
                        {dealer.name} • {dealer.address} • {dealer.phone} • {dealer.email}
                        {dealer.orgNr && ` • Org.nr ${dealer.orgNr}`}
                      </p>
                    </div>

                  </div>
                )}

                {/* Post-sign CTA */}
                {bothSigned && !isEditing && (
                  <div className="mt-4 rounded-2xl overflow-hidden shadow-sm no-print">
                    <div className="bg-emerald-600 px-6 py-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">✓</span>
                      <span className="text-sm font-bold text-white tracking-wide uppercase">Köpeavtal signerat</span>
                    </div>
                    <div className="bg-white border border-emerald-100 px-6 py-5">
                      <p className="text-slate-600 text-sm leading-relaxed mb-4">
                        Båda parter har signerat. Fortsätt till betalning för att slutföra affären.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/sales/leads/${leadId}/payment?tab=${paymentTab}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-[#FF6B2C] text-white rounded-xl hover:bg-[#e85a1e] transition-colors shadow-sm">
                          💳 Gå till betalning →
                        </Link>
                        <button onClick={() => window.print()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">
                          🖨 Skriv ut avtal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* ══ RIGHT: Sidebar ══ */}
              <div className="lg:w-72 shrink-0 flex flex-col gap-4 no-print">

                {/* Legal Compliance */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span>✅</span> Juridisk efterlevnad
                  </h2>
                  {[
                    'Konsumentköplagen (2022:260)',
                    '14 dagars ångerfrist',
                    'GDPR-klausul inkluderad',
                    'Moms korrekt (25%)',
                    'F-skattebevis',
                    '3 års garanti inkluderad',
                    'eIDAS-signering (EU 910/2014)',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 py-1.5">
                      <span className="text-emerald-500 text-sm shrink-0">✅</span>
                      <span className="text-sm text-emerald-700">{item}</span>
                    </div>
                  ))}
                </div>

                {/* Document Security */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span>🔒</span> Dokumentsäkerhet
                  </h2>
                  {[
                    { label: 'Innan signering', value: 'Redigera' },
                    { label: 'Efter BankID', value: 'Låst & oföränderlig' },
                    { label: 'Spårningslogg', value: 'Varje ändring loggas' },
                    { label: 'Lagring', value: '7 år krypterat' },
                  ].map(row => (
                    <div key={row.label} className="py-1.5 flex items-baseline gap-2">
                      <span className="text-xs text-slate-400 shrink-0 min-w-28">{row.label}</span>
                      <span className="text-sm font-medium text-slate-700">{row.value}</span>
                    </div>
                  ))}
                </div>

                {/* Signing status */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span>✍️</span> Signeringsstatus
                  </h2>
                  {(['seller', 'buyer'] as const).map(party => {
                    const proof = parseSig(party === 'seller' ? form.sellerSignature : form.buyerSignature);
                    return (
                      <div key={party} className={`flex items-center gap-2.5 py-2 border-b border-slate-50 last:border-0`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${proof ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                          {proof ? '✓' : '?'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {party === 'seller' ? `${dealer.name}` : (d.customerName || 'Köpare')}
                          </p>
                          <p className="text-xs text-slate-400">
                            {proof
                              ? new Date(proof.signedAt).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
                              : 'Väntar på underskrift'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick actions */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">Snabbåtgärder</h2>
                  <div className="space-y-2">
                    <Link href={`/sales/leads/${leadId}/offer`}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                      ← Tillbaka till offert
                    </Link>
                    <button onClick={() => window.print()}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-left">
                      🖨 Skriv ut köpeavtal
                    </button>
                    {bothSigned && (
                      <Link href={`/sales/leads/${leadId}/payment?tab=${paymentTab}`}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-semibold text-[#FF6B2C] hover:bg-[#FF6B2C]/5 rounded-lg transition-colors">
                        💳 Gå till betalning
                      </Link>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
