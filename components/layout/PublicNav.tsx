"use client"

import { Suspense, useEffect, useState } from "react"
import { Home, Search, ShoppingCart, Store, User } from "lucide-react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/marketing/theme-toggle"
import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { QuickNav } from "@/components/navigation/quick-nav"
import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function useCartCount(): number {
  const [count, setCount] = useState(0)
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user?.id) {
      setCount(0)
      return
    }
    fetch("/api/cart")
      .then((r) => r.json())
      .then((lines: unknown[]) => setCount(Array.isArray(lines) ? lines.length : 0))
      .catch(() => setCount(0))
  }, [session?.user?.id])

  return count
}

export function PublicNav() {
  const t = useTranslations("PublicNav")
  const pathname = usePathname() ?? ""
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === "CUSTOMER"
  const cartCount = useCartCount()

  const onHome = pathname === "/"
  const onShops =
    pathname === PUBLIC_SHOPS_PATH || pathname.startsWith(`${PUBLIC_SHOPS_PATH}/`)
  const onMarketplace =
    pathname === PUBLIC_MARKETPLACE_BROWSE_PATH ||
    pathname.startsWith("/shops/browse")

  const marketing =
    pathname === "/" || pathname === "/creators" || pathname === "/partners"

  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-1 py-1 text-sm md:flex-nowrap md:gap-3">
      <FastLink href="/" className="order-1 shrink-0">
        <motion.span
          className="text-lg font-bold affisell-logo-text"
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.2 }}
        >
          Affisell
        </motion.span>
      </FastLink>

      <div className="order-3 hidden min-w-0 flex-1 items-center gap-1 md:order-2 md:flex">
        <NavPill href="/" label={t("home")} icon={Home} active={onHome} />
        <NavPill
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          label={t("marketplace")}
          icon={Search}
          active={onMarketplace}
        />
        <NavPill
          href={PUBLIC_SHOPS_PATH}
          label={t("creatorStores")}
          icon={Store}
          active={onShops}
        />
      </div>

      <Suspense fallback={<div className="order-4 h-10 min-w-0 flex-1 md:order-3" aria-hidden />}>
        <div className="order-4 flex min-w-0 flex-1 items-center gap-2 md:order-3">
          <NavHeaderSearch
            id="public-header-search-q"
            placeholder={t("searchPlaceholder")}
            searchTarget="marketplace"
          />
          {marketing ? (
            <kbd className="hidden shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 sm:inline">
              {t("cmdKBadge")}
            </kbd>
          ) : null}
        </div>
      </Suspense>

      <div className="order-2 flex shrink-0 flex-wrap items-center gap-2 md:order-4">
        <LocaleSwitcher />
        <ThemeToggle />
        <QuickNav />
        <FastLink
          href="/cart"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "relative gap-1.5"
          )}
          aria-label={t("cartAria")}
        >
          <ShoppingCart className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{t("cart")}</span>
          {cartCount > 0 ? (
            <motion.span
              key={cartCount}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white"
            >
              {cartCount > 9 ? "9+" : cartCount}
            </motion.span>
          ) : null}
        </FastLink>
        {status !== "loading" && isCustomer ? (
          <FastLink
            href="/marketplace/account"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <User className="size-4 shrink-0" aria-hidden />
            {t("myAccount")}
          </FastLink>
        ) : (
          <FastLink href="/login" className={cn(buttonVariants({ size: "sm" }))}>
            {t("signIn")}
          </FastLink>
        )}
      </div>
    </nav>
  )
}
