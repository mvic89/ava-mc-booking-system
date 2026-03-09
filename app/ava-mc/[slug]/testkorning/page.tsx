import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motorcycles, getMotorcycle } from "../../data";
import TestDriveForm from "@/app/components/TestDriveForm";

export function generateStaticParams() {
  return motorcycles.map((bike) => ({ slug: bike.slug }));
}

export default async function TestkorningPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bike = getMotorcycle(slug);
  if (!bike) notFound();

  return (
    <div className="max-w-lg mx-auto p-6 md:p-8 pb-24">
      {/* Back */}
      <Link
        href={`/ava-mc/${bike.slug}`}
        className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors uppercase tracking-widest"
      >
        ← {bike.brand} {bike.model}
      </Link>

      {/* Header */}
      <div className="mt-5 mb-6">
        <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
          Boka Testkörning
        </span>
        <h1 className="text-2xl font-bold text-white mt-1">Testkörning</h1>
        <p className="text-neutral-500 text-xs mt-1.5 leading-relaxed">
          Fyll i dina uppgifter, läs igenom villkoren och signera med BankID.
          Ingen bindning — AVA MC bekräftar datum inom 24 h.
        </p>
      </div>

      {/* Bike summary */}
      <div className="flex items-center gap-4 border border-neutral-700 rounded-xl p-3 bg-neutral-800/40 mb-8">
        <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0">
          <Image
            src={bike.image}
            alt={`${bike.brand} ${bike.model}`}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
            {bike.brand}
          </p>
          <p className="text-white font-semibold text-sm truncate">
            {bike.model}
          </p>
          <p className="text-neutral-400 text-xs mt-0.5">
            {bike.price.toLocaleString("sv-SE")} kr · {bike.year}
          </p>
        </div>
        <span className="text-[10px] font-mono border border-neutral-700 text-neutral-500 px-2 py-0.5 rounded shrink-0">
          {bike.type}
        </span>
      </div>

      {/* Multi-step form */}
      <TestDriveForm
        bikeName={`${bike.brand} ${bike.model}`}
        bikeSlug={bike.slug}
      />
    </div>
  );
}
