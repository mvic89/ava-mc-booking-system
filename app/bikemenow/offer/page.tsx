import Link from "next/link";
import { inquiries, statusMeta, Status } from "../data";

const statusOrder: Status[] = ["new", "reviewing", "sent", "accepted", "declined"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const counts = {
  new: inquiries.filter((i) => i.status === "new").length,
  reviewing: inquiries.filter((i) => i.status === "reviewing").length,
  sent: inquiries.filter((i) => i.status === "sent").length,
};

export default function OfferDashboard() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <Link
          href="/bikemenow"
          className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-widest"
        >
          ← BikeMenuNow
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Offerter</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Nya", value: counts.new, color: "text-blue-400" },
          { label: "Granskas", value: counts.reviewing, color: "text-amber-400" },
          { label: "Skickade", value: counts.sent, color: "text-orange-400" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40"
          >
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
              {["Kund", "Motorcykel", "Datum", "Betalning", "Inbyte", "Tillbehör", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-[10px] uppercase tracking-widest text-neutral-500 font-mono px-4 py-3"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {[...inquiries]
              .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
              .map((inq, i) => {
                const meta = statusMeta[inq.status];
                return (
                  <tr
                    key={inq.id}
                    className={`border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors ${
                      i === inquiries.length - 1 ? "border-none" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{inq.customer.name}</p>
                      <p className="text-neutral-500 text-xs">{inq.customer.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-neutral-200 text-xs">{inq.bike.brand} {inq.bike.model}</p>
                      <p className="text-neutral-500 text-xs">{inq.bike.price.toLocaleString("sv-SE")} kr</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">{formatDate(inq.submittedAt)}</td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {inq.payment === "cash" ? "Kontant" : "Finansiering"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {inq.tradeIn.has ? <span className="text-amber-400">Ja</span> : <span className="text-neutral-600">Nej</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {inq.accessories.wants ? <span className="text-blue-400">Ja</span> : <span className="text-neutral-600">Nej</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bikemenow/offert/${inq.id}`}
                        className="text-[10px] font-mono text-neutral-500 hover:text-white transition-colors whitespace-nowrap"
                      >
                        Öppna →
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
        {[...inquiries]
          .sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status))
          .map((inq) => {
            const meta = statusMeta[inq.status];
            return (
              <Link
                key={inq.id}
                href={`/bikemenow/offert/${inq.id}`}
                className="block border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 hover:border-neutral-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-white font-medium text-sm">{inq.customer.name}</p>
                    <p className="text-neutral-500 text-xs mt-0.5">{inq.bike.brand} {inq.bike.model}</p>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-neutral-500">
                  <span>{formatDate(inq.submittedAt)}</span>
                  <span>{inq.payment === "cash" ? "Kontant" : "Finansiering"}</span>
                  {inq.tradeIn.has && <span className="text-amber-400">Inbyte</span>}
                  {inq.accessories.wants && <span className="text-blue-400">Tillbehör</span>}
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
