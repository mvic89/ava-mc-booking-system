'use client'

import { NavArray } from "@/utils/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"

const Sidebar = () => {
    const pathname = usePathname()

    return (
        <aside className="w-56 min-h-screen bg-[#1C1C2E] flex flex-col shrink-0">
            {/* Logo */}
            <div className="px-6 py-5 border-b border-white/10">
                <span className="text-orange-500 font-bold text-xl tracking-wide">BIKEME.NOW</span>
                {/* <span className="text-gray-500 text-xs">.3.0</span> */}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-3">
                {NavArray.map((item, index) => {
                    const isActive = pathname === item.link
                    return (
                        <Link
                            href={item.link}
                            key={index}
                            className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                                isActive
                                    ? "bg-white/10 text-white"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            <span className="text-base leading-none">{item.icon}</span>
                            <span>{item.name}</span>
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}

export default Sidebar
