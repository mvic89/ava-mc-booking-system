"use client";

import { useState, useRef } from "react";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, label: "Uppgifter" },
  { id: 2, label: "Villkor" },
  { id: 3, label: "Signera" },
  { id: 4, label: "Klar" },
];

const TERMS = [
  "Provkörning får endast ske under en kortare sträcka i närheten av försäljningsstället. Maximalt 15 minuter.",
  "Föraren är ersättningsskyldig för sådan skada på fordonet som uppkommit genom förarens vållande. Självrisk debiteras föraren med ett belopp av 15.000 kr.",
  "Föraren intygar att han/hon innehar giltigt körkort för den aktuella fordonskategorin och att körkortet inte är återkallat, omhändertaget eller på annat sätt ogiltigt.",
  "Fordonet får inte framföras under påverkan av alkohol, narkotika eller andra berusningsmedel.",
  "Eventuella trafikförseelser och parkeringsböter som uppstår under provkörningen är förarens ansvar.",
  "Provkörningen sker på förarens egen risk vad gäller personskada.",
  "AVA MC förbehåller sig rätten att avbryta provkörningen om säkerhetsmässiga skäl föreligger.",
  "Genom att signera detta dokument bekräftar föraren att ovanstående villkor har lästs, förståtts och godkänts i sin helhet. Dokumentet är bindande för båda parter.",
];

type FormData = {
  firstName: string;
  lastName: string;
  address: string;
  zipCode: string;
  personalNumber: string;
  phone: string;
  email: string;
  date: string;
};

export default function TestDriveForm({
  bikeName,
  bikeSlug,
}: {
  bikeName: string;
  bikeSlug: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [termsRead, setTermsRead] = useState(false);
  const [bankIdLoading, setBankIdLoading] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    address: "",
    zipCode: "",
    personalNumber: "",
    phone: "",
    email: "",
    date: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleTermsScroll() {
    const el = termsRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) {
      setTermsRead(true);
    }
  }

  function handleBankId() {
    setBankIdLoading(true);
    setTimeout(() => {
      setBankIdLoading(false);
      setStep(4);
    }, 2500);
  }

  const step1Valid =
    form.firstName &&
    form.lastName &&
    form.address &&
    form.zipCode &&
    form.personalNumber &&
    form.phone &&
    form.email &&
    form.date;

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 transition-opacity ${
                step === s.id
                  ? "opacity-100"
                  : step > s.id
                  ? "opacity-60"
                  : "opacity-25"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono border transition-colors ${
                  step > s.id
                    ? "bg-white border-white text-black"
                    : step === s.id
                    ? "border-white text-white"
                    : "border-neutral-700 text-neutral-600"
                }`}
              >
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="text-[10px] font-mono text-neutral-400 hidden sm:block">
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-5 h-px bg-neutral-700 mx-2 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Personal details ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Förnamn"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              placeholder="Anna"
            />
            <Field
              label="Efternamn"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              placeholder="Svensson"
            />
          </div>
          <Field
            label="Adress"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Storgatan 1"
          />
          <Field
            label="Postnummer"
            name="zipCode"
            value={form.zipCode}
            onChange={handleChange}
            placeholder="123 45"
          />
          <div>
            <Field
              label="Personnummer"
              name="personalNumber"
              value={form.personalNumber}
              onChange={handleChange}
              placeholder="ÅÅÅÅMMDD-XXXX"
            />
            <p className="text-[10px] text-neutral-600 mt-1.5 leading-relaxed">
              Används för identifiering via BankID. Lagras ej utan ditt
              samtycke.
            </p>
          </div>
          <Field
            label="Telefon"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="070 000 00 00"
            type="tel"
          />
          <Field
            label="E-post"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="anna@exempel.se"
            type="email"
          />
          <Field
            label="Önskat datum"
            name="date"
            value={form.date}
            onChange={handleChange}
            type="date"
          />
          <button
            onClick={() => setStep(2)}
            disabled={!step1Valid}
            className="w-full bg-white text-black font-semibold text-sm py-3 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-2"
          >
            Fortsätt →
          </button>
        </div>
      )}

      {/* ── Step 2: Terms ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1">
              Provkörningsvillkor
            </p>
            <p className="text-neutral-500 text-xs">
              Läs igenom villkoren i sin helhet för att gå vidare.
            </p>
          </div>

          <div
            ref={termsRef}
            onScroll={handleTermsScroll}
            className="h-60 overflow-y-auto border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-3"
          >
            {TERMS.map((para, i) => (
              <p key={i} className="text-neutral-300 text-sm leading-relaxed">
                {para}
              </p>
            ))}
            {/* Spacer so last line isn't cut off */}
            <div className="h-2" />
          </div>

          {!termsRead ? (
            <p className="text-[10px] text-neutral-600 font-mono text-center">
              ↓ Scrolla till botten för att fortsätta
            </p>
          ) : (
            <p className="text-[10px] text-green-600 font-mono text-center">
              ✓ Villkor lästa
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-neutral-700 text-neutral-400 text-sm py-2.5 rounded-lg hover:border-neutral-500 transition-colors"
            >
              ← Tillbaka
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!termsRead}
              className="flex-1 bg-white text-black font-semibold text-sm py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Jag godkänner →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: BankID ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1">
              Signera med BankID
            </p>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Öppna BankID-appen och bekräfta din identitet för att slutföra
              bokningen.
            </p>
          </div>

          {/* BankID card */}
          <div className="border border-[#2a5a9a]/50 rounded-xl p-6 bg-[#183966]/20 flex flex-col items-center gap-5">
            {bankIdLoading ? (
              <>
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-white text-sm font-medium">
                    Väntar på BankID...
                  </p>
                  <p className="text-[#6b9fd4] text-xs mt-1">
                    Öppna appen och godkänn signeringen.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-white font-bold text-2xl tracking-widest">
                    BankID
                  </p>
                  <p className="text-[#6b9fd4] text-xs mt-1 font-mono">
                    {form.personalNumber}
                  </p>
                  <p className="text-neutral-500 text-xs mt-0.5">
                    {form.firstName} {form.lastName}
                  </p>
                </div>
                <button
                  onClick={handleBankId}
                  className="w-full bg-[#183966] hover:bg-[#1e4a82] border border-[#2a5a9a] text-white font-semibold text-sm py-3 rounded-lg transition-colors"
                >
                  Öppna BankID
                </button>
              </>
            )}
          </div>

          {!bankIdLoading && (
            <button
              onClick={() => setStep(2)}
              className="w-full border border-neutral-700 text-neutral-400 text-sm py-2.5 rounded-lg hover:border-neutral-500 transition-colors"
            >
              ← Tillbaka
            </button>
          )}
        </div>
      )}

      {/* ── Step 4: Confirmation ── */}
      {step === 4 && (
        <div className="flex flex-col items-center text-center py-8 px-4">
          <div className="w-12 h-12 rounded-full border border-neutral-600 flex items-center justify-center mb-5">
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
          <h2 className="text-white font-bold text-xl">Bokning bekräftad</h2>
          <p className="text-neutral-400 text-sm mt-2 max-w-xs leading-relaxed">
            Din testkörning av{" "}
            <span className="text-white">{bikeName}</span> är signerad. AVA MC
            återkommer för att bekräfta datum.
          </p>

          {/* Summary */}
          <div className="mt-6 border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 text-left w-full max-w-xs space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1">
              Bokningssammanfattning
            </p>
            {[
              ["Namn", `${form.firstName} ${form.lastName}`],
              ["Datum", form.date],
              ["Signerad", "Via BankID"],
              ["Status", "Inväntar bekräftelse"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-neutral-500">{label}</span>
                <span
                  className={
                    label === "Signerad" ? "text-green-400" : "text-white"
                  }
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          <a
            href={`/ava-mc/${bikeSlug}`}
            className="mt-8 text-xs font-mono text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            ← Tillbaka till cykeln
          </a>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
        {label} <span className="text-white">*</span>
      </label>
      <input
        name={name}
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
      />
    </div>
  );
}
