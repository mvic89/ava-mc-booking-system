"use client";

import { useState } from "react";
import type { CustomerInquiry } from "@/app/bikemenow/data";

export default function OfferBuilder({ inq }: { inq: CustomerInquiry }) {
  const [sent, setSent] = useState(false);

  // Seller fields
  const [tradeInValue, setTradeInValue] = useState("");
  const [accessories, setAccessories] = useState(
    inq.accessories.items?.map((item) => ({ label: item, price: "" })) ?? []
  );
  const [registrationFee, setRegistrationFee] = useState("590");
  const [discount, setDiscount] = useState("");
  const [extendedWarranty, setExtendedWarranty] = useState(false);
  const [warrantyPrice, setWarrantyPrice] = useState("4900");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [validityDays, setValidityDays] = useState("30");
  const [notes, setNotes] = useState("");

  // Live price calculation
  const base = inq.bike.price;
  const accTotal = accessories.reduce(
    (sum, a) => sum + (parseFloat(a.price) || 0),
    0
  );
  const reg = parseFloat(registrationFee) || 0;
  const disc = parseFloat(discount) || 0;
  const warranty = extendedWarranty ? parseFloat(warrantyPrice) || 0 : 0;
  const tradeVal = parseFloat(tradeInValue) || 0;
  const total = base + accTotal + reg + warranty - disc - tradeVal;

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center py-16 px-6">
        <div className="w-12 h-12 rounded-full border border-neutral-600 flex items-center justify-center mb-4">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-white font-bold text-xl">Offert skickad</h2>
        <p className="text-neutral-400 text-sm mt-2 max-w-xs leading-relaxed">
          Offerten har skickats till{" "}
          <span className="text-white">{inq.customer.name}</span> på{" "}
          <span className="text-white">{inq.customer.email}</span>.
        </p>
        <a
          href="/bikemenow"
          className="mt-8 text-xs font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Tillbaka till dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trade-in valuation */}
      {inq.tradeIn.has && (
        <Section label="Inbytesvärdering">
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ["Märke", inq.tradeIn.make],
                ["Modell", inq.tradeIn.model],
                ["År", inq.tradeIn.year],
                ["Körsträcka", `${parseInt(inq.tradeIn.mileage ?? "0").toLocaleString("sv-SE")} km`],
              ].map(([k, v]) => (
                <div key={k} className="bg-neutral-800 rounded-lg p-2.5">
                  <p className="text-neutral-500 text-[10px] font-mono uppercase tracking-widest">
                    {k}
                  </p>
                  <p className="text-white mt-0.5">{v}</p>
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
                <span className="text-neutral-300 text-sm flex-1">{item}</span>
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
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                  />
                </div>
              </div>
            ))}
            {inq.accessories.note && (
              <p className="text-neutral-500 text-xs pt-1">
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
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-2">
              Förlängd garanti
            </p>
            <div className="flex items-center gap-3">
              <div className="grid grid-cols-2 gap-2 flex-1">
                {[
                  { val: true, label: "Inkludera" },
                  { val: false, label: "Ej inkluderad" },
                ].map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setExtendedWarranty(opt.val)}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      extendedWarranty === opt.val
                        ? "bg-white text-black border-white"
                        : "border-neutral-700 text-neutral-400 hover:border-neutral-500 bg-neutral-800"
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
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors"
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
            <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
              Säljarens kommentar
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Övriga villkor eller information till kunden..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors resize-none"
            />
          </div>
        </div>
      </Section>

      {/* Live price summary */}
      <Section label="Prissammanfattning">
        <div className="space-y-2">
          {[
            ["Listpris", base],
            ...(accTotal > 0 ? [["Tillbehör", accTotal]] : []),
            ...(reg > 0 ? [["Registreringsavgift", reg]] : []),
            ...(warranty > 0 ? [["Förlängd garanti", warranty]] : []),
            ...(disc > 0 ? [["Rabatt", -disc]] : []),
            ...(tradeVal > 0 ? [["Inbytesvärde", -tradeVal]] : []),
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between text-sm">
              <span className="text-neutral-400">{label}</span>
              <span
                className={
                  (value as number) < 0 ? "text-green-400" : "text-neutral-200"
                }
              >
                {(value as number) < 0 ? "−" : "+"}{" "}
                {Math.abs(value as number).toLocaleString("sv-SE")} kr
              </span>
            </div>
          ))}
          <div className="border-t border-neutral-700 pt-3 mt-2 flex justify-between items-baseline">
            <span className="text-white font-semibold">Totalt</span>
            <span className="text-white font-bold text-xl">
              {total.toLocaleString("sv-SE")} kr
            </span>
          </div>
          {inq.payment === "financing" && (
            <p className="text-[10px] text-neutral-600 font-mono pt-1">
              Finansiering via Santander — kreditprövning sker separat.
            </p>
          )}
        </div>
      </Section>

      {/* Send */}
      <button
        onClick={() => setSent(true)}
        disabled={!deliveryDate}
        className="w-full bg-white text-black font-semibold text-sm py-3 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Skicka Offert till {inq.customer.name}
      </button>
      <p className="text-[10px] text-neutral-600 text-center">
        Offerten skickas till {inq.customer.email} och är giltig i{" "}
        {validityDays} dagar.
      </p>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-700 rounded-xl p-5 bg-neutral-800/40">
      <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-4">
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
      <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
      />
      {hint && <p className="text-[10px] text-neutral-600 mt-1">{hint}</p>}
    </div>
  );
}
