"use client"

import { Home, Search, ShoppingBag, Sparkles, Store } from "lucide-react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { FastLink } from "@/components/navigation/fast-link"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import { PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { affisellBrand } from "@/lib/affisell-brand"
import { barePathname, shouldHideMobileDock } from "@/lib/mobile-chrome"
import { cn } from "@/lib/utils"

/** Floating thumb dock for public buyers (mobile). */
export function MobileDock() {
  const t = useTranslations("nav.dock")
  const pathname = usePathname() ?? ""
  const bare = barePathname(pathname)
  const { data: session } = useSession()
  const role = session?.user?.role
  const cartCount = useBuyerCartCount()

  const dockItems = [
    {
      href: "/",
      label: t("home"),
      icon: Home,
      match: (p: string) => p === "/",
    },
    {
      href: PUBLIC_MARKETPLACE_BROWSE_PATH,
      label: t("explore"),
      icon: Search,
      match: (p: string) => p === PUBLIC_MARKETPLACE_BROWSE_PATH,
    },
    {
      href: "/discover",
      label: t("pulse"),
      icon: Sparkles,
      match: (p: string) => p.startsWith("/discover"),
      featured: true,
    },
    {
      href: PUBLIC_SHOPS_PATH,
      label: t("stores"),
      icon: Store,
      match: (p: string) =>
        p === PUBLIC_SHOPS_PATH ||
        (/^\/shops\/[^/]+$/.test(p) && p !== PUBLIC_MARKETPLACE_BROWSE_PATH),
    },
    {
      href: "/cart",
      label: t("cart"),
      icon: ShoppingBag,
      match: (p: string) => p === "/cart",
    },
  ] as const

  if (role === "AFFILIATE" || role === "SUPPLIER") return null
  if (shouldHideMobileDock(pathname)) return null

  return (
    <nav
      aria-label={t("aria")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] w-full max-w-[100vw] overflow-x-clip px-3 pb-[max(0.4rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul
        className={cn(
          affisellBrand.epoxySurfaceLight,
          "affisell-mobile-dock-epoxy pointer-events-auto mx-auto flex w-full max-w-md items-end justify-between gap-0.5 rounded-[1.85rem] p-1.5 ring-1 ring-violet-500/10 dark:ring-violet-400/15"
        )}
      >
        {dockItems.map(({ href, label, icon: Icon, match, ...rest }) => {
          const featured = "featured" in rest && rest.featured
          const active = match(bare)
          return (
            <li key={href} className={cn("flex flex-1 justify-center", featured && "-mt-3")}>
              <FastLink
                href={href}
                className={cn(
                  "relative flex w-full min-w-0 max-w-[4.25rem] flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[8px] font-bold uppercase tracking-wide transition-all duration-200 active:scale-95 sm:px-1.5 sm:text-[9px]",
                  featured &&
                    !active &&
                    "rounded-[1.15rem] bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 text-white shadow-lg shadow-violet-600/35 ring-2 ring-white/50 dark:ring-zinc-900/80",
                  featured &&
                    active &&
                    "rounded-[1.15rem] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-fuchsia-500/40 ring-2 ring-fuchsia-300/60",
                  !featured &&
                    active &&
                    "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900",
                  !featured && !active && "text-zinc-500 dark:text-zinc-400"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("shrink-0", featured ? "size-6" : "size-5")}
                  aria-hidden
                  strokeWidth={featured ? 2.25 : 2}
                />
                {href === "/cart" ? <CartCountBadge count={cartCount} size="sm" /> : null}
                <span className="max-w-full truncate">{label}</span>
              </FastLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
