'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId, getDealershipProfile } from '@/lib/tenant';
import { generateOfferNumber, type Offer, type OfferStatus, type PaymentType, type VehicleCondition } from '@/lib/offers';
import { emit, useAutoRefresh } from '@/lib/realtime';
import { useInventory } from '@/context/InventoryContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfferForm {
  offerNumber:        string;
  status:             OfferStatus;
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
  // Meta
  deliveryWeeks:      number;
  validUntil:         string;
  notes:              string;
  // BankID signatures (JSON SigProof or '')
  sellerSignature:    string;
  buyerSignature:     string;
}

const BLANK: OfferForm = {
  offerNumber: '', status: 'draft',
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

const STATUS_CFG: Record<OfferStatus, { label: string; dot: string; badge: string }> = {
  draft:    { label: 'Utkast',     dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600' },
  sent:     { label: 'Skickad',    dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  accepted: { label: 'Accepterad', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  declined: { label: 'Avböjd',    dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600' },
};

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('sv-SE');
}

const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20';

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function TxtIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />;
}

function NumIn({ value, onChange, step = 1, suffix, min = 0 }: { value: number; onChange: (v: number) => void; step?: number; suffix?: string; min?: number }) {
  return (
    <div className="relative">
      <input type="number" value={value || ''} min={min} step={step}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className={`${inputCls} ${suffix ? 'pr-12' : ''}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

// ─── Document view ────────────────────────────────────────────────────────────

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

// ─── Accessory picker ─────────────────────────────────────────────────────────

export interface AccessoryLineItem {
  id:            string;
  name:          string;
  articleNumber: string;
  brand:         string;
  qty:           number;
  unitPrice:     number;
}

const fmtKr = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);

function AccessoriesPicker({
  items,
  onItemsChange,
}: {
  items: AccessoryLineItem[];
  onItemsChange: (items: AccessoryLineItem[]) => void;
}) {
  const { spareParts, accessories: inventoryAccessories } = useInventory();
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);

  const catalog = useMemo<AccessoryLineItem[]>(() => [
    ...spareParts.map(p => ({ id: p.id, name: p.name, articleNumber: p.articleNumber, brand: p.brand, qty: 1, unitPrice: p.sellingPrice })),
    ...inventoryAccessories.map(a => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, brand: a.brand, qty: 1, unitPrice: a.sellingPrice })),
  ], [spareParts, inventoryAccessories]);

  const q        = search.trim().toLowerCase();
  const filtered = q
    ? catalog.filter(c => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q) || c.articleNumber.toLowerCase().includes(q))
    : catalog.slice(0, 10);

  const selectedIds = new Set(items.map(i => i.id));

  const addItem = (item: AccessoryLineItem) => {
    if (selectedIds.has(item.id)) return;
    onItemsChange([...items, { ...item, qty: 1 }]);
    setSearch('');
    setOpen(false);
  };

  const removeItem = (id: string) => onItemsChange(items.filter(i => i.id !== id));

  const setQty = (id: string, qty: number) => {
    if (qty < 1) return;
    onItemsChange(items.map(i => i.id === id ? { ...i, qty } : i));
  };

  const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  return (
    <div className="sm:col-span-2 space-y-2">
      <label className="block text-xs font-semibold text-slate-500">
        Tillbehör &amp; reservdelar
        <span className="ml-1.5 font-normal text-slate-400">(sök och lägg till)</span>
      </label>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Sök reservdel eller tillbehör…"
          className={inputCls + ' pr-9'}
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>

        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {filtered.map(item => (
              <button
                key={item.id}
                onMouseDown={() => addItem(item)}
                disabled={selectedIds.has(item.id)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${selectedIds.has(item.id) ? 'opacity-40' : ''}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.brand} · {item.articleNumber}</p>
                </div>
                <span className="shrink-0 text-xs font-mono font-semibold text-slate-700">{fmtKr(item.unitPrice)}</span>
              </button>
            ))}
          </div>
        )}

        {open && q.length > 0 && filtered.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-sm text-slate-400 text-center">
            Inga träffar för &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Selected items */}
      {items.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-400">{item.articleNumber}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setQty(item.id, item.qty - 1)} disabled={item.qty <= 1}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-sm font-bold text-slate-600 flex items-center justify-center transition-colors">−</button>
                <span className="w-5 text-center text-sm font-semibold text-slate-900">{item.qty}</span>
                <button onClick={() => setQty(item.id, item.qty + 1)}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 flex items-center justify-center transition-colors">+</button>
              </div>
              <span className="w-22 text-right text-sm font-mono font-semibold text-slate-700 shrink-0">
                {fmtKr(item.qty * item.unitPrice)}
              </span>
              <button onClick={() => removeItem(item.id)}
                className="w-6 h-6 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 flex items-center justify-center transition-colors text-xs font-bold shrink-0">✕</button>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Totalt tillbehör inkl. moms</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{fmtKr(total)}</span>
          </div>
        </div>
      )}

      {catalog.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          Inget lager inläst — lägg till artiklar under Lager för att söka här.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OfferPage() {
  const router    = useRouter();
  const params    = useParams();
  const printRef  = useRef<HTMLDivElement>(null);
  const leadId    = Number((params?.id as string) || '0');

  const [ready,               setReady]               = useState(false);
  const [saving,              setSaving]              = useState(false);
  const [offerId,             setOfferId]             = useState<number | null>(null);
  const [form,                setForm]                = useState<OfferForm>(BLANK);
  const [isEditing,           setIsEditing]           = useState(false);
  const [draft,               setDraft]               = useState<OfferForm | null>(null);
  const [dealer,              setDealer]              = useState({ name: '', address: '', phone: '', email: '', orgNr: '' });
  const [selectedAccessories, setSelectedAccessories] = useState<AccessoryLineItem[]>([]);

  // Keep the page in sync when another tab or user edits the offer
  useAutoRefresh(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId || !leadId || Number.isNaN(leadId) || isEditing) return;
    const res = await fetch(`/api/offers?leadId=${leadId}&dealershipId=${dealershipId}`);
    const { offer: refreshed }: { offer: Offer | null } = await res.json();
    if (refreshed) {
      setOfferId(refreshed.id);
      setForm({
        offerNumber: refreshed.offerNumber, status: refreshed.status,
        customerName: refreshed.customerName, personnummer: refreshed.personnummer,
        customerAddress: refreshed.customerAddress, customerPhone: refreshed.customerPhone, customerEmail: refreshed.customerEmail,
        vehicle: refreshed.vehicle, vehicleColor: refreshed.vehicleColor, vehicleCondition: refreshed.vehicleCondition,
        vin: refreshed.vin, registrationNumber: refreshed.registrationNumber,
        listPrice: refreshed.listPrice, discount: refreshed.discount,
        accessories: refreshed.accessories, accessoriesCost: refreshed.accessoriesCost,
        tradeIn: refreshed.tradeIn, tradeInCredit: refreshed.tradeInCredit,
        totalPrice: refreshed.totalPrice, vatAmount: refreshed.vatAmount,
        paymentType: refreshed.paymentType, downPayment: refreshed.downPayment,
        financingMonths: refreshed.financingMonths, financingMonthly: refreshed.financingMonthly,
        financingApr: refreshed.financingApr, nominalRate: refreshed.nominalRate,
        deliveryWeeks: refreshed.deliveryWeeks, validUntil: refreshed.validUntil ?? '', notes: refreshed.notes,
        sellerSignature: refreshed.sellerSignature ?? '',
        buyerSignature:  refreshed.buyerSignature  ?? '',
      });
    }
  });

  function syncAccessories(items: AccessoryLineItem[]) {
    setSelectedAccessories(items);
    const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const accessoriesStr = items.length > 0 ? JSON.stringify(items) : '';
    setDraft(d => {
      if (!d) return d;
      return recompute({ ...d, accessories: accessoriesStr, accessoriesCost: total });
    });
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) { router.replace('/auth/login'); return; }
    if (!leadId || Number.isNaN(leadId)) { setReady(true); return; }

    const dealershipId = getDealershipId();
    const profile      = getDealershipProfile();
    const parsed       = JSON.parse(user);
    setDealer({
      name:    profile.name    || 'Återförsäljare',
      address: profile.address || '',
      phone:   profile.phone   || '',
      email:   profile.email   || '',
      orgNr:   (parsed.orgNr as string) || '',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;

    (async () => {
      const [{ data: lead }, offerRes] = await Promise.all([
        sb.from('leads').select('name, personnummer, bike, value, phone, email, address, city').eq('id', leadId).eq('dealership_id', dealershipId).maybeSingle(),
        fetch(`/api/offers?leadId=${leadId}&dealershipId=${dealershipId}`),
      ]);
      const { offer: existing }: { offer: Offer | null } = await offerRes.json();

      if (existing) {
        setOfferId(existing.id);
        setForm({
          offerNumber: existing.offerNumber, status: existing.status,
          customerName: existing.customerName, personnummer: existing.personnummer,
          customerAddress: existing.customerAddress, customerPhone: existing.customerPhone, customerEmail: existing.customerEmail,
          vehicle: existing.vehicle, vehicleColor: existing.vehicleColor, vehicleCondition: existing.vehicleCondition,
          vin: existing.vin, registrationNumber: existing.registrationNumber,
          listPrice: existing.listPrice, discount: existing.discount,
          accessories: existing.accessories, accessoriesCost: existing.accessoriesCost,
          tradeIn: existing.tradeIn, tradeInCredit: existing.tradeInCredit,
          totalPrice: existing.totalPrice, vatAmount: existing.vatAmount,
          paymentType: existing.paymentType, downPayment: existing.downPayment,
          financingMonths: existing.financingMonths, financingMonthly: existing.financingMonthly,
          financingApr: existing.financingApr, nominalRate: existing.nominalRate,
          deliveryWeeks: existing.deliveryWeeks, validUntil: existing.validUntil ?? '', notes: existing.notes,
          sellerSignature: existing.sellerSignature ?? '',
          buyerSignature:  existing.buyerSignature  ?? '',
        });
      } else if (lead) {
        const rawValue = parseFloat(String(lead.value ?? '0')) || 0;
        const listP    = rawValue > 0 ? rawValue : 0;
        const vat      = Math.round(listP * 0.2);
        const addrParts = [lead.address, lead.city].filter(Boolean);
        setForm(prev => ({
          ...prev,
          offerNumber:     generateOfferNumber(),
          customerName:    lead.name        ?? '',
          personnummer:    lead.personnummer ?? '',
          customerAddress: addrParts.join(', '),
          customerPhone:   lead.phone       ?? '',
          customerEmail:   lead.email       ?? '',
          vehicle:         lead.bike        ?? '',
          listPrice:       listP,
          totalPrice:      listP,
          vatAmount:       vat,
          validUntil:      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        }));
      } else {
        setForm(prev => ({
          ...prev,
          offerNumber: generateOfferNumber(),
          validUntil:  new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        }));
      }
      setReady(true);
    })();
  }, [leadId, router]);

  // ── Computed totals ────────────────────────────────────────────────────────

  function recompute(f: OfferForm): OfferForm {
    const base  = Math.max(0, f.listPrice - f.discount) + f.accessoriesCost - f.tradeInCredit;
    const total = Math.max(0, base);
    const vat   = Math.round(total * 0.2);   // VAT is 25% of ex-VAT = 20% of total
    return { ...f, totalPrice: total, vatAmount: vat };
  }

  function update<K extends keyof OfferForm>(key: K, value: OfferForm[K]) {
    setDraft(d => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      if (['listPrice','discount','accessoriesCost','tradeInCredit'].includes(key as string)) return recompute(next);
      return next;
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save(overrideStatus?: OfferStatus) {
    const payload = { ...(draft ?? form) };
    if (overrideStatus) payload.status = overrideStatus;
    const dealershipId = getDealershipId();
    setSaving(true);
    try {
      if (offerId) {
        const res = await fetch(`/api/offers/${offerId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
        emit({ type: 'data:refresh' });
      } else {
        const res = await fetch('/api/offers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, leadId, ...payload }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const json = await res.json();
        setOfferId(json.offer.id);
        await fetch(`/api/leads/${leadId}/stage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealershipId, stage: 'offer', fromStages: ['new','contacted','testride'] }),
        });
        emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
        emit({ type: 'data:refresh' });
      }
      setForm(payload);
      setDraft(null);
      setIsEditing(false);
      setSelectedAccessories([]);
      toast.success('Offert sparad');
    } catch (err) {
      toast.error(`Kunde inte spara: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  async function acceptOffer() {
    if (!offerId) { toast.error('Spara offerten först'); return; }
    const dealershipId = getDealershipId();
    setSaving(true);
    try {
      await fetch(`/api/offers/${offerId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, status: 'accepted' }),
      });
      await fetch(`/api/leads/${leadId}/stage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipId, stage: 'negotiating' }),
      });
      emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
      setForm(prev => ({ ...prev, status: 'accepted' }));
      toast.success('Offert accepterad — öppnar avtal');
      router.push(`/sales/leads/${leadId}/agreement`);
    } catch { toast.error('Fel vid statusuppdatering'); }
    finally { setSaving(false); }
  }

  async function declineOffer() {
    if (!offerId) return;
    const dealershipId = getDealershipId();
    await fetch(`/api/offers/${offerId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealershipId, status: 'declined' }),
    });
    setForm(prev => ({ ...prev, status: 'declined' }));
    toast.success('Offert markerad som avböjd');
  }

  function handlePrint() {
    window.print();
  }

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const d    = isEditing && draft ? draft : form;
  const scfg = STATUS_CFG[d.status];

  // Computed for display
  const priceAfterDiscount = d.listPrice - d.discount;
  const exVat              = Math.round(d.totalPrice / 1.25);
  const creditAmount       = d.totalPrice - d.downPayment;
  const totalCredit        = d.financingMonthly * d.financingMonths;
  const totalCreditCost    = totalCredit + d.downPayment;

  // Parse accessories — may be JSON array (picker) or plain text (legacy)
  let parsedAccessories: AccessoryLineItem[] | null = null;
  if (d.accessories) {
    try {
      const p = JSON.parse(d.accessories);
      if (Array.isArray(p) && p[0]?.id) parsedAccessories = p as AccessoryLineItem[];
    } catch { /* plain text — leave null */ }
  }

  const today = new Date().toLocaleDateString('sv-SE');

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .offer-doc { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      <div className="flex min-h-screen bg-[#f5f7fa]">
        <div className="no-print"><Sidebar /></div>

        <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
          <div className="brand-top-bar no-print" />

          {/* ── Top bar ────────────────────────────────────────────────────── */}
          <div className="no-print px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Link href="/sales/leads" className="text-slate-400 hover:text-slate-600">Pipeline</Link>
                <span className="text-slate-300">/</span>
                <Link href={`/sales/leads/${leadId}`} className="text-slate-400 hover:text-slate-600">Lead #{leadId}</Link>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">Offert</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">{d.offerNumber}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${scfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
                  {scfg.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {!isEditing ? (
                <>
                  <button onClick={() => {
                    try {
                      const parsed = JSON.parse(form.accessories);
                      if (Array.isArray(parsed) && parsed[0]?.id) setSelectedAccessories(parsed as AccessoryLineItem[]);
                      else setSelectedAccessories([]);
                    } catch { setSelectedAccessories([]); }
                    setDraft({ ...form });
                    setIsEditing(true);
                  }}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    ✏️ Redigera
                  </button>
                  <button onClick={handlePrint}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    🖨 Skriv ut
                  </button>
                  {d.status !== 'accepted' && d.status !== 'declined' && (
                    <>
                      <button onClick={() => save('sent')} disabled={saving}
                        className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        Markera som skickad
                      </button>
                      <button onClick={acceptOffer} disabled={saving}
                        className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        ✓ Acceptera → Avtal
                      </button>
                      <button onClick={declineOffer} disabled={saving}
                        className="px-3 py-1.5 text-sm font-medium bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                        Avböj
                      </button>
                    </>
                  )}
                  {d.status === 'accepted' && (
                    <Link href={`/sales/leads/${leadId}/agreement`}
                      className="px-3 py-1.5 text-sm font-medium bg-[#FF6B2C] text-white rounded-lg hover:bg-[#e85a1e]">
                      Öppna avtal →
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => { setDraft(null); setIsEditing(false); setSelectedAccessories([]); }}
                    className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                    Avbryt
                  </button>
                  <button onClick={() => save()} disabled={saving}
                    className="px-3 py-1.5 text-sm font-medium bg-[#FF6B2C] text-white rounded-lg hover:bg-[#e85a1e] disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <><span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"/>Sparar…</> : 'Spara offert'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Content ────────────────────────────────────────────────────── */}
          <div className="flex-1 p-4 md:p-6">
            {isEditing ? (

              /* ════════════════════ EDIT FORM ════════════════════ */
              <div className="max-w-3xl mx-auto space-y-5">

                {/* Customer */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Kundinformation</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="För- och efternamn">
                      <TxtIn value={draft!.customerName} onChange={v => update('customerName', v)} placeholder="Anna Andersson" />
                    </F>
                    <F label="Personnummer">
                      <TxtIn value={draft!.personnummer} onChange={v => update('personnummer', v)} placeholder="YYYYMMDD-XXXX" />
                    </F>
                    <F label="Adress" >
                      <TxtIn value={draft!.customerAddress} onChange={v => update('customerAddress', v)} placeholder="Storgatan 1, 123 45 Stockholm" />
                    </F>
                    <F label="Telefon">
                      <TxtIn value={draft!.customerPhone} onChange={v => update('customerPhone', v)} placeholder="070-000 00 00" />
                    </F>
                    <F label="E-postadress">
                      <TxtIn value={draft!.customerEmail} onChange={v => update('customerEmail', v)} placeholder="anna@example.se" />
                    </F>
                  </div>
                </div>

                {/* Vehicle */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Fordon</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="Märke, modell och årsmodell">
                      <TxtIn value={draft!.vehicle} onChange={v => update('vehicle', v)} placeholder="Kawasaki Ninja ZX-6R 2024" />
                    </F>
                    <F label="Färg">
                      <TxtIn value={draft!.vehicleColor} onChange={v => update('vehicleColor', v)} placeholder="Metallic svart" />
                    </F>
                    <F label="Skick">
                      <select value={draft!.vehicleCondition} onChange={e => update('vehicleCondition', e.target.value as VehicleCondition)} className={inputCls}>
                        <option value="new">Ny</option>
                        <option value="used">Begagnad</option>
                      </select>
                    </F>
                    <F label="Chassinummer (VIN)">
                      <TxtIn value={draft!.vin} onChange={v => update('vin', v)} placeholder="JKBZXR636PA012345" />
                    </F>
                    <F label="Registreringsnummer">
                      <TxtIn value={draft!.registrationNumber} onChange={v => update('registrationNumber', v)} placeholder="ABC123" />
                    </F>
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Priskalkyl</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="Ordinarie pris inkl. moms">
                      <NumIn value={draft!.listPrice} onChange={v => update('listPrice', v)} suffix="kr" />
                    </F>
                    <F label="Rabatt">
                      <NumIn value={draft!.discount} onChange={v => update('discount', v)} suffix="kr" />
                    </F>
                    <AccessoriesPicker
                      items={selectedAccessories}
                      onItemsChange={syncAccessories}
                    />
                    <F label="Inbytesobjekt">
                      <TxtIn value={draft!.tradeIn} onChange={v => update('tradeIn', v)} placeholder="Honda CB500F 2020, reg ABC123" />
                    </F>
                    <F label="Inbytesvärde">
                      <NumIn value={draft!.tradeInCredit} onChange={v => update('tradeInCredit', v)} suffix="kr" />
                    </F>
                  </div>
                  {/* Live total preview */}
                  <div className="mt-4 bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Totalt att betala inkl. moms</span>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-[#0b1524]">{fmt(draft!.totalPrice)}</p>
                      <p className="text-xs text-slate-400">varav moms {fmt(draft!.vatAmount)}</p>
                    </div>
                  </div>
                </div>

                {/* Payment */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Betalning</p>
                  <div className="flex gap-3 mb-4">
                    {(['cash', 'financing'] as PaymentType[]).map(pt => (
                      <button key={pt} onClick={() => update('paymentType', pt)}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${
                          draft!.paymentType === pt
                            ? 'bg-[#FF6B2C] text-white border-[#FF6B2C]'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {pt === 'cash' ? '💵 Kontant' : '📊 Finansiering'}
                      </button>
                    ))}
                  </div>
                  {draft!.paymentType === 'financing' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <F label="Kontantinsats">
                        <NumIn value={draft!.downPayment} onChange={v => update('downPayment', v)} suffix="kr" />
                      </F>
                      <F label="Löptid">
                        <NumIn value={draft!.financingMonths} onChange={v => update('financingMonths', v)} suffix="mån" />
                      </F>
                      <F label="Månadskostnad">
                        <NumIn value={draft!.financingMonthly} onChange={v => update('financingMonthly', v)} suffix="kr/mån" />
                      </F>
                      <F label="Nominell ränta">
                        <NumIn value={draft!.nominalRate} onChange={v => update('nominalRate', v)} step={0.1} suffix="%" />
                      </F>
                      <F label="Effektiv ränta (APR)">
                        <NumIn value={draft!.financingApr} onChange={v => update('financingApr', v)} step={0.1} suffix="%" />
                      </F>
                    </div>
                  )}
                </div>

                {/* Delivery & validity */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Leverans & villkor</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="Beräknad leveranstid">
                      <NumIn value={draft!.deliveryWeeks} onChange={v => update('deliveryWeeks', v)} suffix="veckor" min={1} />
                    </F>
                    <F label="Offerten giltig till">
                      <input type="date" value={draft!.validUntil} onChange={e => update('validUntil', e.target.value)} className={inputCls} />
                    </F>
                    <div className="sm:col-span-2">
                      <F label="Övriga villkor / anteckningar">
                        <textarea value={draft!.notes} onChange={e => update('notes', e.target.value)}
                          rows={3} placeholder="Leveransvillkor, garanti, övrigt…"
                          className={`${inputCls} resize-none`} />
                      </F>
                    </div>
                  </div>
                </div>

              </div>

            ) : (

              /* ════════════════════ DOCUMENT VIEW ════════════════════ */
              <div ref={printRef} className="max-w-3xl mx-auto">
                <div className="offer-doc bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                  {/* ── Document header ── */}
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
                        <div className="text-3xl font-black tracking-widest text-[#FF6B2C]">OFFERT</div>
                        <p className="text-sm text-white/70 mt-1">Nr: <span className="font-mono font-semibold text-white">{d.offerNumber}</span></p>
                        <p className="text-sm text-white/70">Datum: {today}</p>
                        {d.validUntil && <p className="text-sm text-white/70">Giltig till: <span className="font-semibold text-white">{fmtDate(d.validUntil)}</span></p>}
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mt-2 ${scfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
                          {scfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-8 py-6 space-y-0">

                    {/* ── Parties ── */}
                    <div className="grid grid-cols-2 gap-6 mb-8 pb-6 border-b border-slate-100">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Säljare</p>
                        <p className="font-bold text-slate-900">{dealer.name}</p>
                        {dealer.address && <p className="text-sm text-slate-600 mt-0.5">{dealer.address}</p>}
                        {dealer.phone   && <p className="text-sm text-slate-600">Tel: {dealer.phone}</p>}
                        {dealer.email   && <p className="text-sm text-slate-600">{dealer.email}</p>}
                        {dealer.orgNr   && <p className="text-sm text-slate-600">Org.nr: {dealer.orgNr}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Köpare</p>
                        <p className="font-bold text-slate-900">{d.customerName || '—'}</p>
                        {d.personnummer     && <p className="text-sm text-slate-600">Personnr: {d.personnummer}</p>}
                        {d.customerAddress  && <p className="text-sm text-slate-600 mt-0.5">{d.customerAddress}</p>}
                        {d.customerPhone    && <p className="text-sm text-slate-600">Tel: {d.customerPhone}</p>}
                        {d.customerEmail    && <p className="text-sm text-slate-600">{d.customerEmail}</p>}
                      </div>
                    </div>

                    {/* ── Vehicle ── */}
                    <DocSection title="Fordon">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                        <div>
                          <DocLine label="Märke / modell / årsmodell" value={d.vehicle || '—'} />
                          <DocLine label="Chassinummer (VIN)" value={d.vin || '—'} />
                          <DocLine label="Registreringsnummer" value={d.registrationNumber || '—'} />
                        </div>
                        <div>
                          <DocLine label="Färg" value={d.vehicleColor || '—'} />
                          <DocLine label="Skick" value={d.vehicleCondition === 'new' ? 'Ny' : 'Begagnad'} />
                        </div>
                      </div>
                    </DocSection>

                    {/* ── Pricing ── */}
                    <DocSection title="Priskalkyl">
                      <DocLine label="Ordinarie pris inkl. moms" value={fmt(d.listPrice)} />
                      {d.discount > 0 && <DocLine label="Rabatt" value={`− ${fmt(d.discount)}`} negative indent />}
                      {d.discount > 0 && <DocLine label="Fordonspris efter rabatt" value={fmt(priceAfterDiscount)} bold />}
                      {d.accessories && (
                        parsedAccessories
                          ? parsedAccessories.map(item => (
                              <DocLine key={item.id} indent
                                label={`${item.name} (${item.articleNumber})${item.qty > 1 ? ` × ${item.qty}` : ''}`}
                                value={`+ ${fmt(item.qty * item.unitPrice)}`}
                              />
                            ))
                          : <DocLine label={`Tillbehör: ${d.accessories}`} value={`+ ${fmt(d.accessoriesCost)}`} indent />
                      )}
                      {d.tradeIn && (
                        <DocLine label={`Inbyte: ${d.tradeIn}`} value={`− ${fmt(d.tradeInCredit)}`} negative indent />
                      )}
                      {/* Separator + total */}
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

                    {/* ── Financing ── */}
                    {d.paymentType === 'financing' ? (
                      <DocSection title="Finansieringsinformation (Konsumentkreditlagen 2010:1846)">
                        <div className="grid grid-cols-2 gap-x-8">
                          <div>
                            <DocLine label="Totalt att betala inkl. moms"  value={fmt(d.totalPrice)} />
                            <DocLine label="Kontantinsats"                  value={fmt(d.downPayment)} />
                            <DocLine label="Kreditbelopp"                   value={fmt(creditAmount)} bold />
                            <DocLine label="Löptid"                         value={`${d.financingMonths} månader`} />
                          </div>
                          <div>
                            <DocLine label="Nominell ränta"                 value={`${d.nominalRate} %`} />
                            <DocLine label="Effektiv ränta (APR)"           value={`${d.financingApr} %`} />
                            <DocLine label="Månadskostnad"                  value={fmt(d.financingMonthly)} bold />
                            <DocLine label="Totalt kreditbelopp"            value={fmt(totalCredit)} />
                            <DocLine label="Totalkostnad (inkl. kontantins.)" value={fmt(totalCreditCost)} bold highlight />
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                          Kredit lämnas av återförsäljaren i samarbete med finansieringspartner. Erbjudandet förutsätter godkänd kreditprövning.
                          Effektiv ränta beräknad på kreditbeloppet {fmt(creditAmount)} med {d.financingMonths} månaders löptid, {d.financingApr}% effektiv ränta och {d.financingMonths} likvärdiga månadskostnader om {fmt(d.financingMonthly)}.
                        </p>
                      </DocSection>
                    ) : (
                      <DocSection title="Betalningsinformation">
                        <DocLine label="Betalningssätt" value="Kontant betalning" bold />
                        <p className="text-xs text-slate-500 mt-2">Hela beloppet {fmt(d.totalPrice)} betalas kontant vid leverans.</p>
                      </DocSection>
                    )}

                    {/* ── Delivery & terms ── */}
                    <DocSection title="Leverans &amp; villkor">
                      <DocLine label="Beräknad leveranstid" value={`ca ${d.deliveryWeeks} veckor från beställning`} />
                      <DocLine label="Leveransort"          value={dealer.address || '—'} />
                      {d.validUntil && <DocLine label="Offerten giltig till" value={fmtDate(d.validUntil)} bold />}
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-slate-600">• Priserna inkluderar 25% mervärdesskatt (moms).</p>
                        <p className="text-xs text-slate-600">• Offerten är bindande för säljaren under giltighetstiden.</p>
                        <p className="text-xs text-slate-600">• Fordonet levereras med 3 års garanti (Konsumentköplagen 2022:260).</p>
                        {d.notes && <p className="text-xs text-slate-600">• {d.notes}</p>}
                      </div>
                    </DocSection>

                    {/* ── Signatures note ── */}
                    <DocSection title="Underskrifter">
                      <div className="flex items-center gap-3 bg-[#FF6B2C]/5 border border-[#FF6B2C]/20 rounded-xl px-4 py-3">
                        <span className="text-lg shrink-0">📝</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Underskrifter sker på köpeavtalet</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Acceptera offerten för att generera köpeavtalet där båda parter signerar digitalt med BankID.
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-8 mt-5">
                        <div>
                          <div className="border-b-2 border-slate-200 h-10 mb-1" />
                          <p className="text-xs font-semibold text-slate-600">Säljarens underskrift — {dealer.name}</p>
                        </div>
                        <div>
                          <div className="border-b-2 border-slate-200 h-10 mb-1" />
                          <p className="text-xs font-semibold text-slate-600">Köparens underskrift — {d.customerName || '—'}</p>
                        </div>
                      </div>
                    </DocSection>

                  </div>

                  {/* ── Footer ── */}
                  <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">
                      {dealer.name} • {dealer.address} • {dealer.phone} • {dealer.email}
                      {dealer.orgNr && ` • Org.nr ${dealer.orgNr}`}
                    </p>
                  </div>

                </div>

                {/* ── Accepted banner ── */}
                {d.status === 'accepted' && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-4 no-print">
                    <div>
                      <p className="font-semibold text-emerald-800">Offert accepterad!</p>
                      <p className="text-sm text-emerald-600 mt-0.5">Avtalet är förfyllt med offertens uppgifter.</p>
                    </div>
                    <Link href={`/sales/leads/${leadId}/agreement`}
                      className="shrink-0 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                      Öppna avtal →
                    </Link>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
