'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import FinancingComparison from '@/components/offer/FinancingComparison';
import TradeInModal from '@/components/offer/TradeInModal';
import { getSupabaseBrowser } from '@/lib/supabase';
import { getDealershipId, getDealershipProfile } from '@/lib/tenant';
import {
  generateOfferNumber,
  type Offer,
  type OfferStatus,
  type PaymentType,
  type VehicleCondition,
  type VehicleLineItem,
  type TradeInData,
} from '@/lib/offers';
import { emit, useAutoRefresh } from '@/lib/realtime';
import { useInventory } from '@/context/InventoryContext';

// ─── PMT helper ───────────────────────────────────────────────────────────────

function calcPMT(principal: number, annualNominalPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualNominalPct / 12 / 100;
  if (r < 0.000001) return Math.round(principal / months);
  const pmt = (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(pmt);
}

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
  // Primary vehicle
  vehicle:            string;
  vehicleColor:       string;
  vehicleCondition:   VehicleCondition;
  vin:                string;
  registrationNumber: string;
  listPrice:          number;
  discount:           number;
  // Extra vehicles (multi-vehicle deal)
  extraVehicles:      VehicleLineItem[];
  // Accessories (JSON array or '')
  accessories:        string;
  accessoriesCost:    number;
  // Trade-ins (array — multiple motorcycles can be traded in)
  tradeIns:           TradeInData[];  // source of truth; tradeIn/tradeInCredit derived
  tradeIn:            string;         // derived label for display + DB compat
  tradeInCredit:      number;         // derived sum of offeredCredit
  tradeInData:        TradeInData | null; // kept for DB compat (null when using array)
  // Totals
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
  // BankID signatures
  sellerSignature:    string;
  buyerSignature:     string;
}

const BLANK: OfferForm = {
  offerNumber: '', status: 'draft',
  customerName: '', personnummer: '', customerAddress: '', customerPhone: '', customerEmail: '',
  vehicle: '', vehicleColor: '', vehicleCondition: 'new', vin: '', registrationNumber: '',
  listPrice: 0, discount: 0,
  extraVehicles: [],
  accessories: '', accessoriesCost: 0,
  tradeIns: [], tradeIn: '', tradeInCredit: 0, tradeInData: null,
  totalPrice: 0, vatAmount: 0,
  paymentType: 'cash', downPayment: 0, financingMonths: 36,
  financingMonthly: 0, financingApr: 4.9, nominalRate: 4.9,
  deliveryWeeks: 4, validUntil: '', notes: '',
  sellerSignature: '', buyerSignature: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OfferStatus, { label: string; dot: string; badge: string }> = {
  draft:    { label: 'Utkast',     dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600' },
  sent:     { label: 'Skickad',    dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  accepted: { label: 'Accepterad', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  declined: { label: 'Avböjd',     dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600' },
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

function NumIn({ value, onChange, step = 1, suffix, min = 0 }: {
  value: number; onChange: (v: number) => void; step?: number; suffix?: string; min?: number;
}) {
  return (
    <div className="relative">
      <input type="number" value={value || ''} min={min} step={step}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className={`${inputCls} ${suffix ? 'pr-12' : ''}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
    </div>
  );
}

// ─── Document view helpers ─────────────────────────────────────────────────────

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

function AccessoriesPicker({
  items, onItemsChange,
}: { items: AccessoryLineItem[]; onItemsChange: (items: AccessoryLineItem[]) => void }) {
  const { spareParts, accessories: inv } = useInventory();
  const [search, setSearch] = useState('');
  const [open,   setOpen]   = useState(false);

  const catalog = useMemo<AccessoryLineItem[]>(() => [
    ...spareParts.map(p => ({ id: p.id, name: p.name, articleNumber: p.articleNumber, brand: p.brand, qty: 1, unitPrice: p.sellingPrice })),
    ...inv.map(a => ({ id: a.id, name: a.name, articleNumber: a.articleNumber, brand: a.brand, qty: 1, unitPrice: a.sellingPrice })),
  ], [spareParts, inv]);

  const q        = search.trim().toLowerCase();
  const filtered = q ? catalog.filter(c => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q) || c.articleNumber.toLowerCase().includes(q)) : catalog.slice(0, 10);
  const selIds   = new Set(items.map(i => i.id));

  return (
    <div className="sm:col-span-2 space-y-2">
      <label className="block text-xs font-semibold text-slate-500">Tillbehör &amp; reservdelar <span className="font-normal text-slate-400">(sök och lägg till)</span></label>
      <div className="relative">
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Sök artikel…" className={inputCls + ' pr-9'} />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {filtered.map(item => (
              <button key={item.id} onMouseDown={() => { if (!selIds.has(item.id)) { onItemsChange([...items, { ...item, qty: 1 }]); setSearch(''); setOpen(false); } }}
                disabled={selIds.has(item.id)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors ${selIds.has(item.id) ? 'opacity-40' : ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.brand} · {item.articleNumber}</p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-700 shrink-0">{fmt(item.unitPrice)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-400">{item.articleNumber}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => { if (item.qty > 1) onItemsChange(items.map(i => i.id === item.id ? { ...i, qty: i.qty - 1 } : i)); }}
                  disabled={item.qty <= 1} className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-sm font-bold text-slate-600 flex items-center justify-center">−</button>
                <span className="w-5 text-center text-sm font-semibold text-slate-900">{item.qty}</span>
                <button onClick={() => onItemsChange(items.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 flex items-center justify-center">+</button>
              </div>
              <span className="w-24 text-right text-sm font-mono font-semibold text-slate-700 shrink-0">{fmt(item.qty * item.unitPrice)}</span>
              <button onClick={() => onItemsChange(items.filter(i => i.id !== item.id))}
                className="w-6 h-6 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 flex items-center justify-center text-xs font-bold shrink-0">✕</button>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Totalt tillbehör inkl. moms</span>
            <span className="text-sm font-bold text-slate-900 font-mono">{fmt(items.reduce((s, i) => s + i.qty * i.unitPrice, 0))}</span>
          </div>
        </div>
      )}
      {catalog.length === 0 && <p className="text-xs text-slate-400 italic">Inget lager — lägg till artiklar under Lager.</p>}
    </div>
  );
}

// ─── VehicleRow (one vehicle in the multi-vehicle editor) ─────────────────────

function VehicleRow({
  v, idx, isExtra, onChange, onRemove,
}: {
  v: VehicleLineItem | OfferForm;
  idx: number;
  isExtra: boolean;
  onChange: (field: string, value: string | number) => void;
  onRemove?: () => void;
}) {
  const netPrice = (v as VehicleLineItem).listPrice - (v as VehicleLineItem).discount;
  return (
    <div className={`rounded-xl border ${isExtra ? 'border-[#FF6B2C]/30 bg-[#FF6B2C]/3' : 'border-slate-200 bg-white'} p-4 space-y-3`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {isExtra ? `Fordon ${idx + 1}` : 'Fordon 1 (primärt)'}
        </p>
        {isExtra && onRemove && (
          <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600 font-semibold px-2 py-0.5 rounded hover:bg-red-50 transition-colors">
            Ta bort
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <F label="Märke, modell och årsmodell">
          <TxtIn value={(v as OfferForm).vehicle ?? ''} onChange={val => onChange('vehicle', val)} placeholder="Kawasaki Ninja ZX-6R 2024" />
        </F>
        <F label="Färg">
          <TxtIn value={(v as OfferForm).vehicleColor ?? ''} onChange={val => onChange('vehicleColor', val)} placeholder="Metallic svart" />
        </F>
        <F label="Skick">
          <select value={(v as OfferForm).vehicleCondition ?? 'new'} onChange={e => onChange('vehicleCondition', e.target.value)} className={inputCls}>
            <option value="new">Ny</option>
            <option value="used">Begagnad</option>
          </select>
        </F>
        <F label="Chassinummer (VIN)">
          <TxtIn value={(v as OfferForm).vin ?? ''} onChange={val => onChange('vin', val)} placeholder="JKBZXR636PA012345" />
        </F>
        <F label="Registreringsnummer">
          <TxtIn value={(v as OfferForm).registrationNumber ?? ''} onChange={val => onChange('registrationNumber', val)} placeholder="ABC123" />
        </F>
        <div className="flex gap-2">
          <div className="flex-1">
            <F label="Pris inkl. moms">
              <NumIn value={(v as VehicleLineItem).listPrice ?? 0} onChange={val => onChange('listPrice', val)} suffix="kr" />
            </F>
          </div>
          <div className="flex-1">
            <F label="Rabatt">
              <NumIn value={(v as VehicleLineItem).discount ?? 0} onChange={val => onChange('discount', val)} suffix="kr" />
            </F>
            {(v as VehicleLineItem).listPrice > 0 && (v as VehicleLineItem).discount > 0 && (
              <p className="text-xs text-emerald-600 mt-1 font-semibold">
                🏷️ {((((v as VehicleLineItem).discount) / (v as VehicleLineItem).listPrice) * 100).toFixed(1)}% rabatt
              </p>
            )}
          </div>
        </div>
      </div>
      {((v as VehicleLineItem).listPrice > 0) && (
        <div className="text-right text-xs text-slate-500 pt-1">
          Fordonspris efter rabatt: <span className="font-bold text-slate-800">{fmt(Math.max(0, netPrice))}</span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OfferPage() {
  const router   = useRouter();
  const params   = useParams();
  const printRef = useRef<HTMLDivElement>(null);
  const leadId   = Number((params?.id as string) || '0');

  const [ready,               setReady]               = useState(false);
  const [saving,              setSaving]              = useState(false);
  const [offerId,             setOfferId]             = useState<number | null>(null);
  const [form,                setForm]                = useState<OfferForm>(BLANK);
  const [isEditing,           setIsEditing]           = useState(false);
  const [draft,               setDraft]               = useState<OfferForm | null>(null);
  const [dealer,              setDealer]              = useState({ name: '', address: '', phone: '', email: '', orgNr: '' });
  const [selectedAccessories, setSelectedAccessories] = useState<AccessoryLineItem[]>([]);
  const [showFinancing,       setShowFinancing]       = useState(false);
  // null = modal closed, -1 = adding new trade-in, ≥0 = editing that index
  const [tradeInEditIdx,      setTradeInEditIdx]      = useState<number | null>(null);

  // ── Auto-refresh ──────────────────────────────────────────────────────────

  useAutoRefresh(async () => {
    const dealershipId = getDealershipId();
    if (!dealershipId || !leadId || Number.isNaN(leadId) || isEditing) return;
    const res = await fetch(`/api/offers?leadId=${leadId}&dealershipId=${dealershipId}`);
    const { offer: refreshed }: { offer: Offer | null } = await res.json();
    if (refreshed) hydrateForm(refreshed);
  });

  // ── Hydrate form from DB offer ────────────────────────────────────────────

  function hydrateForm(o: Offer) {
    setOfferId(o.id);
    setForm({
      offerNumber: o.offerNumber, status: o.status,
      customerName: o.customerName, personnummer: o.personnummer,
      customerAddress: o.customerAddress, customerPhone: o.customerPhone, customerEmail: o.customerEmail,
      vehicle: o.vehicle, vehicleColor: o.vehicleColor, vehicleCondition: o.vehicleCondition,
      vin: o.vin, registrationNumber: o.registrationNumber,
      listPrice: o.listPrice, discount: o.discount,
      extraVehicles: o.extraVehicles ?? [],
      accessories: o.accessories, accessoriesCost: o.accessoriesCost,
      tradeIns: (() => {
        const raw = o.tradeInData;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw as TradeInData[];
        return [raw as TradeInData];
      })(),
      tradeIn: o.tradeIn, tradeInCredit: o.tradeInCredit, tradeInData: o.tradeInData ?? null,
      totalPrice: o.totalPrice, vatAmount: o.vatAmount,
      paymentType: o.paymentType, downPayment: o.downPayment,
      financingMonths: o.financingMonths, financingMonthly: o.financingMonthly,
      financingApr: o.financingApr, nominalRate: o.nominalRate,
      deliveryWeeks: o.deliveryWeeks, validUntil: o.validUntil ?? '', notes: o.notes,
      sellerSignature: o.sellerSignature ?? '',
      buyerSignature:  o.buyerSignature  ?? '',
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
      const [{ data: lead }, offerRes, settingsRes] = await Promise.all([
        sb.from('leads').select('name, personnummer, bike, value, phone, email, address, city').eq('id', leadId).eq('dealership_id', dealershipId).maybeSingle(),
        fetch(`/api/offers?leadId=${leadId}&dealershipId=${dealershipId}`),
        sb.from('dealership_settings').select('standard_discount_pct').eq('dealership_id', dealershipId).maybeSingle(),
      ]);
      const { offer: existing }: { offer: Offer | null } = await offerRes.json();

      // Standard discount from dealership settings (fallback 5 %)
      const stdDiscountPct: number = settingsRes?.data?.standard_discount_pct ?? 5;

      if (existing) {
        hydrateForm(existing);
      } else if (lead) {
        const listP    = parseFloat(String(lead.value ?? '0')) || 0;
        const discount = Math.round(listP * stdDiscountPct / 100);
        const netP     = Math.max(0, listP - discount);
        const vat      = Math.round(netP * 0.2);
        setForm(prev => ({
          ...prev,
          offerNumber:     generateOfferNumber(),
          customerName:    lead.name        ?? '',
          personnummer:    lead.personnummer ?? '',
          customerAddress: [lead.address, lead.city].filter(Boolean).join(', '),
          customerPhone:   lead.phone       ?? '',
          customerEmail:   lead.email       ?? '',
          vehicle:         lead.bike        ?? '',
          listPrice:       listP,
          discount,
          totalPrice:      netP,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, router]);

  // ── Computed totals ────────────────────────────────────────────────────────

  function recompute(f: OfferForm): OfferForm {
    const primaryNet      = Math.max(0, f.listPrice - f.discount);
    const extraNet        = f.extraVehicles.reduce((s, v) => s + Math.max(0, v.listPrice - v.discount), 0);
    // Derive tradeInCredit and tradeIn label from the tradeIns array
    const tradeInCredit   = f.tradeIns.reduce((s, t) => s + (t.offeredCredit || 0), 0);
    const tradeIn         = f.tradeIns
      .map(t => [t.make, t.model, t.year > 0 ? t.year : ''].filter(Boolean).join(' '))
      .join(', ');
    const base            = primaryNet + extraNet + f.accessoriesCost - tradeInCredit;
    const total           = Math.max(0, base);
    const vat             = Math.round(total * 0.2);
    const newMonthly      = f.paymentType === 'financing'
      ? calcPMT(Math.max(0, total - f.downPayment), f.nominalRate, f.financingMonths)
      : f.financingMonthly;
    return { ...f, tradeIn, tradeInCredit, totalPrice: total, vatAmount: vat, financingMonthly: newMonthly };
  }

  function update<K extends keyof OfferForm>(key: K, value: OfferForm[K]) {
    setDraft(d => {
      if (!d) return d;
      const next = { ...d, [key]: value };
      const priceAffecting: (keyof OfferForm)[] = [
        'listPrice', 'discount', 'accessoriesCost', 'tradeIns', 'tradeInCredit',
        'extraVehicles', 'downPayment', 'nominalRate', 'financingMonths', 'paymentType',
      ];
      if (priceAffecting.includes(key)) return recompute(next);
      return next;
    });
  }

  function syncAccessories(items: AccessoryLineItem[]) {
    setSelectedAccessories(items);
    const total = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const str   = items.length > 0 ? JSON.stringify(items) : '';
    update('accessories', str);
    setDraft(d => d ? recompute({ ...d, accessories: str, accessoriesCost: total }) : d);
  }

  // ── Extra vehicles ────────────────────────────────────────────────────────

  function addExtraVehicle() {
    const newVehicle: VehicleLineItem = {
      id: crypto.randomUUID(),
      vehicle: '', vehicleColor: '', vehicleCondition: 'new',
      vin: '', registrationNumber: '', listPrice: 0, discount: 0,
    };
    update('extraVehicles', [...(draft?.extraVehicles ?? []), newVehicle]);
  }

  function updateExtraVehicle(id: string, field: string, value: string | number) {
    setDraft(d => {
      if (!d) return d;
      const updated = d.extraVehicles.map(v =>
        v.id === id ? { ...v, [field]: value } : v
      );
      return recompute({ ...d, extraVehicles: updated });
    });
  }

  function removeExtraVehicle(id: string) {
    setDraft(d => {
      if (!d) return d;
      return recompute({ ...d, extraVehicles: d.extraVehicles.filter(v => v.id !== id) });
    });
  }

  // ── Trade-ins (multi) ────────────────────────────────────────────────────

  function applyTradeIn(data: TradeInData) {
    setDraft(d => {
      if (!d) return d;
      const idx  = tradeInEditIdx ?? -1;
      const list = idx >= 0
        ? d.tradeIns.map((t, i) => i === idx ? data : t)
        : [...d.tradeIns, data];
      return recompute({ ...d, tradeIns: list });
    });
    setTradeInEditIdx(null);
  }

  function removeTradeIn(idx: number) {
    setDraft(d => {
      if (!d) return d;
      return recompute({ ...d, tradeIns: d.tradeIns.filter((_, i) => i !== idx) });
    });
  }

  // ── Financing comparison apply ────────────────────────────────────────────

  function applyFinancing(months: number, monthly: number, nominalRate: number, apr: number) {
    setDraft(d => d ? recompute({ ...d, financingMonths: months, financingMonthly: monthly, nominalRate, financingApr: apr }) : d);
    setShowFinancing(false);
    toast.success(`Finansiering vald: ${months} mån · ${fmt(monthly)}/mån`);
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
          body: JSON.stringify({ dealershipId, stage: 'offer', fromStages: ['new', 'contacted', 'testride'] }),
        });
      }
      emit({ type: 'lead:updated', payload: { id: String(leadId), status: '' } });
      emit({ type: 'data:refresh' });
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

  // ── Render guards ─────────────────────────────────────────────────────────

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f7fa]">
      <div className="w-10 h-10 border-4 border-[#FF6B2C] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const d    = isEditing && draft ? draft : form;
  const scfg = STATUS_CFG[d.status];

  // Computed display values
  const primaryNet     = Math.max(0, d.listPrice - d.discount);
  const extraTotal     = d.extraVehicles.reduce((s, v) => s + Math.max(0, v.listPrice - v.discount), 0);
  const exVat          = Math.round(d.totalPrice / 1.25);

  // Parse accessories JSON
  let parsedAcc: AccessoryLineItem[] | null = null;
  if (d.accessories) {
    try {
      const p = JSON.parse(d.accessories);
      if (Array.isArray(p) && p[0]?.id) parsedAcc = p as AccessoryLineItem[];
    } catch { /* plain text */ }
  }

  const today = new Date().toLocaleDateString('sv-SE');

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .offer-doc { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>

      <div className="flex min-h-screen bg-[#f5f7fa]">
        <div className="no-print"><Sidebar /></div>

        <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
          <div className="brand-top-bar no-print" />

          {/* ── Top bar ──────────────────────────────────────────────────── */}
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
                {d.extraVehicles.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FF6B2C]/10 text-[#FF6B2C]">
                    {1 + d.extraVehicles.length} fordon
                  </span>
                )}
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
                  }} className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    ✏️ Redigera
                  </button>
                  <button onClick={() => window.print()} className="px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
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
                    {saving ? <><span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />Sparar…</> : 'Spara offert'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <div className="flex-1 p-4 md:p-6">
            {isEditing ? (

              /* ════════════════════ EDIT FORM ════════════════════ */
              <div className="max-w-3xl mx-auto space-y-5">

                {/* ─ Live price summary strip ─ */}
                <div className="bg-[#0b1524] text-white rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[120px]">
                    <p className="text-xs text-white/50 uppercase tracking-wider">Totalpris inkl. moms</p>
                    <p className="text-2xl font-black text-white">{fmt(draft!.totalPrice)}</p>
                  </div>
                  {draft!.extraVehicles.length > 0 && (
                    <div className="min-w-[120px]">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Fordon ({1 + draft!.extraVehicles.length} st)</p>
                      <p className="text-base font-bold text-[#FF6B2C]">{fmt(primaryNet + extraTotal)}</p>
                    </div>
                  )}
                  {draft!.accessoriesCost > 0 && (
                    <div className="min-w-[100px]">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Tillbehör</p>
                      <p className="text-base font-bold text-white/80">+{fmt(draft!.accessoriesCost)}</p>
                    </div>
                  )}
                  {draft!.tradeInCredit > 0 && (
                    <div className="min-w-[100px]">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Inbyte</p>
                      <p className="text-base font-bold text-emerald-400">−{fmt(draft!.tradeInCredit)}</p>
                    </div>
                  )}
                  <div className="min-w-[100px]">
                    <p className="text-xs text-white/50 uppercase tracking-wider">Moms (25%)</p>
                    <p className="text-sm text-white/60">{fmt(draft!.vatAmount)}</p>
                  </div>
                  {draft!.paymentType === 'financing' && draft!.financingMonthly > 0 && (
                    <div className="min-w-[120px] border-l border-white/10 pl-4">
                      <p className="text-xs text-white/50 uppercase tracking-wider">Månadsbetalning</p>
                      <p className="text-xl font-black text-[#FF6B2C]">{fmt(draft!.financingMonthly)}</p>
                      <p className="text-xs text-white/40">{draft!.financingMonths} mån · {draft!.nominalRate}%</p>
                    </div>
                  )}
                </div>

                {/* ─ Customer ─ */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Kundinformation</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <F label="För- och efternamn">
                      <TxtIn value={draft!.customerName} onChange={v => update('customerName', v)} placeholder="Anna Andersson" />
                    </F>
                    <F label="Personnummer">
                      <TxtIn value={draft!.personnummer} onChange={v => update('personnummer', v)} placeholder="YYYYMMDD-XXXX" />
                    </F>
                    <F label="Adress">
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

                {/* ─ Vehicles (multi) ─ */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Fordon</p>
                    <button onClick={addExtraVehicle}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#FF6B2C] hover:text-[#e55a1f] transition-colors px-3 py-1.5 rounded-lg border border-[#FF6B2C]/30 hover:bg-[#FF6B2C]/5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Lägg till fordon
                    </button>
                  </div>
                  <div className="space-y-4">
                    {/* Primary vehicle */}
                    <VehicleRow
                      v={{ ...draft!, id: 'primary' } as VehicleLineItem}
                      idx={0} isExtra={false}
                      onChange={(field, value) => update(field as keyof OfferForm, value as OfferForm[keyof OfferForm])}
                    />
                    {/* Extra vehicles */}
                    {draft!.extraVehicles.map((v, i) => (
                      <VehicleRow
                        key={v.id} v={v} idx={i + 1} isExtra
                        onChange={(field, value) => updateExtraVehicle(v.id, field, value)}
                        onRemove={() => removeExtraVehicle(v.id)}
                      />
                    ))}
                  </div>
                  {draft!.extraVehicles.length > 0 && (
                    <div className="mt-4 bg-[#FF6B2C]/5 rounded-xl px-4 py-2.5 flex justify-between items-center border border-[#FF6B2C]/20">
                      <span className="text-sm font-semibold text-slate-700">Total fordonspost ({1 + draft!.extraVehicles.length} fordon)</span>
                      <span className="text-base font-bold text-[#FF6B2C]">{fmt(primaryNet + extraTotal)}</span>
                    </div>
                  )}
                </div>

                {/* ─ Accessories ─ */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Tillbehör &amp; reservdelar</p>
                  <div className="grid grid-cols-1 gap-3">
                    <AccessoriesPicker items={selectedAccessories} onItemsChange={syncAccessories} />
                  </div>
                </div>

                {/* ─ Trade-ins (multi) ─ */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Inbyte</p>
                      {draft!.tradeIns.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {draft!.tradeIns.length} fordon · totalt −{fmt(draft!.tradeInCredit)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setTradeInEditIdx(-1)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#FF6B2C] hover:text-[#e55a1f] px-3 py-1.5 rounded-lg border border-[#FF6B2C]/30 hover:bg-[#FF6B2C]/5 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Lägg till inbyte
                    </button>
                  </div>

                  {draft!.tradeIns.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                      Inget inbyte — klicka "Lägg till inbyte" för att lägga till ett eller flera fordon
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {draft!.tradeIns.map((ti, idx) => {
                        const condLabel: Record<string, string> = { excellent:'Utmärkt', good:'Bra', fair:'OK', poor:'Sliten', damaged:'Skadad' };
                        return (
                          <div key={idx} className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-emerald-800 bg-emerald-200 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <p className="text-sm font-bold text-slate-900 truncate">
                                    {[ti.make, ti.model, ti.year > 0 ? ti.year : ''].filter(Boolean).join(' ') || 'Okänt fordon'}
                                  </p>
                                </div>
                                <p className="text-xs text-slate-500 mt-1 ml-7">
                                  {ti.mileage > 0 && `${ti.mileage.toLocaleString('sv-SE')} ${ti.mileageUnit} · `}
                                  {condLabel[ti.condition] ?? ti.condition}
                                  {ti.color && ` · ${ti.color}`}
                                </p>
                                {ti.notes && <p className="text-xs text-slate-400 ml-7 mt-0.5 italic truncate">{ti.notes}</p>}
                              </div>
                              <div className="text-right shrink-0">
                                {ti.estimatedValue > 0 && (
                                  <p className="text-xs text-slate-400">Uppsk. {fmt(ti.estimatedValue)}</p>
                                )}
                                <p className="text-base font-bold text-emerald-700">−{fmt(ti.offeredCredit)}</p>
                                <div className="flex gap-2 justify-end mt-1">
                                  <button
                                    onClick={() => setTradeInEditIdx(idx)}
                                    className="text-[10px] font-semibold text-[#FF6B2C] hover:underline"
                                  >Redigera</button>
                                  <button
                                    onClick={() => removeTradeIn(idx)}
                                    className="text-[10px] font-semibold text-red-400 hover:text-red-600 hover:underline"
                                  >Ta bort</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ─ Payment ─ */}
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
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                      <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-blue-800">Finansieringsvillkor bestäms av banken</p>
                        <p className="text-xs text-blue-600 mt-0.5">Ränta, löptid och månadsbetalning väljs av kunden i betalningssteget. Banken (Svea, Santander, Klarna m.fl.) godkänner och fastställer alla villkor.</p>
                      </div>
                    </div>
                  )}

                </div>

                {/* ─ Delivery ─ */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Leverans &amp; villkor</p>
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
                          rows={3} placeholder="Leveransvillkor, garanti, övrigt…" className={`${inputCls} resize-none`} />
                      </F>
                    </div>
                  </div>
                </div>

              </div>

            ) : (

              /* ════════════════════ DOCUMENT VIEW ════════════════════ */
              <div ref={printRef} className="max-w-3xl mx-auto">
                <div className="offer-doc bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

                  {/* Header */}
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

                    {/* Parties */}
                    <div className="grid grid-cols-2 gap-6 mb-8 pb-6 border-b border-slate-100">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Säljare</p>
                        <p className="font-bold text-slate-900">{dealer.name}</p>
                        {dealer.address && <p className="text-sm text-slate-600 mt-0.5">{dealer.address}</p>}
                        {dealer.phone && <p className="text-sm text-slate-600">Tel: {dealer.phone}</p>}
                        {dealer.email && <p className="text-sm text-slate-600">{dealer.email}</p>}
                        {dealer.orgNr && <p className="text-sm text-slate-600">Org.nr: {dealer.orgNr}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Köpare</p>
                        <p className="font-bold text-slate-900">{d.customerName || '—'}</p>
                        {d.personnummer && <p className="text-sm text-slate-600">Personnr: {d.personnummer}</p>}
                        {d.customerAddress && <p className="text-sm text-slate-600 mt-0.5">{d.customerAddress}</p>}
                        {d.customerPhone && <p className="text-sm text-slate-600">Tel: {d.customerPhone}</p>}
                        {d.customerEmail && <p className="text-sm text-slate-600">{d.customerEmail}</p>}
                      </div>
                    </div>

                    {/* Vehicles — all of them */}
                    <DocSection title={d.extraVehicles.length > 0 ? `Fordon (${1 + d.extraVehicles.length} st)` : 'Fordon'}>
                      {/* Primary */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-0">
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
                      {/* Extra vehicles */}
                      {d.extraVehicles.map((v, i) => (
                        <div key={v.id} className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Fordon {i + 2}</p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                            <div>
                              <DocLine label="Märke / modell / årsmodell" value={v.vehicle || '—'} />
                              <DocLine label="Chassinummer (VIN)" value={v.vin || '—'} />
                            </div>
                            <div>
                              <DocLine label="Färg" value={v.vehicleColor || '—'} />
                              <DocLine label="Skick" value={v.vehicleCondition === 'new' ? 'Ny' : 'Begagnad'} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </DocSection>

                    {/* Pricing */}
                    <DocSection title="Priskalkyl">
                      {/* Primary vehicle line */}
                      <DocLine label={d.vehicle || 'Fordon 1'} value={fmt(d.listPrice)} />
                      {d.discount > 0 && <DocLine label="  Rabatt" value={`− ${fmt(d.discount)}`} negative indent />}
                      {/* Extra vehicles */}
                      {d.extraVehicles.map((v, i) => (
                        <div key={v.id}>
                          <DocLine label={v.vehicle || `Fordon ${i + 2}`} value={fmt(v.listPrice)} />
                          {v.discount > 0 && <DocLine label="  Rabatt" value={`− ${fmt(v.discount)}`} negative indent />}
                        </div>
                      ))}
                      {/* Accessories */}
                      {d.accessories && (
                        parsedAcc
                          ? parsedAcc.map(item => (
                              <DocLine key={item.id} indent
                                label={`${item.name} (${item.articleNumber})${item.qty > 1 ? ` × ${item.qty}` : ''}`}
                                value={`+ ${fmt(item.qty * item.unitPrice)}`}
                              />
                            ))
                          : <DocLine label={`Tillbehör: ${d.accessories}`} value={`+ ${fmt(d.accessoriesCost)}`} indent />
                      )}
                      {/* Trade-ins */}
                      {d.tradeIns.map((ti, i) => (
                        <DocLine
                          key={i} negative indent
                          label={`Inbyte ${d.tradeIns.length > 1 ? i + 1 : ''}: ${[ti.make, ti.model, ti.year || ''].filter(Boolean).join(' ') || 'Okänt fordon'}`}
                          value={`− ${fmt(ti.offeredCredit)}`}
                        />
                      ))}
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

                    {/* Financing / Cash */}
                    <DocSection title="Betalningsinformation">
                      <DocLine label="Betalningssätt" value={d.paymentType === 'financing' ? 'Finansiering' : 'Kontant betalning'} bold />
                      <DocLine label="Totalt att betala inkl. moms" value={fmt(d.totalPrice)} bold />
                      {d.paymentType === 'financing' ? (
                        <p className="text-xs text-slate-500 mt-2">
                          Finansiering sker via godkänd kreditgivare (t.ex. Svea, Santander eller Klarna). Ränta, löptid och månadsbetalning fastställs av banken efter kreditprövning och bekräftas i betalningssteget. Erbjudandet förutsätter godkänd kreditprövning.
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-2">Hela beloppet {fmt(d.totalPrice)} betalas kontant vid leverans.</p>
                      )}
                    </DocSection>

                    {/* Trade-in details (structured, one section per vehicle) */}
                    {d.tradeIns.length > 0 && d.tradeIns.map((ti, i) => (
                      <DocSection key={i} title={`Inbyte ${d.tradeIns.length > 1 ? i + 1 : ''} — Värderingsunderlag`}>
                        <div className="grid grid-cols-2 gap-x-6">
                          <div>
                            <DocLine label="Märke / Modell" value={`${ti.make} ${ti.model}`.trim() || '—'} />
                            <DocLine label="Årsmodell" value={ti.year > 0 ? String(ti.year) : '—'} />
                            <DocLine label="Mätarställning" value={`${ti.mileage.toLocaleString('sv-SE')} ${ti.mileageUnit}`} />
                          </div>
                          <div>
                            <DocLine label="Skick" value={{ excellent: 'Utmärkt', good: 'Bra', fair: 'OK', poor: 'Sliten', damaged: 'Skadad' }[ti.condition] ?? ti.condition} />
                            {ti.color && <DocLine label="Färg" value={ti.color} />}
                            {ti.vin && <DocLine label="VIN" value={ti.vin} />}
                          </div>
                        </div>
                        {ti.notes && <p className="text-xs text-slate-500 mt-2 italic">Anteckningar: {ti.notes}</p>}
                        <DocLine label="Avtalat inbytesvärde" value={`− ${fmt(ti.offeredCredit)}`} bold negative />
                      </DocSection>
                    ))}

                    {/* Delivery */}
                    <DocSection title="Leverans &amp; villkor">
                      <DocLine label="Beräknad leveranstid" value={`ca ${d.deliveryWeeks} veckor från beställning`} />
                      <DocLine label="Leveransort" value={dealer.address || '—'} />
                      {d.validUntil && <DocLine label="Offerten giltig till" value={fmtDate(d.validUntil)} bold />}
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-slate-600">• Priserna inkluderar 25% mervärdesskatt (moms).</p>
                        <p className="text-xs text-slate-600">• Offerten är bindande för säljaren under giltighetstiden.</p>
                        <p className="text-xs text-slate-600">• Fordonet levereras med 3 års garanti (Konsumentköplagen 2022:260).</p>
                        {d.notes && <p className="text-xs text-slate-600">• {d.notes}</p>}
                      </div>
                    </DocSection>

                    {/* Signatures note */}
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

                  {/* Footer */}
                  <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">
                      {dealer.name} • {dealer.address} • {dealer.phone} • {dealer.email}
                      {dealer.orgNr && ` • Org.nr ${dealer.orgNr}`}
                    </p>
                  </div>

                </div>

                {/* Accepted banner */}
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

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {showFinancing && draft && (
        <FinancingComparison
          totalPrice={draft.totalPrice}
          downPayment={draft.downPayment}
          activeMths={draft.financingMonths}
          nominalRate={draft.nominalRate}
          onApply={applyFinancing}
          onClose={() => setShowFinancing(false)}
        />
      )}

      {tradeInEditIdx !== null && draft && (
        <TradeInModal
          initial={tradeInEditIdx >= 0 ? (draft.tradeIns[tradeInEditIdx] ?? null) : null}
          onSave={applyTradeIn}
          onClose={() => setTradeInEditIdx(null)}
        />
      )}
    </>
  );
}
