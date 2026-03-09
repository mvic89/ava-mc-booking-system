import Link from "next/link";
import Image from "next/image";
import { motorcycles } from "./data";

export default function AvaMCPage() {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
          Client
        </span>
        <h1 className="text-2xl font-bold text-white mt-1">AVA MC</h1>
        <p className="text-neutral-400 text-sm mt-1">
          {motorcycles.length} motorcycles available
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {motorcycles.map((bike) => (
          <Link
            key={bike.slug}
            href={`/ava-mc/${bike.slug}`}
            className="group flex flex-col border border-neutral-700 rounded-xl overflow-hidden bg-neutral-800/40 hover:border-neutral-500 transition-colors"
          >
            {/* Image */}
            <div className="relative h-44 w-full">
              <Image
                src={bike.image}
                alt={`${bike.brand} ${bike.model}`}
                fill
                className="object-cover"
              />
            </div>

            {/* Info */}
            <div className="p-3">
              <p className="text-white font-semibold text-sm group-hover:text-neutral-200">
                {bike.brand} {bike.model}
              </p>
              <span className="text-[10px] font-mono text-neutral-500 mt-1 inline-block">
                {bike.type}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
