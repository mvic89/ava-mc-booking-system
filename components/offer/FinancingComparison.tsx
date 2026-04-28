'use client';

// ─── FinancingComparison ───────────────────────────────────────────────────────
// Side-by-side financing scenarios for 24 / 36 / 48 / 60 months.
// Uses the standard amortisation PMT formula with a real nominal rate.
// Clicking "Välj" applies that scenario to the parent form.

import { useMemo } from 'react';

interface Props {
  /** Total purchase price (inkl. moms) */
  totalPrice:    number;
  /** Customer down payment */
  downPayment:   number;
  /** Currently selected months */
  activeMths:    number;
  /** Currently active nominal rate (annual %) */
  nominalRate:   number;
  /** Called with (months, monthlyPayment, effectiveApr) when user picks a scenario */
  onApply: (months: number, monthly: number, nominalRate: number, apr: number) => void;
  onClose: () => void;
}

// Swedish partner rate presets
const RATE_PRESETS = [
  { label: 'Svea Finans', rate: 6.95 },
  { label: 'Santander',   rate: 7.49 },
  { label: 'DNB Finans',  rate: 6.45 },
];

const TERM_MONTHS = [24, 36, 48, 60];

/** PMT formula — monthly payment */
function calcPMT(principal: number, annualNominalPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualNominalPct / 12 / 100;
  if (r < 0.000001) return Math.round(principal / months);
  const pmt = (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(pmt);
}

/** Effective annual rate (APR) from nominal monthly */
function calcAPR(annualNominalPct: number): number {
  const r = annualNominalPct / 12 / 100;
  return Math.round(((Math.pow(1 + r, 12) - 1) * 100) * 100) / 100;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n);
}

export default function FinancingComparison({ totalPrice, downPayment, activeMths, nominalRate, onApply, onClose }: Props) {
  const principal = Math.max(0, totalPrice - downPayment);

  const scenarios = useMemo(() =>
    TERM_MONTHS.map(months => {
      const monthly    = calcPMT(principal, nominalRate, months);
      const totalPaid  = monthly * months + downPayment;
      const interest   = totalPaid - totalPrice;
      const apr        = calcAPR(nominalRate);
      return { months, monthly, totalPaid, interest, apr };
    }),
    [principal, nominalRate, downPayment, totalPrice],
  );

  const bestMonthly = Math.min(...scenarios.map(s => s.monthly));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#0b1524] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Finansieringsjämförelse</h2>
            <p className="text-sm text-white/60 mt-0.5">
              Kreditbelopp {fmt(principal)} · Kontantinsats {fmt(downPayment)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Rate presets */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Räntesats — välj partner eller justera manuellt</p>
            <div className="flex flex-wrap gap-2">
              {RATE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => onApply(activeMths, calcPMT(principal, p.rate, activeMths), p.rate, calcAPR(p.rate))}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                    nominalRate === p.rate
                      ? 'bg-[#FF6B2C] text-white border-[#FF6B2C]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-[#FF6B2C] hover:text-[#FF6B2C]'
                  }`}
                >
                  {p.label} — {p.rate}%
                </button>
              ))}
              <span className="px-3 py-1.5 rounded-xl text-sm text-slate-500 border border-slate-200 bg-slate-50">
                Aktuell: {nominalRate}% nominell
              </span>
            </div>
          </div>

          {/* Comparison grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {scenarios.map(s => {
              const isActive   = s.months === activeMths;
              const isCheapest = s.monthly === bestMonthly;
              return (
                <div
                  key={s.months}
                  className={`relative rounded-2xl border-2 p-4 transition-all cursor-pointer hover:shadow-md ${
                    isActive
                      ? 'border-[#FF6B2C] bg-[#FF6B2C]/5'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                  onClick={() => onApply(s.months, s.monthly, nominalRate, s.apr)}
                >
                  {isCheapest && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                      Lägst totalkostnad
                    </span>
                  )}

                  {/* Months */}
                  <p className="text-2xl font-black text-slate-900 text-center">{s.months}</p>
                  <p className="text-xs text-slate-400 text-center mb-3">månader</p>

                  {/* Monthly */}
                  <div className={`text-center mb-3 ${isActive ? 'text-[#FF6B2C]' : 'text-slate-900'}`}>
                    <p className="text-xl font-bold">{fmt(s.monthly)}</p>
                    <p className="text-xs text-slate-400">/månad</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 border-t border-slate-100 pt-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Totalt</span>
                      <span className="font-semibold text-slate-700">{fmt(s.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Räntekostnad</span>
                      <span className="font-semibold text-slate-500">+{fmt(s.interest)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Eff. ränta</span>
                      <span className="font-semibold text-slate-700">{s.apr}%</span>
                    </div>
                  </div>

                  {/* Apply button */}
                  <button
                    onClick={e => { e.stopPropagation(); onApply(s.months, s.monthly, nominalRate, s.apr); }}
                    className={`w-full mt-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#FF6B2C] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-[#FF6B2C] hover:text-white'
                    }`}
                  >
                    {isActive ? '✓ Vald' : 'Välj'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legal note */}
          <p className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
            Beräkningar baseras på nominell ränta {nominalRate}% per år med lika stora månadskostnader.
            Effektiv ränta beräknad enligt Konsumentkreditlagen (2010:1846). Slutligt erbjudande förutsätter
            godkänd kreditprövning av finansieringspartner. Exempel är illustrativa och inte bindande.
          </p>
        </div>
      </div>
    </div>
  );
}
