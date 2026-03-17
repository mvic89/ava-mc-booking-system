"use client";

import { useState } from "react";
import type { CustomerInquiry } from "@/app/bikemenow/data";

export default function OfferBuilder({ inq }: { inq: CustomerInquiry }) {
  const [sent, setSent] = useState(false);

  const [tradeInValue,      setTradeInValue]      = useState("");
  const [accessories,       setAccessories]       = useState(
    inq.accessories.items?.map((item) => ({ label: item, price: "" })) ?? []
  );
  const [registrationFee,  setRegistrationFee]   = useState("590");
  const [discount,         setDiscount]           = useState("");
  const [extendedWarranty, setExtendedWarranty]   = useState(false);
  const [warrantyPrice,    setWarrantyPrice]      = useState("4900");
  const [deliveryDate,     setDeliveryDate]       = useState("");
  const [validityDays,     setValidityDays]       = useState("30");
  const [notes,            setNotes]              = useState("");

  const base     = inq.bike.price;
  const accTotal = accessories.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
  const reg      = parseFloat(registrationFee) || 0;
  const disc     = parseFloat(discount) || 0;
  const warranty = extendedWarranty ? parseFloat(warrantyPrice) || 0 : 0;
  const tradeVal = parseFloat(tradeInValue) || 0;
  const total    = base + accTotal + reg + warranty - disc - tradeVal;

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-6">
        <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-slate-900 font-bold text-xl">Offert skickad</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
          Offerten har skickats till{" "}
          <span className="text-slate-900 font-medium">{inq.customer.name}</span> på{" "}
          <span className="text-slate-900 font-medium">{inq.customer.email}</span>.
        </p>
        <a
          href="/offer"
          className="mt-8 text-xs font-semibold text-[#FF6B2C] hover:underline transition-colors"
        >
          ← Tillbaka till dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Trade-in valuation */}
      {inq.tradeIn.has && (
        <Section label="Inbytesvärdering">
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ["Märke",       inq.tradeIn.make],
                ["Modell",      inq.tradeIn.model],
                ["År",          inq.tradeIn.year],
                ["Körsträcka",  `${parseInt(inq.tradeIn.mileage ?? "0").toLocaleString("sv-SE")} km`],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">{k}</p>
                  <p className="text-slate-800 font-medium mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <SellerField
              label="Bedömt inbytesvärde (kr)"
              value={tradeInValue}
              onChange={setTradeInValue}
              placeholder="0"
              type="number"
              hint="Avdrag från totalpriset"
            />
          </div>
        </Section>
      )}

      {/* Accessory pricing */}
      {inq.accessories.wants && (
        <Section label="Tillbehör — prissättning">
          <div className="space-y-2">
            {inq.accessories.items?.map((item, i) => (
              <div key={item} className="flex items-center gap-3">
                <span className="text-slate-700 text-sm flex-1">{item}</span>
                <div className="w-32">
                  <input
                    type="number"
                    placeholder="Pris (kr)"
                    value={accessories[i]?.price ?? ""}
                    onChange={(e) => {
                      const updated = [...accessories];
                      updated[i] = { ...updated[i], price: e.target.value };
                      setAccessories(updated);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition-colors"
                  />
                </div>
              </div>
            ))}
            {inq.accessories.note && (
              <p className="text-slate-400 text-xs pt-1">
                Kundens notering: &ldquo;{inq.accessories.note}&rdquo;
              </p>
            )}
          </div>
        </Section>
      )}

      {/* Offer details */}
      <Section label="Offertuppgifter">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SellerField
              label="Registreringsavgift (kr)"
              value={registrationFee}
              onChange={setRegistrationFee}
              type="number"
            />
            <SellerField
              label="Rabatt (kr)"
              value={discount}
              onChange={setDiscount}
              placeholder="0"
              type="number"
            />
          </div>

          {/* Extended warranty toggle */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              Förlängd garanti
            </p>
            <div className="flex items-center gap-3">
              <div className="grid grid-cols-2 gap-2 flex-1">
                {[
                  { val: true,  label: "Inkludera"    },
                  { val: false, label: "Ej inkluderad" },
                ].map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setExtendedWarranty(opt.val)}
                    className={`py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      extendedWarranty === opt.val
                        ? "bg-[#FF6B2C] text-white border-[#FF6B2C]"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {extendedWarranty && (
                <div className="w-32 shrink-0">
                  <input
                    type="number"
                    value={warrantyPrice}
                    onChange={(e) => setWarrantyPrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SellerField
              label="Leveransdatum"
              value={deliveryDate}
              onChange={setDeliveryDate}
              type="date"
            />
            <SellerField
              label="Offertens giltighetstid (dagar)"
              value={validityDays}
              onChange={setValidityDays}
              type="number"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">
              Säljarens kommentar
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Övriga villkor eller information till kunden..."
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition-colors resize-none"
            />
          </div>
        </div>
      </Section>

      {/* Price summary */}
      <Section label="Prissammanfattning">
        <div className="space-y-2">
          {[
            ["Listpris", base],
            ...(accTotal  > 0 ? [["Tillbehör",          accTotal]]  : []),
            ...(reg       > 0 ? [["Registreringsavgift", reg]]       : []),
            ...(warranty  > 0 ? [["Förlängd garanti",    warranty]]  : []),
            ...(disc      > 0 ? [["Rabatt",              -disc]]     : []),
            ...(tradeVal  > 0 ? [["Inbytesvärde",        -tradeVal]] : []),
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between text-sm">
              <span className="text-slate-500">{label}</span>
              <span className={(value as number) < 0 ? "text-green-600 font-medium" : "text-slate-700"}>
                {(value as number) < 0 ? "−" : "+"}{" "}
                {Math.abs(value as number).toLocaleString("sv-SE")} kr
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-3 mt-2 flex justify-between items-baseline">
            <span className="text-slate-900 font-semibold">Totalt</span>
            <span className="text-slate-900 font-bold text-xl">
              {total.toLocaleString("sv-SE")} kr
            </span>
          </div>
          {inq.payment === "financing" && (
            <p className="text-[10px] text-slate-400 pt-1">
              Finansiering via Santander — kreditprövning sker separat.
            </p>
          )}
        </div>
      </Section>

      {/* Send */}
      <button
        onClick={() => setSent(true)}
        disabled={!deliveryDate}
        className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Skicka Offert till {inq.customer.name}
      </button>
      <p className="text-[10px] text-slate-400 text-center">
        Offerten skickas till {inq.customer.email} och är giltig i {validityDays} dagar.
      </p>

    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-2xl p-5 bg-white">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-4">
        {label}
      </p>
      {children}
    </div>
  );
}

function SellerField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition-colors"
      />
      {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
