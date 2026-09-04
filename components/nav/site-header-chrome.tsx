"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { isBuyerPremiumHomePathname } from "@/lib/buyer-premium-home-route"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
}

/**
 * Sticky public header — Apple-like minimal on mobile (no trust band);
 * desktop keeps the epoxy shell + scroll glass.
 */
export function SiteHeaderChrome({ children }: Props) {
  const pathname = usePathname() ?? ""
  const buyerPremiumHome = isBuyerPremiumHomePathname(pathname)
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
        buyerPremiumHome
          ? "border-b-0 bg-transparent pt-[env(safe-area-inset-top,0px)] backdrop-blur-none dark:bg-transparent md:px-0 md:pt-0"
          : "border-b border-zinc-200/50 bg-white/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl dark:border-zinc-800/60 dark:bg-black/80 md:border-b-0 md:bg-transparent md:px-4 md:pt-3 md:backdrop-blur-none dark:md:bg-transparent",
        "transition-[padding,background,backdrop-filter] duration-300",
        !buyerPremiumHome && compact && "affisell-global-site-header--compact md:pt-2",
        !buyerPremiumHome && scrolled && "affisell-global-site-header--scrolled"
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-7xl min-w-0",
          buyerPremiumHome ? "px-4 sm:px-6" : "px-3 md:px-0"
        )}
      >
        <div
          className={cn(
            "affisell-header-shell relative min-w-0 overflow-x-hidden overflow-y-visible md:overflow-visible",
            buyerPremiumHome
              ? "border-0 bg-transparent shadow-none backdrop-blur-none max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-none md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:backdrop-blur-none"
              : "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-none",
            !buyerPremiumHome && compact && "affisell-header-shell--compact",
            !buyerPremiumHome && scrolled && "affisell-header-shell--scrolled"
          )}
        >
          {!buyerPremiumHome ? (
            <>
              <div className="affisell-header-mesh pointer-events-none absolute inset-0 max-md:hidden" aria-hidden />
              <div
                className="affisell-header-band pointer-events-none absolute inset-x-0 bottom-0 z-[1] max-md:hidden"
                aria-hidden
              />
            </>
          ) : null}
          <div className="relative z-[2]">{children}</div>
        </div>
      </div>
    </header>
  )
}
