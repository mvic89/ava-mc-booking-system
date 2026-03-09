import Link from "next/link";
import { bookings, testStatusMeta } from "./data";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BiketestingDashboard() {
  const scheduled = bookings.filter((b) => b.status === "scheduled");
  const completed = bookings.filter((b) => b.status === "completed");

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <Link
          href="/bikemenow"
          className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-widest"
        >
          ← BikeMenuNow
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Testkörningar</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-8 max-w-xs">
        {[
          { label: "Bokade", value: scheduled.length, color: "text-amber-400" },
          { label: "Slutförda", value: completed.length, color: "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-neutral-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block border border-neutral-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-700 bg-neutral-800/60">
              {["Kund", "Motorcykel", "Önskat datum", "Inskickat", "Kund", "Säljare", "Status", ""].map(
                (h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="text-left text-[10px] uppercase tracking-widest text-neutral-500 font-mono px-4 py-3"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {[...bookings]
              .sort((a, b) => (a.status === "scheduled" ? -1 : 1) - (b.status === "scheduled" ? -1 : 1))
              .map((booking, i) => {
                const meta = testStatusMeta[booking.status];
                return (
                  <tr
                    key={booking.id}
                    className={`border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors ${
                      i === bookings.length - 1 ? "border-none" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">
                        {booking.customer.firstName} {booking.customer.lastName}
                      </p>
                      <p className="text-neutral-500 text-xs">{booking.customer.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-neutral-200 text-xs">{booking.bike.brand} {booking.bike.model}</p>
                      <p className="text-neutral-500 text-xs">{booking.bike.type}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {formatDate(booking.requestedDate)}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {formatDate(booking.submittedAt)}
                    </td>
                    {/* Customer signature */}
                    <td className="px-4 py-3 text-xs">
                      <span className="text-green-400 font-mono">✓ BankID</span>
                    </td>
                    {/* Seller signature */}
                    <td className="px-4 py-3 text-xs">
                      {booking.sellerSigned ? (
                        <span className="text-green-400 font-mono">✓ BankID</span>
                      ) : (
                        <span className="text-neutral-600 font-mono">Väntar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bikemenow/biketesting/${booking.id}`}
                        className="text-[10px] font-mono text-neutral-500 hover:text-white transition-colors whitespace-nowrap"
                      >
                        {booking.status === "scheduled" ? "Signera →" : "Visa →"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-3">
        {[...bookings]
          .sort((a) => (a.status === "scheduled" ? -1 : 1))
          .map((booking) => {
            const meta = testStatusMeta[booking.status];
            return (
              <Link
                key={booking.id}
                href={`/bikemenow/biketesting/${booking.id}`}
                className="block border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 hover:border-neutral-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-white font-medium text-sm">
                      {booking.customer.firstName} {booking.customer.lastName}
                    </p>
                    <p className="text-neutral-500 text-xs mt-0.5">
                      {booking.bike.brand} {booking.bike.model}
                    </p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-neutral-500">
                  <span>{formatDate(booking.requestedDate)}</span>
                  <span className="text-green-400">Kund ✓</span>
                  {booking.sellerSigned
                    ? <span className="text-green-400">Säljare ✓</span>
                    : <span className="text-amber-400">Säljare väntar</span>
                  }
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
