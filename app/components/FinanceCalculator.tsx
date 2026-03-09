"use client";

import { useState, useMemo } from "react";

const INTEREST_RATE = 0.0995; // 9.95% nominal, Santander SE typical
const LOAN_TERMS = [24, 36, 48, 60, 72];

function calcMonthly(principal: number, months: number): number {
  const r = INTEREST_RATE / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export default function FinanceCalculator({ price }: { price: number }) {
  const minDown = Math.round(price * 0.2);
  const [downPayment, setDownPayment] = useState(minDown);
  const [term, setTerm] = useState(48);

  const principal = price - downPayment;
  const monthly = useMemo(() => calcMonthly(principal, term), [principal, term]);
  const totalCost = useMemo(() => downPayment + monthly * term, [downPayment, monthly, term]);

  return (
    <div className="space-y-5">
      {/* Price */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1">
          Pris
        </p>
        <p className="text-3xl font-bold text-white">
          {price.toLocaleString("sv-SE")}{" "}
          <span className="text-neutral-400 text-lg font-normal">kr</span>
        </p>
      </div>

      <div className="border-t border-neutral-700 pt-5 space-y-5">
        {/* Down payment */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
              Kontantinsats
            </label>
            <span className="text-sm font-semibold text-white">
              {downPayment.toLocaleString("sv-SE")} kr
            </span>
          </div>
          <input
            type="range"
            min={minDown}
            max={Math.round(price * 0.7)}
            step={1000}
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-neutral-600 font-mono">
              Min 20% — {minDown.toLocaleString("sv-SE")} kr
            </span>
            <span className="text-[10px] text-neutral-600 font-mono">
              {Math.round(price * 0.7).toLocaleString("sv-SE")} kr
            </span>
          </div>
        </div>

        {/* Loan term */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-2">
            Löptid
          </p>
          <div className="flex gap-2">
            {LOAN_TERMS.map((t) => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={`flex-1 py-1.5 rounded text-xs font-mono border transition-colors ${
                  term === t
                    ? "bg-white text-black border-white"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                }`}
              >
                {t} mån
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-neutral-400">Månadsbetalning</span>
          <span className="text-xl font-bold text-white">
            {Math.round(monthly).toLocaleString("sv-SE")} kr/mån
          </span>
        </div>
        <div className="border-t border-neutral-700 pt-3 space-y-1.5">
          {[
            ["Lånebelopp", `${principal.toLocaleString("sv-SE")} kr`],
            ["Nominell ränta", "9,95%"],
            ["Löptid", `${term} månader`],
            ["Total kostnad", `${Math.round(totalCost).toLocaleString("sv-SE")} kr`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-[10px] text-neutral-500 font-mono">{label}</span>
              <span className="text-[10px] text-neutral-300 font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-neutral-600 leading-relaxed">
        Finansiering via Santander Consumer Bank. Ränta 9,95% nominalt. Exemplet är
        vägledande — slutlig ränta bestäms vid kreditprövning.
      </p>
    </div>
  );
}
