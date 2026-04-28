'use client';

// ─── TradeInModal ──────────────────────────────────────────────────────────────
// Full trade-in appraisal modal.
// • Smart single lookup field — auto-detects VIN (17 chars) vs Swedish reg nr
// • Calls /api/vehicle-lookup which uses Bilvision (vehicle + owner + liens + inspection in one call)
// • Shows owner name/city, vehicle status (STOLEN / SCRAPPED), lien warning
// • Auto-fills all form fields from lookup result
// • Smart valuation calculator: market value → suggested credit via condition + age + mileage

import { useEffect, useRef, useState } from 'react';
import type { TradeInData, TradeInCondition } from '@/lib/offers';
import type { VehicleLookupFull } from '@/app/api/vehicle-lookup/route';

interface Props {
  initial: TradeInData | null;
  onSave:  (data: TradeInData) => void;
  onClose: () => void;
}

const BLANK: TradeInData = {
  make: '', model: '', year: new Date().getFullYear() - 3,
  mileage: 0, mileageUnit: 'mil',
  condition: 'good', color: '', vin: '', registrationNumber: '', notes: '',
  estimatedValue: 0, offeredCredit: 0,
};

const CONDITION_OPTIONS: { value: TradeInCondition; label: string; desc: string }[] = [
  { value: 'excellent', label: 'Utmärkt',  desc: 'Inga synliga skador, som ny' },
  { value: 'good',      label: 'Bra',      desc: 'Normalt slitage, fullt fungerande' },
  { value: 'fair',      label: 'OK',       desc: 'Visst slitage, mindre fel' },
  { value: 'poor',      label: 'Sliten',   desc: 'Tydligt slitage, behöver service' },
  { value: 'damaged',   label: 'Skadad',   desc: 'Kollisionsskada eller liknande' },
];

const CONDITION_COLORS: Record<TradeInCondition, string> = {
  excellent: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  good:      'border-blue-400    bg-blue-50    text-blue-800',
  fair:      'border-amber-400   bg-amber-50   text-amber-800',
  poor:      'border-orange-400  bg-orange-50  text-orange-800',
  damaged:   'border-red-500     bg-red-50     text-red-800',
};

const CONDITION_MULT: Record<TradeInCondition, number> = {
  excellent: 0.82, good: 0.70, fair: 0.57, poor: 0.43, damaged: 0.28,
};

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => CURRENT_YEAR - i);

const inp = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20';

function fmt(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('sv-SE'); } catch { return s; }
}

function calcSuggested(market: number, condition: TradeInCondition, year: number, mileage: number, unit: 'mil' | 'km') {
  const condPct  = CONDITION_MULT[condition];
  const yearsOld = Math.max(0, CURRENT_YEAR - year);
  const agePct   = Math.min(yearsOld * 0.03, 0.30);
  const km       = unit === 'mil' ? mileage * 10 : mileage;
  const milePct  = Math.min(km / 1000 * 0.0004, 0.25);
  const suggested = Math.round(market * condPct * (1 - agePct) * (1 - milePct));
  return { condPct, agePct, milePct, suggested };
}

type LookupState = 'idle' | 'loading' | 'found' | 'not_found' | 'error';

// Detect whether query looks like a Swedish reg nr or a VIN
function isLikelyRegNr(q: string) {
  const clean = q.replace(/\s/g, '');
  return clean.length < 17 && /^[A-ZÅÄÖ]{2,3}[0-9]{2,3}[A-Z0-9]?$/i.test(clean);
}

function isCompleteVin(q: string) {
  return q.replace(/\s/g, '').length === 17;
}

// ─── Vehicle info panel ────────────────────────────────────────────────────────
function VehicleInfoPanel({ data, onDismiss }: { data: VehicleLookupFull; onDismiss: () => void }) {
  const stolen    = data.vehicleStatus === 'STOLEN';
  const scrapped  = data.vehicleStatus === 'SCRAPPED';
  const deregNr   = data.vehicleStatus === 'DEREGISTERED';
  const hasOwner  = !!data.ownerName;
  const hasInsp   = !!(data.lastInspection || data.nextInspection);

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Status bar */}
      {(stolen || scrapped || data.liens) && (
        <div className={`px-4 py-3 flex items-start gap-3 ${
          stolen ? 'bg-red-600 text-white' :
          scrapped ? 'bg-slate-700 text-white' :
          'bg-amber-50 border-b border-amber-200'
        }`}>
          <span className="text-xl shrink-0">{stolen ? '🚨' : scrapped ? '🗑️' : '⚠️'}</span>
          <div>
            {stolen && (
              <>
                <p className="font-extrabold text-base">FORDONET ÄR ANMÄLT STULET</p>
                <p className="text-sm text-red-100 mt-0.5">Avbryt transaktionen och kontakta polisen.</p>
              </>
            )}
            {scrapped && (
              <>
                <p className="font-extrabold text-base">FORDONET ÄR SKROTAT</p>
                <p className="text-sm text-slate-300 mt-0.5">Fordonsregistret anger att detta fordon är avregistrerat som skrot.</p>
              </>
            )}
            {!stolen && !scrapped && data.liens && (
              <>
                <p className="font-bold text-amber-800 text-sm">Skuld registrerad på fordonet</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Fordonet har ett registrerat kreditåtagande.
                  {data.lienHolder && ` Kreditgivare: ${data.lienHolder}.`}
                  {data.lienAmount > 0 && ` Belopp: ${fmt(data.lienAmount)}.`}
                  {' '}Kontrollera att säljaren löser lånet före överlåtelse.
                </p>
              </>
            )}
          </div>
          <button onClick={onDismiss} className={`ml-auto text-xs shrink-0 underline opacity-70 hover:opacity-100 ${stolen || scrapped ? 'text-white' : 'text-amber-700'}`}>
            Stäng
          </button>
        </div>
      )}

      <div className="bg-slate-50 px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
        {/* Status badge */}
        <div className="col-span-2 md:col-span-3 flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            stolen    ? 'bg-red-600 text-white' :
            scrapped  ? 'bg-slate-600 text-white' :
            deregNr   ? 'bg-slate-200 text-slate-600' :
            data.vehicleStatus === 'REGISTERED' ? 'bg-emerald-100 text-emerald-700' :
            'bg-slate-100 text-slate-500'
          }`}>
            {stolen ? '🚨 STULEN' : scrapped ? '🗑️ SKROTAD' : deregNr ? 'Avregistrerad' : data.vehicleStatus === 'REGISTERED' ? '✓ Registrerad' : data.vehicleStatus}
          </span>
          {data.liens && !stolen && !scrapped && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              ⚠️ Skuld på fordonet
            </span>
          )}
          {!data.liens && data.vehicleStatus === 'REGISTERED' && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              ✓ Skuldfritt
            </span>
          )}
          <span className="text-[10px] text-slate-400 ml-auto">via {data.source}</span>
        </div>

        {/* Vehicle summary */}
        {data.make && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Fordon</p>
            <p className="text-sm font-semibold text-slate-900">{[data.make, data.model, data.year || ''].filter(Boolean).join(' ')}</p>
            {data.color && <p className="text-xs text-slate-500">{data.color}</p>}
          </div>
        )}
        {data.fuelType && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Motor</p>
            <p className="text-sm text-slate-700">{data.engineCC > 0 ? `${data.engineCC} cc` : ''} {data.fuelType}</p>
          </div>
        )}
        {data.mileage > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Mätarställning</p>
            <p className="text-sm text-slate-700">{data.mileage.toLocaleString('sv-SE')} {data.mileageUnit}</p>
          </div>
        )}
        {data.registrationNumber && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">Regnr</p>
            <p className="text-sm font-mono text-slate-900">{data.registrationNumber}</p>
          </div>
        )}
        {data.vin && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase">VIN</p>
            <p className="text-xs font-mono text-slate-600 break-all">{data.vin}</p>
          </div>
        )}

        {/* Owner */}
        {hasOwner && (
          <div className="col-span-2 md:col-span-3 border-t border-slate-200 pt-2.5 mt-0.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Registrerad ägare</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                {data.ownerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{data.ownerName}</p>
                <p className="text-xs text-slate-500">
                  {[data.ownerAddress, data.ownerZip, data.ownerCity].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Inspections */}
        {hasInsp && (
          <div className="col-span-2 md:col-span-3 border-t border-slate-200 pt-2.5 mt-0.5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Senaste besiktning</p>
              <p className="text-sm text-slate-700">{fmtDate(data.lastInspection)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Nästa besiktning</p>
              <p className={`text-sm font-semibold ${data.nextInspection && new Date(data.nextInspection) < new Date() ? 'text-red-600' : 'text-slate-700'}`}>
                {fmtDate(data.nextInspection)}
                {data.nextInspection && new Date(data.nextInspection) < new Date() && ' ⚠️ Förfallen'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function TradeInModal({ initial, onSave, onClose }: Props) {
  const [form,         setForm]         = useState<TradeInData>(initial ?? BLANK);
  const [query,        setQuery]        = useState(initial?.registrationNumber ?? initial?.vin ?? '');
  const [lookupState,  setLookupState]  = useState<LookupState>('idle');
  const [lookupData,   setLookupData]   = useState<VehicleLookupFull | null>(null);
  const [showPanel,    setShowPanel]    = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upd = <K extends keyof TradeInData>(k: K, v: TradeInData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // ── Auto-detect + debounce lookup ──────────────────────────────────────────
  useEffect(() => {
    const q = query.trim().toUpperCase().replace(/\s+/g, '');
    const ready = isCompleteVin(q) || (isLikelyRegNr(q) && q.length >= 5);

    if (!ready) {
      if (lookupState !== 'idle') { setLookupState('idle'); setLookupData(null); setShowPanel(true); }
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLookupState('loading');
      setLookupData(null);
      setShowPanel(true);
      try {
        const res  = await fetch(`/api/vehicle-lookup?query=${encodeURIComponent(q)}`);
        const data = await res.json() as VehicleLookupFull;

        if (!res.ok || data.source === 'not_found' || (!data.make && !data.model)) {
          setLookupState('not_found');
          return;
        }

        setLookupData(data);
        setLookupState('found');

        // Auto-fill form fields (only override empty / default values)
        setForm(f => ({
          ...f,
          make:               f.make  || data.make,
          model:              f.model || data.model,
          year:               (f.year === BLANK.year || f.year === 0) && data.year > 0 ? data.year : f.year,
          color:              f.color || data.color,
          vin:                f.vin   || data.vin,
          registrationNumber: f.registrationNumber || data.registrationNumber,
          mileage:            (f.mileage === 0) && data.mileage > 0 ? data.mileage : f.mileage,
          mileageUnit:        data.mileage > 0 ? data.mileageUnit : f.mileageUnit,
          fuelType:           data.fuelType || undefined,
          engineCC:           data.engineCC > 0 ? data.engineCC : undefined,
          ownerName:          data.ownerName || undefined,
          ownerCity:          data.ownerCity || undefined,
          liens:              data.liens,
          vehicleStatus:      data.vehicleStatus !== 'UNKNOWN' ? data.vehicleStatus : undefined,
          lastInspection:     data.lastInspection || undefined,
          nextInspection:     data.nextInspection || undefined,
        }));
      } catch {
        setLookupState('error');
      }
    }, 600);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const margin = form.estimatedValue > 0 && form.offeredCredit > 0
    ? form.estimatedValue - form.offeredCredit : null;

  const q       = query.trim().replace(/\s/g, '');
  const isVin   = isCompleteVin(q);
  const isRegNr = isLikelyRegNr(q);
  const charCount = q.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-[#0b1524] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold">Inbytesvärdering</h2>
            <p className="text-sm text-white/60 mt-0.5">Ange regnr eller VIN för automatisk ifyllning</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Smart lookup field ─────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Registreringsnummer eller VIN
              <span className="ml-1.5 font-normal text-slate-400">— automatisk fordonssökning</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={e => {
                  setQuery(e.target.value.toUpperCase());
                  setLookupState('idle');
                  setLookupData(null);
                }}
                placeholder="ABC 123  eller  VF1RFD00XHY123456"
                maxLength={17}
                spellCheck={false}
                autoFocus
                className={`${inp} pr-32 font-mono tracking-wider uppercase`}
              />
              {/* State indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {lookupState === 'loading' && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#FF6B2C] rounded-full animate-spin shrink-0" />
                    Söker…
                  </span>
                )}
                {lookupState === 'found' && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Hittad
                  </span>
                )}
                {lookupState === 'not_found' && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
                    Hittades ej
                  </span>
                )}
                {lookupState === 'error' && (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 font-medium">
                    Fel
                  </span>
                )}
                {lookupState === 'idle' && charCount > 0 && (
                  <span className="text-xs text-slate-400 font-mono">
                    {isVin ? '17/17' : isRegNr ? `${charCount} · regnr` : `${charCount}/17`}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Söker i Bilvision (fordon, ägare, skulder och besiktningsstatus)
            </p>

            {lookupState === 'not_found' && (
              <p className="mt-1.5 text-xs text-amber-600">
                Fordonet hittades inte. Fyll i uppgifterna manuellt nedan.
              </p>
            )}
          </div>

          {/* ── Vehicle info panel ─────────────────────────────────────────── */}
          {lookupState === 'found' && lookupData && showPanel && (
            <VehicleInfoPanel data={lookupData} onDismiss={() => setShowPanel(false)} />
          )}

          {/* ── Vehicle details ──────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Fordonsinformation</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Märke
                  {lookupState === 'loading' && <span className="ml-1 text-slate-300 animate-pulse">●</span>}
                </label>
                <input type="text" value={form.make} onChange={e => upd('make', e.target.value)} placeholder="Honda" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modell
                  {lookupState === 'loading' && <span className="ml-1 text-slate-300 animate-pulse">●</span>}
                </label>
                <input type="text" value={form.model} onChange={e => upd('model', e.target.value)} placeholder="CB500F" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Årsmodell
                  {lookupState === 'loading' && <span className="ml-1 text-slate-300 animate-pulse">●</span>}
                </label>
                <select value={form.year} onChange={e => upd('year', Number(e.target.value))} className={inp}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Färg
                  {lookupState === 'loading' && <span className="ml-1 text-slate-300 animate-pulse">●</span>}
                </label>
                <input type="text" value={form.color} onChange={e => upd('color', e.target.value)} placeholder="Röd metallic" className={inp} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mätarställning</label>
                <div className="flex gap-1">
                  <input type="number" value={form.mileage || ''} min={0}
                    onChange={e => upd('mileage', Number(e.target.value) || 0)}
                    className={`${inp} flex-1 min-w-0`} placeholder="0" />
                  <select value={form.mileageUnit} onChange={e => upd('mileageUnit', e.target.value as 'mil' | 'km')}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-2 text-slate-900 bg-white focus:outline-none focus:border-[#FF6B2C] shrink-0">
                    <option value="mil">mil</option>
                    <option value="km">km</option>
                  </select>
                </div>
              </div>
              {/* VIN + regnr side by side if not already auto-filled by lookup field */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Registreringsnummer</label>
                <input type="text" value={form.registrationNumber ?? ''} onChange={e => upd('registrationNumber', e.target.value.toUpperCase())}
                  placeholder="ABC 123" className={`${inp} font-mono tracking-wider uppercase`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">VIN (Chassinummer)</label>
                <input type="text" value={form.vin} onChange={e => upd('vin', e.target.value.toUpperCase())}
                  placeholder="17 tecken" maxLength={17} className={`${inp} font-mono tracking-wider uppercase`} />
              </div>
            </div>
          </div>

          {/* ── Condition ──────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Skick</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CONDITION_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => upd('condition', opt.value)}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    form.condition === opt.value
                      ? `${CONDITION_COLORS[opt.value]} border-current`
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 leading-tight opacity-75">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Notes ─────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Anteckningar (skador, utrustning, service)</label>
            <textarea value={form.notes} onChange={e => upd('notes', e.target.value)}
              rows={3} placeholder="T.ex. ny däck 2024, service utförd, liten reppa på tank…"
              className={`${inp} resize-none`} />
          </div>

          {/* ── Valuation ─────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Värdering</p>
            <div className="space-y-3">
              {/* Market value input */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Uppskattad marknadsvärde
                  <span className="ml-1 font-normal text-slate-400">(internt — visas ej för kund)</span>
                </label>
                <div className="relative">
                  <input type="number" value={form.estimatedValue || ''} min={0}
                    onChange={e => upd('estimatedValue', Number(e.target.value) || 0)}
                    className={`${inp} pr-8`} placeholder="Kolla Blocket / Bytbil…" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kr</span>
                </div>
              </div>

              {/* Auto-calculation card */}
              {form.estimatedValue > 0 && (() => {
                const calc = calcSuggested(form.estimatedValue, form.condition, form.year, form.mileage, form.mileageUnit);
                const isApplied = form.offeredCredit === calc.suggested;
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Kalkylerat förslag</p>
                      <button type="button" onClick={() => upd('offeredCredit', calc.suggested)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          isApplied ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-[#FF6B2C] text-white hover:bg-[#e55a1f]'
                        }`}>
                        {isApplied ? '✓ Tillämpad' : 'Tillämpa förslag'}
                      </button>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mb-3">{fmt(calc.suggested)}</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Marknadsvärde</span>
                        <span className="font-semibold text-slate-700">{fmt(form.estimatedValue)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Skickkorrektör ({CONDITION_OPTIONS.find(c => c.value === form.condition)?.label})</span>
                        <span className="font-semibold text-amber-700">×{Math.round(calc.condPct * 100)}%</span>
                      </div>
                      {calc.agePct > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Åldersavdrag ({CURRENT_YEAR - form.year} år)</span>
                          <span className="font-semibold text-red-600">−{Math.round(calc.agePct * 100)}%</span>
                        </div>
                      )}
                      {calc.milePct > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Milsavdrag ({form.mileage.toLocaleString('sv-SE')} {form.mileageUnit})</span>
                          <span className="font-semibold text-red-600">−{Math.round(calc.milePct * 100)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Offered credit (manual / override) */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Inbytesvärde (kredit som erbjuds kunden)
                  <span className="ml-1 font-normal text-[#FF6B2C]">— tillämpas på offertpriset</span>
                </label>
                <div className="relative">
                  <input type="number" value={form.offeredCredit || ''} min={0}
                    onChange={e => upd('offeredCredit', Number(e.target.value) || 0)}
                    className={`${inp} pr-8 ${form.offeredCredit > 0 ? 'border-[#FF6B2C] ring-1 ring-[#FF6B2C]/20' : ''}`}
                    placeholder="0" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kr</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Kan justeras fritt — t.ex. vid förhandling</p>
              </div>

              {/* Margin */}
              {margin !== null && (
                <div className={`rounded-xl p-3 flex items-center justify-between ${
                  margin >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Handelsmarginal inbyte</p>
                    <p className="text-[10px] text-slate-400">Marknadsvärde minus erbjuden kredit</p>
                  </div>
                  <span className={`text-lg font-bold ${margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {margin >= 0 ? '+' : ''}{fmt(margin)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Preview ───────────────────────────────────────────────────── */}
          {(form.make || form.model) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-1">Förhandsvisning</p>
              <p className="text-sm font-semibold text-slate-900">
                {[form.make, form.model, form.year > 0 ? form.year : ''].filter(Boolean).join(' ')}
                {form.color && ` · ${form.color}`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {form.registrationNumber && `${form.registrationNumber} · `}
                {form.mileage > 0 && `${form.mileage.toLocaleString('sv-SE')} ${form.mileageUnit}`}
                {form.mileage > 0 && ' · '}
                {CONDITION_OPTIONS.find(c => c.value === form.condition)?.label ?? ''}
              </p>
              {form.ownerName && (
                <p className="text-xs text-slate-500 mt-0.5">Ägare: {form.ownerName}{form.ownerCity ? `, ${form.ownerCity}` : ''}</p>
              )}
              {form.liens === true && (
                <p className="text-xs text-amber-600 font-semibold mt-1">⚠️ Skuld registrerad på fordonet</p>
              )}
              {form.liens === false && form.vehicleStatus === 'REGISTERED' && (
                <p className="text-xs text-emerald-600 font-medium mt-1">✓ Skuldfritt fordon</p>
              )}
              {form.offeredCredit > 0 && (
                <p className="text-sm font-bold text-[#FF6B2C] mt-1">Inbytesvärde: {fmt(form.offeredCredit)}</p>
              )}
            </div>
          )}

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
              Avbryt
            </button>
            <button type="button" onClick={() => onSave(form)}
              className="flex-1 py-3 rounded-xl bg-[#FF6B2C] hover:bg-[#e55a1f] text-white text-sm font-bold transition-colors">
              Spara inbytesvärdering
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
