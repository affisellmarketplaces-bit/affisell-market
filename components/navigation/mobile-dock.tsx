"use client"

import { Home, Search, ShoppingBag, Store } from "lucide-react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { FastLink } from "@/components/navigation/fast-link"
import { PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { guestCartCount } from "@/lib/guest-cart"
import { cn } from "@/lib/utils"

/** Thumb-friendly dock for public buyers (mobile). */
export function MobileDock() {
  const t = useTranslations("nav.dock")
  const pathname = usePathname() ?? ""
  const { data: session } = useSession()
  const role = session?.user?.role
  const [cartCount, setCartCount] = useState(0)

  const dockItems = [
    { href: "/", label: t("home"), icon: Home, match: (p: string) => p === "/" || p === "/en" || p === "/fr" },
    {
      href: PUBLIC_SHOPS_PATH,
      label: t("stores"),
      icon: Store,
      match: (p: string) =>
        p === PUBLIC_SHOPS_PATH ||
        (/^\/shops\/[^/]+$/.test(p) && p !== PUBLIC_MARKETPLACE_BROWSE_PATH),
    },
    {
      href: PUBLIC_MARKETPLACE_BROWSE_PATH,
      label: t("explore"),
      icon: Search,
      match: (p: string) => p === PUBLIC_MARKETPLACE_BROWSE_PATH,
    },
    { href: "/cart", label: t("cart"), icon: ShoppingBag, match: (p: string) => p === "/cart" },
  ] as const

  useEffect(() => {
    const sync = () => setCartCount(guestCartCount())
    sync()
    window.addEventListener("affisell:cart-updated", sync)
    window.addEventListener("affisell:cart-added", sync)
    return () => {
      window.removeEventListener("affisell:cart-updated", sync)
      window.removeEventListener("affisell:cart-added", sync)
    }
  }, [])

  if (role === "AFFILIATE" || role === "SUPPLIER") return null
  if (pathname.startsWith("/login") || pathname.startsWith("/signup") || pathname.startsWith("/onboarding"))
    return null
  if (pathname.startsWith("/dashboard")) return null

  const onShopPdp = /^\/shops\/[^/]+\/product\//.test(pathname)
  if (onShopPdp) return null

  return (
    <nav
      aria-label={t("aria")}
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-zinc-200/90 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around gap-1">
        {dockItems.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          const showCartBadge = href === "/cart" && cartCount > 0
          return (
            <li key={href} className="flex-1">
              <FastLink
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] font-semibold transition-all duration-150",
                  active
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "text-zinc-500 active:scale-95"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {showCartBadge ? (
                  <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-950">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                ) : null}
                {label}
              </FastLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
