import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import Sidebar from "@/components/Sidebar";
import { inquiries, statusMeta, Status } from "../data";

const statusOrder: Status[] = ["new", "reviewing", "sent", "accepted", "declined"];

const counts = {
  new:       inquiries.filter((i) => i.status === "new").length,
  reviewing: inquiries.filter((i) => i.status === "reviewing").length,
  sent:      inquiries.filter((i) => i.status === "sent").length,
};

export default async function OfferDashboard() {
  const t      = await getTranslations("offer");
  const locale = await getLocale();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  }

  const sorted = [...inquiries].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <Link
            href="/offer"
            className="text-xs text-slate-400 uppercase tracking-widest font-semibold hover:text-slate-600 transition-colors"
          >
            ← {t("title")}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{t("offers")}</h1>
        </div>

        <div className="flex-1 p-5 md:p-8">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { key: "new",       value: counts.new,       color: "text-blue-600",   bg: "bg-blue-50"   },
              { key: "reviewing", value: counts.reviewing, color: "text-amber-600",  bg: "bg-amber-50"  },
              { key: "sent",      value: counts.sent,      color: "text-orange-600", bg: "bg-orange-50" },
            ].map(({ key, value, color }) => (
              <div key={key} className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-1">{t(`stats.${key}`)}</p>
              </div>
            ))}
          </div>

          {/* Table — desktop */}
          <div className="hidden md:block bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[t("table.customer"), t("table.motorcycle"), t("table.date"), t("table.payment"), t("table.tradeIn"), t("table.accessories"), t("table.status"), ""].map((h, i) => (
                    <th key={i} className="text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((inq, i) => {
                  const meta = statusMeta[inq.status];
                  return (
                    <tr key={inq.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i === inquiries.length - 1 ? "border-none" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="text-slate-900 font-medium">{inq.customer.name}</p>
                        <p className="text-slate-400 text-xs">{inq.customer.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 text-xs">{inq.bike.brand} {inq.bike.model}</p>
                        <p className="text-slate-400 text-xs">{inq.bike.price.toLocaleString(locale)} kr</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(inq.submittedAt)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {t(`payment.${inq.payment}`)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {inq.tradeIn.has
                          ? <span className="text-amber-600 font-medium">{t("yes")}</span>
                          : <span className="text-slate-300">{t("no")}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {inq.accessories.wants
                          ? <span className="text-blue-600 font-medium">{t("yes")}</span>
                          : <span className="text-slate-300">{t("no")}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                          {t(`statuses.${inq.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/offer/offert/${inq.id}`} className="text-xs font-semibold text-[#FF6B2C] hover:underline whitespace-nowrap">
                          {t("open")}
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
            {sorted.map((inq) => {
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
                      {t(`statuses.${inq.status}`)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{formatDate(inq.submittedAt)}</span>
                    <span>{t(`payment.${inq.payment}`)}</span>
                    {inq.tradeIn.has && <span className="text-amber-600">{t("table.tradeIn")}</span>}
                    {inq.accessories.wants && <span className="text-blue-600">{t("table.accessories")}</span>}
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
