import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { inquiries } from "./data";
import { bookings } from "./biketesting/data";

const offerStats = {
  new: inquiries.filter((i) => i.status === "new").length,
  reviewing: inquiries.filter((i) => i.status === "reviewing").length,
  sent: inquiries.filter((i) => i.status === "sent").length,
};

const testStats = {
  scheduled: bookings.filter((b) => b.status === "scheduled").length,
  completed: bookings.filter((b) => b.status === "completed").length,
};

export default function BikeMenuNowHub() {
  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col">
        <div className="flex-1 p-5 md:p-8">

          <div className="mb-8">
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
              Säljarvy
            </span>
            <h1 className="text-2xl font-bold text-white mt-1">BikeMenuNow</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {/* Offerter */}
            <Link
              href="/bikemenow/offer"
              className="group border border-neutral-700 rounded-xl p-6 bg-neutral-800/40 hover:border-neutral-500 hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
                    Modul
                  </p>
                  <h2 className="text-white font-bold text-lg mt-0.5">Offerter</h2>
                </div>
                <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors text-lg">
                  →
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Nya", value: offerStats.new, color: "text-blue-400" },
                  { label: "Granskas", value: offerStats.reviewing, color: "text-amber-400" },
                  { label: "Skickade", value: offerStats.sent, color: "text-orange-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-neutral-500 text-xs">{label}</span>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </Link>

            {/* Testkörningar */}
            <Link
              href="/bikemenow/biketesting"
              className="group border border-neutral-700 rounded-xl p-6 bg-neutral-800/40 hover:border-neutral-500 hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
                    Modul
                  </p>
                  <h2 className="text-white font-bold text-lg mt-0.5">
                    Testkörningar
                  </h2>
                </div>
                <span className="text-neutral-600 group-hover:text-neutral-400 transition-colors text-lg">
                  →
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "Bokade", value: testStats.scheduled, color: "text-amber-400" },
                  { label: "Slutförda", value: testStats.completed, color: "text-green-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-neutral-500 text-xs">{label}</span>
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
