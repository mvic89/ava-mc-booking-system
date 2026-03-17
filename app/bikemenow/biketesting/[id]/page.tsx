import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    <div className="max-w-2xl mx-auto p-6 md:p-8 pb-24">
      {/* Back */}
      <Link
        href="/bikemenow/biketesting"
        className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-widest"
      >
        ← Testkörningar
      </Link>

      {/* Header */}
      <div className="mt-5 mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Testkörning
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">
            {booking.customer.firstName} {booking.customer.lastName}
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Önskat datum: {formatDate(booking.requestedDate)}
          </p>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-1 rounded border shrink-0 mt-1 ${meta.bg} ${meta.color}`}
        >
          {meta.label}
        </span>
      </div>

      {/* Customer + Bike */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Customer */}
        <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Förare
          </p>
          {[
            ["Namn", `${booking.customer.firstName} ${booking.customer.lastName}`],
            ["Personnummer", booking.customer.personalNumber],
            ["Telefon", booking.customer.phone],
            ["E-post", booking.customer.email],
            ["Adress", booking.customer.address],
            ["Postnummer", booking.customer.zipCode],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] text-neutral-600 font-mono">{label}</p>
              <p className="text-neutral-200 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* Bike */}
        <div className="border border-neutral-700 rounded-xl overflow-hidden bg-neutral-800/40">
          <div className="relative h-32 w-full">
            <Image
              src={booking.bike.image}
              alt={`${booking.bike.brand} ${booking.bike.model}`}
              fill
              className="object-cover"
            />
          </div>
          <div className="p-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
              {booking.bike.brand}
            </p>
            <p className="text-white font-semibold text-sm">{booking.bike.model}</p>
            <p className="text-neutral-400 text-xs">
              {booking.bike.year} · {booking.bike.type}
            </p>
          </div>
        </div>
      </div>

      {/* Terms reminder */}
      <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-900 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-mono mb-2">
          Gällande villkor
        </p>
        <p className="text-neutral-500 text-xs leading-relaxed">
          Provkörning max 15 minuter i närheten av försäljningsstället. Självrisk{" "}
          <span className="text-neutral-300">15 000 kr</span> vid skada orsakad
          av föraren. Kunden har godkänt dessa villkor och signerat med BankID.
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 border-t border-neutral-800" />
        <span className="text-[10px] uppercase tracking-widest text-neutral-600 font-mono">
          Signaturer
        </span>
        <div className="flex-1 border-t border-neutral-800" />
      </div>

      {/* Sign-off */}
      <SellerSignOff booking={booking} />
    </div>
  );
}
