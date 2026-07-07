"use client"

import { useEffect, useState } from "react"
import {
  Heart,
  Home,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  User,
  type LucideIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { FastLink } from "@/components/navigation/fast-link"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import { affisellBrand } from "@/lib/affisell-brand"
import { barePathname, shouldHideMobileDock } from "@/lib/mobile-chrome"
import { resolveMobileDockItems, type MobileDockItemId } from "@/lib/mobile-dock-config"
import { resolvePublicNavMode } from "@/lib/public-nav-mode"
import { cn } from "@/lib/utils"

const DOCK_ICONS: Record<MobileDockItemId, LucideIcon> = {
  home: Home,
  explore: Search,
  pulse: Sparkles,
  stores: Store,
  cart: ShoppingBag,
  orders: Package,
  account: User,
  wishlist: Heart,
}

/** Floating thumb dock for public buyers (mobile). */
export function MobileDock() {
  const t = useTranslations("nav.dock")
  const pathname = usePathname() ?? ""
  const bare = barePathname(pathname)
  const { data: session } = useSession()
  const role = session?.user?.role
  const cartCount = useBuyerCartCount()
  const mode = resolvePublicNavMode(bare)
  const dockItems = resolveMobileDockItems(mode)
  const [compact, setCompact] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)
  const hidden =
    role === "AFFILIATE" || role === "SUPPLIER" || shouldHideMobileDock(pathname)

  useEffect(() => {
    if (hidden) return

    let lastY = window.scrollY
    let ticking = false

    const syncCompact = () => {
      const nextY = window.scrollY
      const goingDown = nextY > lastY + 8
      const nearTop = nextY < 96
      setCompact(goingDown && !nearTop)
      lastY = nextY
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(syncCompact)
    }

    syncCompact()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [hidden])

  useEffect(() => {
    if (hidden) return

    const footer = document.querySelector(".affisell-site-footer")
    if (!footer) return

    let ticking = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(() => {
          setFooterVisible(entry.isIntersecting)
          ticking = false
        })
      },
      { rootMargin: "0px 0px 96px 0px", threshold: 0.02 }
    )

    observer.observe(footer)
    return () => observer.disconnect()
  }, [hidden])

  if (hidden) return null

  return (
    <nav
      aria-label={t("aria")}
      className={cn(
        "affisell-mobile-buyer-dock pointer-events-none fixed inset-x-0 bottom-0 z-[90] w-full max-w-[100vw] overflow-x-clip px-2 pb-[max(0.3rem,env(safe-area-inset-bottom,0px))] md:hidden",
        compact && "affisell-mobile-buyer-dock--compact",
        footerVisible && "affisell-mobile-buyer-dock--footer-hide",
        mode === "account" && "affisell-mobile-dock--account"
      )}
    >
      <ul
        className={cn(
          affisellBrand.epoxySurfaceLight,
          "affisell-mobile-dock-epoxy pointer-events-auto mx-auto flex w-full max-w-md items-end justify-between gap-0.5 rounded-[1.55rem] p-1 ring-1 ring-violet-500/10 dark:ring-violet-400/15"
        )}
      >
        {dockItems.map(({ id, href, labelKey, featured, match }) => {
          const Icon = DOCK_ICONS[id]
          const active = match(bare)
          return (
            <li key={id} className={cn("flex flex-1 justify-center", featured && "-mt-2")}>
              <FastLink
                href={href}
                className={cn(
                  "relative flex min-h-11 w-full min-w-0 max-w-[4.1rem] flex-col items-center justify-center gap-0.5 rounded-[1rem] px-1 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] transition-all duration-200 active:scale-95 sm:px-1.5",
                  featured &&
                    !active &&
                    "rounded-[1rem] bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 text-white shadow-lg shadow-violet-600/35 ring-2 ring-white/50 dark:ring-zinc-900/80",
                  featured &&
                    active &&
                    "rounded-[1rem] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-fuchsia-500/40 ring-2 ring-fuchsia-300/60",
                  !featured &&
                    active &&
                    "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900",
                  !featured && !active && "text-zinc-500 dark:text-zinc-400"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("shrink-0", featured ? "size-5.5" : "size-4.5")}
                  aria-hidden
                  strokeWidth={featured ? 2.25 : 2}
                />
                {id === "cart" ? <CartCountBadge count={cartCount} size="sm" /> : null}
                <span className="max-w-full truncate">{t(labelKey)}</span>
              </FastLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
