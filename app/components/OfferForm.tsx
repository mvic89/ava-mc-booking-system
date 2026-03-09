"use client";

import { useState } from "react";

type PaymentPreference = "cash" | "financing" | "";

const ACCESSORY_OPTIONS = [
  "Hjälm",
  "Bagage & väskor",
  "Motorhölje",
  "Förlängd service",
  "Låssystem",
  "Körskydd",
];

export default function OfferForm({
  bikeName,
  bikeSlug,
}: {
  bikeName: string;
  bikeSlug: string;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [payment, setPayment] = useState<PaymentPreference>("");

  // Core fields
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  // Trade-in
  const [hasTradeIn, setHasTradeIn] = useState<boolean | null>(null);
  const [tradeIn, setTradeIn] = useState({
    make: "",
    model: "",
    year: "",
    mileage: "",
  });

  // Accessories
  const [wantsAccessories, setWantsAccessories] = useState<boolean | null>(null);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [accessoryNote, setAccessoryNote] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleTradeInChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTradeIn((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleAccessory(item: string) {
    setSelectedAccessories((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const canSubmit =
    form.name &&
    form.email &&
    form.phone &&
    payment &&
    hasTradeIn !== null &&
    wantsAccessories !== null;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-6">
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
        <h2 className="text-white font-bold text-xl">Förfrågan skickad</h2>
        <p className="text-neutral-400 text-sm mt-2 max-w-xs leading-relaxed">
          AVA MC återkommer till dig inom 24 timmar med ett erbjudande på{" "}
          <span className="text-white">{bikeName}</span>.
        </p>
        <a
          href={`/ava-mc/${bikeSlug}`}
          className="mt-8 text-xs font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          ← Tillbaka till cykeln
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <Field
        label="Fullständigt namn"
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Anna Svensson"
        required
      />

      {/* Email */}
      <Field
        label="E-post"
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="anna@exempel.se"
        required
      />

      {/* Phone */}
      <Field
        label="Telefon"
        name="phone"
        type="tel"
        value={form.phone}
        onChange={handleChange}
        placeholder="070 000 00 00"
        required
      />

      {/* Payment preference */}
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-2">
          Betalningssätt <span className="text-white">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "cash", label: "Kontant" },
            { value: "financing", label: "Finansiering" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPayment(opt.value as PaymentPreference)}
              className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                payment === opt.value
                  ? "bg-white text-black border-white"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500 bg-neutral-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {payment === "financing" && (
          <p className="text-[10px] text-neutral-600 font-mono mt-2">
            Finansiering via Santander Consumer Bank. Kreditprövning sker vid
            offert.
          </p>
        )}
      </div>

      {/* ── Trade-in ── */}
      <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-0.5">
            Inbyte
          </p>
          <p className="text-neutral-400 text-xs mb-3">
            Har du en motorcykel att byta in?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: "Ja" },
              { value: false, label: "Nej" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setHasTradeIn(opt.value)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  hasTradeIn === opt.value
                    ? "bg-white text-black border-white"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500 bg-neutral-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {hasTradeIn === true && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Märke"
                name="make"
                value={tradeIn.make}
                onChange={handleTradeInChange}
                placeholder="Kawasaki"
              />
              <Field
                label="Modell"
                name="model"
                value={tradeIn.model}
                onChange={handleTradeInChange}
                placeholder="Z650"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="År"
                name="year"
                value={tradeIn.year}
                onChange={handleTradeInChange}
                placeholder="2021"
                type="number"
              />
              <Field
                label="Körsträcka (km)"
                name="mileage"
                value={tradeIn.mileage}
                onChange={handleTradeInChange}
                placeholder="12 000"
                type="number"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Accessories ── */}
      <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-0.5">
            Tillbehör
          </p>
          <p className="text-neutral-400 text-xs mb-3">
            Är du intresserad av tillbehör?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: "Ja" },
              { value: false, label: "Nej" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setWantsAccessories(opt.value)}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  wantsAccessories === opt.value
                    ? "bg-white text-black border-white"
                    : "border-neutral-700 text-neutral-400 hover:border-neutral-500 bg-neutral-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {wantsAccessories === true && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap gap-2">
              {ACCESSORY_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleAccessory(item)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    selectedAccessories.includes(item)
                      ? "bg-white text-black border-white"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500 bg-neutral-800"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
                Övrigt{" "}
                <span className="text-neutral-600 normal-case tracking-normal">
                  (valfritt)
                </span>
              </label>
              <input
                type="text"
                value={accessoryNote}
                onChange={(e) => setAccessoryNote(e.target.value)}
                placeholder="T.ex. specifik färg, märke..."
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Optional message */}
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
          Meddelande{" "}
          <span className="text-neutral-600 normal-case tracking-normal">
            (valfritt)
          </span>
        </label>
        <textarea
          name="message"
          rows={3}
          value={form.message}
          onChange={handleChange}
          placeholder="Övriga frågor eller önskemål..."
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-white text-black font-semibold text-sm py-3 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Skicka förfrågan
      </button>

      <p className="text-[10px] text-neutral-600 text-center leading-relaxed">
        Ingen bindning. AVA MC kontaktar dig med ett erbjudande inom 24 timmar.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
        {label} {required && <span className="text-white">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
      />
    </div>
  );
}
