"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { CustomerInquiry } from "@/app/offer/data";

export default function OfferBuilder({ inq }: { inq: CustomerInquiry }) {
  const t      = useTranslations("offer.offerBuilder");
  const locale = useLocale();

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
        <h2 className="text-slate-900 font-bold text-xl">{t("sentTitle")}</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-xs leading-relaxed">
          {t("sentDesc", { name: inq.customer.name, email: inq.customer.email })}
        </p>
        <a
          href="/offer"
          className="mt-8 text-xs font-semibold text-[#FF6B2C] hover:underline transition-colors"
        >
          {t("backToDashboard")}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Trade-in valuation */}
      {inq.tradeIn.has && (
        <Section label={t("tradeInSection")}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {([
                [t("tradeIn.make"),    inq.tradeIn.make],
                [t("tradeIn.model"),   inq.tradeIn.model],
                [t("tradeIn.year"),    inq.tradeIn.year],
                [t("tradeIn.mileage"), `${parseInt(inq.tradeIn.mileage ?? "0").toLocaleString(locale)} km`],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">{k}</p>
                  <p className="text-slate-800 font-medium mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <SellerField
              label={t("tradeIn.estimatedValue")}
              value={tradeInValue}
              onChange={setTradeInValue}
              placeholder="0"
              type="number"
              hint={t("tradeIn.hint")}
            />
          </div>
        </Section>
      )}

      {/* Accessory pricing */}
      {inq.accessories.wants && (
        <Section label={t("accessoriesSection")}>
          <div className="space-y-2">
            {inq.accessories.items?.map((item, i) => (
              <div key={item} className="flex items-center gap-3">
                <span className="text-slate-700 text-sm flex-1">{item}</span>
                <div className="w-32">
                  <input
                    type="number"
                    placeholder={t("accessoriesPlaceholder")}
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
                {t("customerNote")} &ldquo;{inq.accessories.note}&rdquo;
              </p>
            )}
          </div>
        </Section>
      )}

      {/* Offer details */}
      <Section label={t("offerSection")}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SellerField
              label={t("regFee")}
              value={registrationFee}
              onChange={setRegistrationFee}
              type="number"
            />
            <SellerField
              label={t("discount")}
              value={discount}
              onChange={setDiscount}
              placeholder="0"
              type="number"
            />
          </div>

          {/* Extended warranty toggle */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-2">
              {t("extWarranty")}
            </p>
            <div className="flex items-center gap-3">
              <div className="grid grid-cols-2 gap-2 flex-1">
                {[
                  { val: true,  label: t("include")     },
                  { val: false, label: t("notIncluded") },
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
              label={t("deliveryDate")}
              value={deliveryDate}
              onChange={setDeliveryDate}
              type="date"
            />
            <SellerField
              label={t("validity")}
              value={validityDays}
              onChange={setValidityDays}
              type="number"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">
              {t("sellerComment")}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("commentPlaceholder")}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:border-[#FF6B2C] focus:ring-1 focus:ring-[#FF6B2C]/20 transition-colors resize-none"
            />
          </div>
        </div>
      </Section>

      {/* Price summary */}
      <Section label={t("priceSection")}>
        <div className="space-y-2">
          {([
            [t("price.listPrice"), base],
            ...(accTotal  > 0 ? [[t("price.accessories"),  accTotal]]  : []),
            ...(reg       > 0 ? [[t("price.regFee"),        reg]]       : []),
            ...(warranty  > 0 ? [[t("price.extWarranty"),   warranty]]  : []),
            ...(disc      > 0 ? [[t("price.discount"),      -disc]]     : []),
            ...(tradeVal  > 0 ? [[t("price.tradeInValue"),  -tradeVal]] : []),
          ] as [string, number][]).map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-slate-500">{label}</span>
              <span className={value < 0 ? "text-green-600 font-medium" : "text-slate-700"}>
                {value < 0 ? "−" : "+"}{" "}
                {Math.abs(value).toLocaleString(locale)} kr
              </span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-3 mt-2 flex justify-between items-baseline">
            <span className="text-slate-900 font-semibold">{t("price.total")}</span>
            <span className="text-slate-900 font-bold text-xl">
              {total.toLocaleString(locale)} kr
            </span>
          </div>
          {inq.payment === "financing" && (
            <p className="text-[10px] text-slate-400 pt-1">{t("financing")}</p>
          )}
        </div>
      </Section>

      {/* Send */}
      <button
        onClick={() => setSent(true)}
        disabled={!deliveryDate}
        className="w-full bg-[#FF6B2C] hover:bg-[#e55a1f] text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {t("sendButton", { name: inq.customer.name })}
      </button>
      <p className="text-[10px] text-slate-400 text-center">
        {t("sendNote", { email: inq.customer.email, days: validityDays })}
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
