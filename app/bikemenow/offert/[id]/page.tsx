import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { inquiries, getInquiry, statusMeta } from "../../data";
import OfferBuilder from "@/app/components/OfferBuilder";

export function generateStaticParams() {
  return inquiries.map((i) => ({ id: i.id }));
}

export default async function OffertBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inq = getInquiry(id);
  if (!inq) notFound();

  const meta = statusMeta[inq.status];

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 pb-24">
      {/* Back */}
      <Link
        href="/bikemenow"
        className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-widest"
      >
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="mt-5 mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Offert
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">
            {inq.customer.name}
          </h1>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-1 rounded border shrink-0 mt-1 ${meta.bg} ${meta.color}`}
        >
          {meta.label}
        </span>
      </div>

      {/* ── Customer + Bike summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Customer */}
        <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 space-y-2.5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            Kund
          </p>
          {[
            ["Namn", inq.customer.name],
            ["E-post", inq.customer.email],
            ["Telefon", inq.customer.phone],
            ["Betalning", inq.payment === "cash" ? "Kontant" : "Finansiering"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] text-neutral-600 font-mono">{label}</p>
              <p className="text-neutral-200 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* Bike */}
        <div className="border border-neutral-700 rounded-xl overflow-hidden bg-neutral-800/40">
          <div className="relative h-28 w-full">
            <Image
              src={inq.bike.image}
              alt={`${inq.bike.brand} ${inq.bike.model}`}
              fill
              className="object-cover"
            />
          </div>
          <div className="p-4 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
              {inq.bike.brand}
            </p>
            <p className="text-white font-semibold text-sm">{inq.bike.model}</p>
            <p className="text-neutral-400 text-xs">
              {inq.bike.price.toLocaleString("sv-SE")} kr · {inq.bike.year} ·{" "}
              {inq.bike.type}
            </p>
          </div>
        </div>
      </div>

      {/* ── Customer's preferences (read-only) ── */}
      <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/40 mb-6 space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
          Kundens önskemål
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-neutral-600 font-mono mb-0.5">Inbyte</p>
            {inq.tradeIn.has ? (
              <p className="text-amber-400">
                {inq.tradeIn.make} {inq.tradeIn.model} ({inq.tradeIn.year}) —{" "}
                {parseInt(inq.tradeIn.mileage ?? "0").toLocaleString("sv-SE")} km
              </p>
            ) : (
              <p className="text-neutral-500">Inget inbyte</p>
            )}
          </div>
          <div>
            <p className="text-neutral-600 font-mono mb-0.5">Tillbehör</p>
            {inq.accessories.wants ? (
              <div>
                <p className="text-blue-400">
                  {inq.accessories.items?.join(", ")}
                </p>
                {inq.accessories.note && (
                  <p className="text-neutral-500 mt-0.5">
                    &ldquo;{inq.accessories.note}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <p className="text-neutral-500">Inga tillbehör</p>
            )}
          </div>
        </div>

        {inq.message && (
          <div>
            <p className="text-neutral-600 font-mono text-xs mb-0.5">
              Meddelande
            </p>
            <p className="text-neutral-300 text-xs">
              &ldquo;{inq.message}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 border-t border-neutral-800" />
        <span className="text-[10px] uppercase tracking-widest text-neutral-600 font-mono">
          Säljarens tillägg
        </span>
        <div className="flex-1 border-t border-neutral-800" />
      </div>

      {/* ── Seller's offer builder ── */}
      <OfferBuilder inq={inq} />
    </div>
  );
}
