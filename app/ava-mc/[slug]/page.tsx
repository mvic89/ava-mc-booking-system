import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motorcycles, getMotorcycle } from "../data";
import FinanceCalculator from "@/app/components/FinanceCalculator";

export function generateStaticParams() {
  return motorcycles.map((bike) => ({ slug: bike.slug }));
}

export default async function MotorcyclePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bike = getMotorcycle(slug);
  if (!bike) notFound();

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 pb-24">
      {/* Back */}
      <Link
        href="/ava-mc"
        className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-widest"
      >
        ← AVA MC
      </Link>

      {/* Hero image */}
      <div className="relative w-full h-64 rounded-xl overflow-hidden mt-5">
        <Image
          src={bike.image}
          alt={`${bike.brand} ${bike.model}`}
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Name */}
      <div className="mt-5">
        <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
          {bike.brand} · {bike.type}
        </span>
        <h1 className="text-3xl font-bold text-white mt-1">{bike.model}</h1>
        <p className="text-neutral-400 text-sm mt-2 italic">
          &ldquo;{bike.lifestyle.tagline}&rdquo;
        </p>
      </div>

      {/* Quick specs */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          ["Motor", bike.specs.engine],
          ["Effekt", bike.specs.power],
          ["Vridmoment", bike.specs.torque],
          ["Vikt", bike.specs.weight],
          ["Säteshöjd", bike.specs.seatHeight],
          ["Tank", bike.specs.fuelCapacity],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border border-neutral-700 rounded-lg p-3 bg-neutral-800/40"
          >
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
              {label}
            </p>
            <p className="text-white text-xs font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Section: Financial ── */}
      <section className="mt-10">
        <SectionLabel>Ekonomi</SectionLabel>
        <div className="mt-4 border border-neutral-700 rounded-xl p-5 bg-neutral-800/40">
          <FinanceCalculator price={bike.price} />
        </div>
      </section>

      {/* ── Section: Mechanical ── */}
      <section className="mt-10">
        <SectionLabel>Mekanik & Underhåll</SectionLabel>
        <div className="mt-4 border border-neutral-700 rounded-xl p-5 bg-neutral-800/40 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
                Serviceintervall
              </p>
              <p className="text-white text-sm font-semibold mt-1">
                {bike.mechanical.serviceInterval}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
                Garanti
              </p>
              <p className="text-white text-sm font-semibold mt-1">
                {bike.mechanical.warranty}
              </p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
              Driftsäkerhet
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed">
              {bike.mechanical.reliability}
            </p>
          </div>
        </div>
      </section>

      {/* ── Section: Lifestyle ── */}
      <section className="mt-10">
        <SectionLabel>Livsstil & Varumärke</SectionLabel>
        <div className="mt-4 border border-neutral-700 rounded-xl p-5 bg-neutral-800/40 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
              Vem passar den för?
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed">
              {bike.lifestyle.riderProfile}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono mb-1.5">
              Varumärket
            </p>
            <p className="text-neutral-300 text-sm leading-relaxed">
              {bike.lifestyle.brandStory}
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA: Offer ── */}
      <section className="mt-10">
        <div className="border border-neutral-700 rounded-xl p-6 bg-neutral-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white font-semibold">Redo att gå vidare?</p>
            <p className="text-neutral-400 text-xs mt-1">
              Begär ett erbjudande så återkommer vi inom 24 h.
            </p>
          </div>
          <Link
            href={`/ava-mc/${bike.slug}/offert`}
            className="shrink-0 bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            Begär Offert
          </Link>
        </div>
      </section>

      {/* ── CTA: Test drive ── */}
      <section className="mt-4">
        <div className="border border-neutral-700 rounded-xl p-6 bg-neutral-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-white font-semibold">Vill du provköra först?</p>
            <p className="text-neutral-400 text-xs mt-1">
              Boka en provkörning — max 15 min, signeras med BankID.
            </p>
          </div>
          <Link
            href={`/ava-mc/${bike.slug}/testkorning`}
            className="shrink-0 border border-neutral-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Boka Testkörning
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
        {children}
      </span>
      <div className="flex-1 border-t border-neutral-800" />
    </div>
  );
}
