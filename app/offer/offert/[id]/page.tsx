import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Sidebar from "@/components/Sidebar";
import { inquiries, getInquiry, statusMeta } from "../../data";
import OfferBuilder from "@/components//OfferBuilder";

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
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar />

      <div className="lg:ml-64 flex-1 flex flex-col min-w-0">
        <div className="brand-top-bar" />

        {/* Page header */}
        <div className="px-5 md:px-8 py-6 bg-white border-b border-slate-100 animate-fade-up">
          <Link
            href="/offer/offers"
            className="text-xs text-slate-400 uppercase tracking-widest font-semibold hover:text-slate-600 transition-colors"
          >
            ← Offerter
          </Link>
          <div className="flex items-center justify-between mt-1">
            <h1 className="text-2xl font-bold text-slate-900">{inq.customer.name}</h1>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
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
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Kund</p>
                {[
                  ["Namn",      inq.customer.name],
                  ["E-post",    inq.customer.email],
                  ["Telefon",   inq.customer.phone],
                  ["Betalning", inq.payment === "cash" ? "Kontant" : "Finansiering"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                    <p className="text-slate-800 text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Bike */}
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                <div className="relative h-28 w-full">
                  <Image
                    src={inq.bike.image}
                    alt={`${inq.bike.brand} ${inq.bike.model}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">{inq.bike.brand}</p>
                  <p className="text-slate-900 font-semibold text-sm">{inq.bike.model}</p>
                  <p className="text-slate-500 text-xs">
                    {inq.bike.price.toLocaleString("sv-SE")} kr · {inq.bike.year} · {inq.bike.type}
                  </p>
                </div>
              </div>
            </div>

            {/* Customer preferences */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-6 space-y-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Kundens önskemål</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Inbyte</p>
                  {inq.tradeIn.has ? (
                    <p className="text-amber-700 font-medium text-xs">
                      {inq.tradeIn.make} {inq.tradeIn.model} ({inq.tradeIn.year}) —{" "}
                      {parseInt(inq.tradeIn.mileage ?? "0").toLocaleString("sv-SE")} km
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs">Inget inbyte</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Tillbehör</p>
                  {inq.accessories.wants ? (
                    <div>
                      <p className="text-blue-700 font-medium text-xs">{inq.accessories.items?.join(", ")}</p>
                      {inq.accessories.note && (
                        <p className="text-slate-400 text-xs mt-0.5">&ldquo;{inq.accessories.note}&rdquo;</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs">Inga tillbehör</p>
                  )}
                </div>
              </div>

              {inq.message && (
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1">Meddelande</p>
                  <p className="text-slate-600 text-xs">&ldquo;{inq.message}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                Säljarens tillägg
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <OfferBuilder inq={inq} />

          </div>
        </div>
      </div>
    </div>
  );
}