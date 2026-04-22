import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import Sidebar from "@/components/Sidebar";
import { bookings } from "./data";

export default async function BiketestingDashboard() {
  const t      = await getTranslations("offer");
  const locale = await getLocale();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const scheduled = bookings.filter((b) => b.status === "scheduled");
  const completed  = bookings.filter((b) => b.status === "completed");

  const sorted = [...bookings].sort((a, b) =>
    (a.status === "scheduled" ? -1 : 1) - (b.status === "scheduled" ? -1 : 1)
  );

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
            ← {t("biketesting.back")}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{t("biketesting.title")}</h1>
        </div>

        <div className="flex-1 p-5 md:p-8">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-xs">
            {[
              { key: "scheduled", value: scheduled.length, color: "text-amber-600" },
              { key: "completed",  value: completed.length,  color: "text-green-600" },
            ].map(({ key, value, color }) => (
              <div key={key} className="bg-white border border-slate-100 rounded-2xl p-5">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-1">{t(`biketesting.stats.${key}` as "biketesting.stats.scheduled")}</p>
              </div>
            ))}
          </div>

          {/* Table — desktop */}
          <div className="hidden md:block bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {[
                    t("biketesting.table.customer"),
                    t("biketesting.table.motorcycle"),
                    t("biketesting.table.requestedDate"),
                    t("biketesting.table.submitted"),
                    t("biketesting.table.customer"),
                    t("biketesting.table.seller"),
                    t("biketesting.table.status"),
                    "",
                  ].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="text-left text-[10px] uppercase tracking-widest text-slate-400 font-semibold px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((booking, i) => (
                  <tr
                    key={booking.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      i === bookings.length - 1 ? "border-none" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-slate-900 font-medium">
                        {booking.customer.firstName} {booking.customer.lastName}
                      </p>
                      <p className="text-slate-400 text-xs">{booking.customer.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700 text-xs">{booking.bike.brand} {booking.bike.model}</p>
                      <p className="text-slate-400 text-xs">{booking.bike.type}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(booking.requestedDate)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(booking.submittedAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-green-600 font-semibold">✓ BankID</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {booking.sellerSigned
                        ? <span className="text-green-600 font-semibold">✓ BankID</span>
                        : <span className="text-slate-400">{t("biketesting.waiting")}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        booking.status === "scheduled"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700"
                      }`}>
                        {t(`biketesting.testStatuses.${booking.status}` as "biketesting.testStatuses.scheduled")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/offer/biketesting/${booking.id}`}
                        className="text-xs font-semibold text-[#FF6B2C] hover:underline whitespace-nowrap"
                      >
                        {booking.status === "scheduled" ? t("biketesting.sign") : t("biketesting.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {sorted.map((booking) => (
              <Link
                key={booking.id}
                href={`/offer/biketesting/${booking.id}`}
                className="block bg-white border border-slate-100 rounded-2xl p-4 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-slate-900 font-medium text-sm">
                      {booking.customer.firstName} {booking.customer.lastName}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {booking.bike.brand} {booking.bike.model}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    booking.status === "scheduled"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-700"
                  }`}>
                    {t(`biketesting.testStatuses.${booking.status}` as "biketesting.testStatuses.scheduled")}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>{formatDate(booking.requestedDate)}</span>
                  <span className="text-green-600 font-semibold">{t("biketesting.mobile.customerSigned")}</span>
                  {booking.sellerSigned
                    ? <span className="text-green-600 font-semibold">{t("biketesting.mobile.sellerSigned")}</span>
                    : <span className="text-amber-600">{t("biketesting.mobile.sellerWaiting")}</span>}
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
