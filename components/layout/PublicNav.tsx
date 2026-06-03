"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { Home, Menu, Search, ShoppingCart, Store, User, Zap } from "lucide-react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"

import { COMMAND_K_OPEN_EVENT } from "@/components/CommandK"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ThemeToggle } from "@/components/marketing/theme-toggle"
import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { NavPill } from "@/components/navigation/nav-pill"
import { Link as LocaleLink, usePathname } from "@/i18n/navigation"
import { buttonVariants } from "@/components/ui/button"
import { loginCustomerPath, MARKETPLACE_BUYER_ORDERS_PATH } from "@/lib/login-redirect"
import { openMobileBuyerHub } from "@/lib/buyer-hub-events"
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
  const tHub = useTranslations("marketplace.mobileHub")
  const tCmd = useTranslations("CommandK")
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === "CUSTOMER"
  const cartCount = useCartCount()

  const onHome = pathname === "/"
  const onShops = pathname === "/shops" || pathname.startsWith("/shops/")
  const onMarketplace = pathname === "/marketplace" || pathname.startsWith("/marketplace")
  const isBuyerContext =
    pathname === "/track-order" || pathname.startsWith("/marketplace/account")
  const signInHref = isBuyerContext
    ? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH)
    : "/login"

  return (
    <nav
      aria-label="Main"
      className="mx-auto grid w-full min-w-0 max-w-7xl grid-cols-[minmax(0,auto)_minmax(0,1fr)_minmax(0,auto)] items-center gap-x-1.5 gap-y-2 px-1.5 py-2 text-sm sm:gap-x-3 sm:px-2 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:gap-x-4"
    >
      <LocaleLink href="/" className="col-start-1 row-start-1 shrink-0">
        <motion.span
          className={cn("text-lg font-bold affisell-logo-text", "affisell-brand-wordmark")}
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.2 }}
        >
          Affisell
        </motion.span>
      </LocaleLink>

      <button
        type="button"
        onClick={openMobileBuyerHub}
        className="col-start-2 row-start-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/90 bg-zinc-50/95 text-zinc-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/40 lg:hidden"
        aria-label={tHub("openMenu")}
      >
        <Menu className="size-4" aria-hidden />
      </button>

      <div className="relative z-20 col-start-3 row-start-1 flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2 lg:col-start-4">
        <LanguageSwitcher />
        <span className="hidden sm:inline-flex">
          <ThemeToggle />
        </span>
        <Link
          href="/cart"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "relative h-9 gap-1 px-2 sm:gap-1.5 sm:px-3"
          )}
          aria-label={t("cartAria")}
        >
          <>
            <ShoppingCart className="size-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{t("cart")}</span>
            {cartCount > 0 ? (
              <motion.span
                key={cartCount}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6366F1] px-1 text-[10px] font-bold text-white"
              >
                {cartCount > 9 ? "9+" : cartCount}
              </motion.span>
            ) : null}
          </>
        </Link>
        {status !== "loading" && isCustomer ? (
          <Link href="/marketplace/account" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <User className="size-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{t("myAccount")}</span>
          </Link>
        ) : (
          <Link
            href={signInHref}
            className={cn(buttonVariants({ size: "sm" }), "h-9 shrink-0 px-2.5 text-xs sm:px-4 sm:text-sm")}
          >
            <User className="size-4 sm:hidden" aria-hidden />
            <span className="hidden sm:inline">{t("signIn")}</span>
          </Link>
        )}
      </div>

      <div className="col-span-3 col-start-1 row-start-2 hidden min-w-0 shrink-0 items-center gap-0.5 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:flex">
        <NavPill href="/" label={t("home")} icon={Home} active={onHome} localeAware />
        <NavPill href="/marketplace" label={t("marketplace")} icon={Search} active={onMarketplace} />
        <NavPill
          href="/shops"
          label={t("creatorStores")}
          shortLabel={t("creatorStoresShort")}
          icon={Store}
          active={onShops}
        />
      </div>

      <Suspense
        fallback={
          <div className="col-span-3 col-start-1 row-start-3 h-10 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1" aria-hidden />
        }
      >
        <div className="col-span-3 col-start-1 row-start-3 flex min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:justify-center">
          <div className="flex w-full min-w-0 max-w-full items-center rounded-full border border-zinc-200/90 bg-zinc-50/95 pl-1 shadow-sm ring-violet-500/10 transition-[box-shadow] focus-within:border-violet-300/80 focus-within:ring-2 focus-within:ring-violet-500/25 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:focus-within:border-violet-500/50 lg:max-w-xl">
            <NavHeaderSearch
              id="public-header-search-q"
              placeholder={t("searchPlaceholder")}
              searchTarget="marketplace"
            />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(COMMAND_K_OPEN_EVENT))}
              className="mr-1 hidden shrink-0 items-center gap-1 rounded-full border border-zinc-200/80 bg-white/90 px-2 py-1 text-[10px] font-semibold text-zinc-600 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 sm:mr-1.5 sm:inline-flex dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/50 dark:hover:text-violet-200"
              aria-label={`${tCmd("triggerLabel")} (⌘K)`}
            >
              <Zap className="h-3 w-3 text-[#6366F1]" aria-hidden />
              <span className="hidden md:inline">{tCmd("triggerLabel")}</span>
              <kbd className="hidden rounded border border-zinc-200/90 bg-zinc-50 px-1 font-mono lg:inline dark:border-zinc-600 dark:bg-zinc-900">
                {t("cmdKBadge")}
              </kbd>
            </button>
          </div>
        </div>
      </Suspense>
    </nav>
  )
}
