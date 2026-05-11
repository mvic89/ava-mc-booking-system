'use client'

import { useRef, useState } from 'react'

/**
 * Hover tooltip that auto-flips to right-anchored when the element is near
 * the right edge of the viewport, preventing horizontal overflow.
 */
export function Tip({ text, children }: { text: string; children: React.ReactNode }) {
    const ref       = useRef<HTMLDivElement>(null)
    const [flip, setFlip] = useState(false)

    const onEnter = () => {
        if (!ref.current) return
        const { left } = ref.current.getBoundingClientRect()
        // 220px = tooltip width (w-52 208px) + breathing room
        setFlip(left + 220 > window.innerWidth)
    }

    return (
        <div ref={ref} className="relative group/tip" onMouseEnter={onEnter}>
            {children}
            <div
                className={`
                    absolute z-50 bottom-full mb-2 w-52 px-2.5 py-1.5
                    bg-gray-900 text-white text-[11px] leading-snug
                    rounded-lg shadow-xl whitespace-normal
                    pointer-events-none opacity-0 group-hover/tip:opacity-100
                    transition-opacity duration-150
                    ${flip ? 'right-0' : 'left-0'}
                `}
            >
                {text}
                <div
                    className={`absolute top-full border-[5px] border-transparent border-t-gray-900 ${flip ? 'right-4' : 'left-4'}`}
                />
            </div>
        </div>
    )
}
