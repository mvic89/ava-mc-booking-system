import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { bookings, getBooking, testStatusMeta } from "../data";
import SellerSignOff from "@/components/SellerSignOff";

export function generateStaticParams() {
  return bookings.map((b) => ({ id: b.id }));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function TestDriveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = getBooking(id);
  if (!booking) notFound();

  const meta = testStatusMeta[booking.status];

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <Link
            href="/bikemenow/biketesting"
            className="text-xs text-slate-400 uppercase tracking-widest font-semibold hover:text-slate-600 transition-colors"
          >
            ← Testkörningar
          </Link>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {booking.customer.firstName} {booking.customer.lastName}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Önskat datum: {formatDate(booking.requestedDate)}
              </p>
            </div>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="flex-1 p-5 md:p-8">
          <div className="max-w-2xl">

            {/* Customer + Bike */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Customer */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Förare</p>
                {[
                  ["Namn",         `${booking.customer.firstName} ${booking.customer.lastName}`],
                  ["Personnummer", booking.customer.personalNumber],
                  ["Telefon",      booking.customer.phone],
                  ["E-post",       booking.customer.email],
                  ["Adress",       booking.customer.address],
                  ["Postnummer",   booking.customer.zipCode],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                    <p className="text-slate-800 text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Bike */}
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

            {/* Terms reminder */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Gällande villkor</p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Provkörning max 15 minuter i närheten av försäljningsstället. Självrisk{" "}
                <span className="text-slate-800 font-semibold">15 000 kr</span> vid skada orsakad
                av föraren. Kunden har godkänt dessa villkor och signerat med BankID.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                Signaturer
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
