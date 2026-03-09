"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "AVA MC", href: "/ava-mc", accent: "bg-orange-500" },
  { label: "BikeMenuNow", href: "/bikemenow", accent: "bg-blue-500" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-neutral-800 bg-neutral-950">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-neutral-800">
        <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">
          Dealer Portal
        </span>
        <h1 className="text-white font-bold text-lg mt-1 tracking-tight">
          BikeMenuNow
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-neutral-600 px-2 mb-3 font-mono">
          Clients
        </p>
        {navLinks.map(({ label, href, accent }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${accent}`} />
              {label}
              {active && (
                <span className="ml-auto w-1 h-4 rounded-full bg-white/20" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-neutral-800">
        <span className="text-[10px] text-neutral-600 font-mono">
          v0.1 — Lo-Fi Prototype
        </span>
      </div>
    </aside>
  );
}
