import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Sidebar from "@/components/Sidebar";
import { inquiries } from "./data";
import { bookings } from "./biketesting/data";

const offerStats = {
  new:       inquiries.filter((i) => i.status === "new").length,
  reviewing: inquiries.filter((i) => i.status === "reviewing").length,
  sent:      inquiries.filter((i) => i.status === "sent").length,
};

const testStats = {
  scheduled: bookings.filter((b) => b.status === "scheduled").length,
  completed: bookings.filter((b) => b.status === "completed").length,
};

export default async function BikeMenuNowHub() {
  const t = await getTranslations("offer");

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{t("sellerView")}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{t("title")}</h1>
        </div>

        <div className="flex-1 p-5 md:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">

            {/* Offers module */}
            <Link
              href="/offer/offers"
              className="group bg-white border border-slate-100 rounded-2xl p-6 hover:border-slate-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{t("module")}</p>
                  <h2 className="text-slate-900 font-bold text-lg mt-0.5">{t("offers")}</h2>
                </div>
                <span className="text-slate-300 group-hover:text-[#FF6B2C] transition-colors text-lg">→</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { key: "new",       value: offerStats.new,       color: "text-blue-600"   },
                  { key: "reviewing", value: offerStats.reviewing, color: "text-amber-600"  },
                  { key: "sent",      value: offerStats.sent,      color: "text-orange-600" },
                ].map(({ key, value, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">{t(`stats.${key}`)}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </Link>

            {/* Test rides module */}
            <Link
              href="/offer/biketesting"
              className="group bg-white border border-slate-100 rounded-2xl p-6 hover:border-slate-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{t("module")}</p>
                  <h2 className="text-slate-900 font-bold text-lg mt-0.5">{t("testRides")}</h2>
                </div>
                <span className="text-slate-300 group-hover:text-[#FF6B2C] transition-colors text-lg">→</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { key: "booked",    value: testStats.scheduled, color: "text-amber-600" },
                  { key: "completed", value: testStats.completed,  color: "text-green-600" },
                ].map(({ key, value, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-slate-500 text-xs">{t(`stats.${key}`)}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}
