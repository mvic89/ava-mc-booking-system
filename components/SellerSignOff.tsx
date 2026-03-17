"use client";

import { useState } from "react";
import type { TestDriveBooking } from "@/app/bikemenow/biketesting/data";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SellerSignOff({ booking }: { booking: TestDriveBooking }) {
  const [signed, setSigned] = useState(booking.sellerSigned);
  const [loading, setLoading] = useState(false);
  const completedAt = new Date().toISOString();

  function handleSign() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSigned(true);
    }, 2500);
  }

  return (
    <div className="space-y-4">

      {/* Customer signature — always completed */}
      <div className="border border-green-200 rounded-2xl p-4 bg-green-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
              Kunds signatur
            </p>
            <p className="text-slate-900 text-sm font-semibold">
              {booking.customer.firstName} {booking.customer.lastName}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {booking.customer.personalNumber}
            </p>
          </div>
          <div className="text-right">
            <span className="text-green-600 text-sm font-semibold">✓ Signerad</span>
            <p className="text-slate-400 text-[10px] mt-0.5">via BankID</p>
          </div>
        </div>
      </div>

      {/* Seller signature */}
      <div className={`border rounded-2xl p-4 ${signed ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"}`}>
        {signed ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
                Säljarens signatur
              </p>
              <p className="text-slate-900 text-sm font-semibold">AVA MC</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {formatDateTime(booking.completedAt ?? completedAt)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-green-600 text-sm font-semibold">✓ Signerad</span>
              <p className="text-slate-400 text-[10px] mt-0.5">via BankID</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">
                Säljarens signatur
              </p>
              <p className="text-slate-500 text-xs">
                Signera för att bekräfta att testkörningen har genomförts enligt villkoren.
              </p>
            </div>

            {/* BankID sign block */}
            <div className="border border-[#235971]/20 rounded-2xl p-5 bg-[#235971] flex flex-col items-center gap-4">
              {loading ? (
                <>
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">Väntar på BankID...</p>
                    <p className="text-white/60 text-xs mt-1">Öppna appen och godkänn signeringen.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-white font-bold text-xl tracking-widest">BankID</p>
                    <p className="text-white/60 text-xs mt-1">AVA MC — Säljare</p>
                  </div>
                  <button
                    onClick={handleSign}
                    className="w-full bg-white hover:bg-slate-50 text-[#235971] font-semibold text-sm py-2.5 rounded-xl transition-colors"
                  >
                    Signera slutförande
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Completion certificate */}
      {signed && (
        <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Slutfört dokument
          </p>
          {[
            ["Fordon",       `${booking.bike.brand} ${booking.bike.model} (${booking.bike.year})`],
            ["Förare",       `${booking.customer.firstName} ${booking.customer.lastName}`],
            ["Personnummer", booking.customer.personalNumber],
            ["Datum",        formatDateTime(booking.completedAt ?? completedAt)],
            ["Max tid",      "15 minuter"],
            ["Självrisk",    "15 000 kr vid skada"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-slate-400">{label}</span>
              <span className="text-slate-800 font-medium text-right ml-4">{value}</span>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Kund</p>
              <p className="text-green-600 text-xs font-semibold mt-0.5">✓ BankID</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Säljare</p>
              <p className="text-green-600 text-xs font-semibold mt-0.5">✓ BankID</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
