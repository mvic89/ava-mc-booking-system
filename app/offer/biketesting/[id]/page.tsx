import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import Sidebar from "@/components/Sidebar";
import { bookings, getBooking } from "../data";
import SellerSignOff from "@/components/SellerSignOff";

export function generateStaticParams() {
  return bookings.map((b) => ({ id: b.id }));
}

export default async function TestDriveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }   = await params;
  const booking  = getBooking(id);
  if (!booking) notFound();

  const t      = await getTranslations("offer");
  const locale = await getLocale();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  const statusColor = booking.status === "scheduled"
    ? { bg: "bg-amber-50", color: "text-amber-700" }
    : { bg: "bg-green-50",  color: "text-green-700"  };

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <Link
            href="/offer/biketesting"
            className="text-xs text-slate-400 uppercase tracking-widest font-semibold hover:text-slate-600 transition-colors"
          >
            ← {t("biketesting.title")}
          </Link>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {booking.customer.firstName} {booking.customer.lastName}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {t("biketesting.detail.requestedDate")} {formatDate(booking.requestedDate)}
              </p>
            </div>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusColor.bg} ${statusColor.color}`}>
              {t(`biketesting.testStatuses.${booking.status}` as "biketesting.testStatuses.scheduled")}
            </span>
          </div>
        </div>

        <div className="flex-1 p-5 md:p-8">
          <div className="max-w-2xl">

            {/* Customer + Bike */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
                  {t("biketesting.detail.driver")}
                </p>
                {([
                  [t("biketesting.detail.name"),           `${booking.customer.firstName} ${booking.customer.lastName}`],
                  [t("biketesting.detail.personalNumber"), booking.customer.personalNumber],
                  [t("biketesting.detail.phone"),          booking.customer.phone],
                  [t("biketesting.detail.email"),          booking.customer.email],
                  [t("biketesting.detail.address"),        booking.customer.address],
                  [t("biketesting.detail.zipCode"),        booking.customer.zipCode],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                    <p className="text-slate-800 text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                <div className="relative h-32 w-full">
                  <Image
                    src={booking.bike.image}
                    alt={`${booking.bike.brand} ${booking.bike.model}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{booking.bike.brand}</p>
                  <p className="text-slate-900 font-semibold text-sm">{booking.bike.model}</p>
                  <p className="text-slate-500 text-xs">{booking.bike.year} · {booking.bike.type}</p>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">
                {t("biketesting.detail.termsTitle")}
              </p>
              <p className="text-slate-500 text-xs leading-relaxed">
                {t("biketesting.detail.termsText", { excess: "15 000" })}
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                {t("biketesting.detail.signatures")}
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <SellerSignOff booking={booking} />

          </div>
        </div>
      </div>
    </div>
  );
}
