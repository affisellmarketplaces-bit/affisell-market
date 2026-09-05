"use client"

import { useEffect, useState, type ReactNode } from "react"

import { usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
}

/**
 * Sticky public header — Apple-like minimal on mobile (no trust band);
 * desktop keeps the epoxy shell + scroll glass.
 */
export function SiteHeaderChrome({ children }: Props) {
  const pathname = usePathname()
  const onBuyerPremiumHome = pathname === "/"
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
        "affisell-global-site-header sticky top-0 z-[200] w-full max-w-full shrink-0 overflow-x-clip overflow-y-visible md:overflow-visible",
        onBuyerPremiumHome
          ? "border-b-0 bg-transparent pt-[env(safe-area-inset-top,0px)] backdrop-blur-none dark:bg-transparent"
          : "border-b border-zinc-200/50 bg-white/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl dark:border-zinc-800/60 dark:bg-black/80",
        "md:border-b-0 md:bg-transparent md:px-4 md:pt-3 md:backdrop-blur-none dark:md:bg-transparent",
        "transition-[padding,background,backdrop-filter] duration-300",
        onBuyerPremiumHome && "affisell-global-site-header--buyer-home",
        compact && "affisell-global-site-header--compact md:pt-2",
        scrolled && !onBuyerPremiumHome && "affisell-global-site-header--scrolled"
      )}
    >
      <div className="mx-auto max-w-7xl min-w-0 px-3 md:px-0">
        <div
          className={cn(
            "affisell-header-shell relative min-w-0 overflow-x-hidden overflow-y-visible md:overflow-visible",
            onBuyerPremiumHome
              ? "affisell-header-shell--buyer-home max-md:mx-0 max-md:rounded-2xl max-md:border max-md:shadow-lg"
              : "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-none",
            compact && "affisell-header-shell--compact",
            scrolled && "affisell-header-shell--scrolled"
          )}
        >
          <div className="affisell-header-mesh pointer-events-none absolute inset-0 max-md:hidden" aria-hidden />
          <div className="affisell-header-band pointer-events-none absolute inset-x-0 bottom-0 z-[1] max-md:hidden" aria-hidden />
          <div className="relative z-[2]">{children}</div>
        </div>
      </div>
    </header>
  )
}
