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
      <div className="border border-green-900 rounded-xl p-4 bg-green-950/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-0.5">
              Kunds signatur
            </p>
            <p className="text-white text-sm font-medium">
              {booking.customer.firstName} {booking.customer.lastName}
            </p>
            <p className="text-neutral-500 text-xs mt-0.5">
              {booking.customer.personalNumber}
            </p>
          </div>
          <div className="text-right">
            <span className="text-green-400 text-sm font-mono">✓ Signerad</span>
            <p className="text-neutral-600 text-[10px] mt-0.5">via BankID</p>
          </div>
        </div>
      </div>

      {/* Seller signature */}
      <div
        className={`border rounded-xl p-4 ${
          signed
            ? "border-green-900 bg-green-950/20"
            : "border-neutral-700 bg-neutral-800/40"
        }`}
      >
        {signed ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-0.5">
                Säljarens signatur
              </p>
              <p className="text-white text-sm font-medium">AVA MC</p>
              <p className="text-neutral-500 text-xs mt-0.5">
                {formatDateTime(booking.completedAt ?? completedAt)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-green-400 text-sm font-mono">✓ Signerad</span>
              <p className="text-neutral-600 text-[10px] mt-0.5">via BankID</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-0.5">
                Säljarens signatur
              </p>
              <p className="text-neutral-400 text-xs">
                Signera för att bekräfta att testkörningen har genomförts enligt
                villkoren.
              </p>
            </div>

            {/* BankID sign */}
            <div className="border border-[#2a5a9a]/50 rounded-xl p-5 bg-[#183966]/20 flex flex-col items-center gap-4">
              {loading ? (
                <>
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
                    <p className="text-white font-bold text-xl tracking-widest">
                      BankID
                    </p>
                    <p className="text-[#6b9fd4] text-xs mt-1">AVA MC — Säljare</p>
                  </div>
                  <button
                    onClick={handleSign}
                    className="w-full bg-[#183966] hover:bg-[#1e4a82] border border-[#2a5a9a] text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
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
        <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Slutfört dokument
          </p>
          {[
            ["Fordon", `${booking.bike.brand} ${booking.bike.model} (${booking.bike.year})`],
            ["Förare", `${booking.customer.firstName} ${booking.customer.lastName}`],
            ["Personnummer", booking.customer.personalNumber],
            ["Datum", formatDateTime(booking.completedAt ?? completedAt)],
            ["Max tid", "15 minuter"],
            ["Självrisk", "15 000 kr vid skada"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-neutral-500">{label}</span>
              <span className="text-neutral-200 text-right ml-4">{value}</span>
            </div>
          ))}
          <div className="border-t border-neutral-700 pt-2.5 grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-neutral-600 font-mono">Kund</p>
              <p className="text-green-400 text-xs mt-0.5">✓ BankID</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-neutral-600 font-mono">Säljare</p>
              <p className="text-green-400 text-xs mt-0.5">✓ BankID</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
