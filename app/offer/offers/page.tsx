import Link from "next/link";
import Sidebar from "@/components/Sidebar";
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
  new:       inquiries.filter((i) => i.status === "new").length,
  reviewing: inquiries.filter((i) => i.status === "reviewing").length,
  sent:      inquiries.filter((i) => i.status === "sent").length,
};

export default function OfferDashboard() {
  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <Link
            href="/offer"
            className="text-xs text-slate-400 uppercase tracking-widest font-semibold hover:text-slate-600 transition-colors"
          >
            ← Offer
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Offerter</h1>
        </div>

        <div className="flex-1 p-5 md:p-8">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Nya",      value: counts.new,       color: "text-blue-600",   bg: "bg-blue-50"   },
              { label: "Granskas", value: counts.reviewing, color: "text-amber-600",  bg: "bg-amber-50"  },
              { label: "Skickade", value: counts.sent,      color: "text-orange-600", bg: "bg-orange-50" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Table — desktop */}
          <div className="hidden md:block bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Kund", "Motorcykel", "Datum", "Betalning", "Inbyte", "Tillbehör", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
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
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          i === inquiries.length - 1 ? "border-none" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-slate-900 font-medium">{inq.customer.name}</p>
                          <p className="text-slate-400 text-xs">{inq.customer.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700 text-xs">{inq.bike.brand} {inq.bike.model}</p>
                          <p className="text-slate-400 text-xs">{inq.bike.price.toLocaleString("sv-SE")} kr</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(inq.submittedAt)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {inq.payment === "cash" ? "Kontant" : "Finansiering"}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {inq.tradeIn.has
                            ? <span className="text-amber-600 font-medium">Ja</span>
                            : <span className="text-slate-300">Nej</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {inq.accessories.wants
                            ? <span className="text-blue-600 font-medium">Ja</span>
                            : <span className="text-slate-300">Nej</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/offer/offert/${inq.id}`}
                            className="text-xs font-semibold text-[#FF6B2C] hover:underline whitespace-nowrap"
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
                    href={`/offer/offert/${inq.id}`}
                    className="block bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-slate-900 font-medium text-sm">{inq.customer.name}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{inq.bike.brand} {inq.bike.model}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>{formatDate(inq.submittedAt)}</span>
                      <span>{inq.payment === "cash" ? "Kontant" : "Finansiering"}</span>
                      {inq.tradeIn.has && <span className="text-amber-600">Inbyte</span>}
                      {inq.accessories.wants && <span className="text-blue-600">Tillbehör</span>}
                    </div>
                  </Link>
                );
              })}
          </div>

        </div>
      </div>
    </div>
  );
}
