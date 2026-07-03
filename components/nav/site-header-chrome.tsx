"use client"

import { useEffect, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
}

/** Sticky public header — compact + scroll-linked glass after scroll. */
export function SiteHeaderChrome({ children }: Props) {
  const [compact, setCompact] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const sync = () => {
      const y = window.scrollY
      setCompact(y > 32)
      setScrolled(y > 120)
    }
    sync()
    window.addEventListener("scroll", sync, { passive: true })
    return () => window.removeEventListener("scroll", sync)
  }, [])

  return (
    <header
      className={cn(
        "affisell-global-site-header sticky top-0 z-[200] w-full max-w-full shrink-0 overflow-x-clip px-3 pt-[max(0.5rem,env(safe-area-inset-top))] transition-[padding,background,backdrop-filter] duration-300 md:px-4 md:pt-3",
        compact && "affisell-global-site-header--compact md:pt-2",
        scrolled && "affisell-global-site-header--scrolled"
      )}
    >
      <div
        className={cn(
          "affisell-header-shell relative mx-auto max-w-7xl min-w-0 overflow-hidden md:overflow-visible",
          compact && "affisell-header-shell--compact",
          scrolled && "affisell-header-shell--scrolled"
        )}
      >
        <div className="affisell-header-mesh pointer-events-none absolute inset-0" aria-hidden />
        <div className="affisell-header-band pointer-events-none absolute inset-x-0 bottom-0 z-[1]" aria-hidden />
        <div className="relative z-[2]">{children}</div>
      </div>
    </header>
  )
}
