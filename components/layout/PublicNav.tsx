"use client"

import { Suspense, useEffect, useState } from "react"
import { Home, Menu, Search, ShoppingCart, Store, User, Zap } from "lucide-react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { COMMAND_K_OPEN_EVENT } from "@/components/CommandK"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ThemeToggle } from "@/components/marketing/theme-toggle"
import { NavHeaderSearch } from "@/components/nav/nav-header-search"
import { FastLink } from "@/components/navigation/fast-link"
import { NavPill } from "@/components/navigation/nav-pill"
import { Link as LocaleLink, usePathname } from "@/i18n/navigation"
import { buttonVariants } from "@/components/ui/button"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { openMobileBuyerHub } from "@/lib/buyer-hub-events"
import { loginCustomerPath, MARKETPLACE_BUYER_ORDERS_PATH } from "@/lib/login-redirect"
import { resolvePublicNavActive } from "@/lib/public-nav-active"
import { cn } from "@/lib/utils"

function CommandKTrigger({ className }: { className?: string }) {
  const t = useTranslations("PublicNav")
  const tCmd = useTranslations("CommandK")

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(COMMAND_K_OPEN_EVENT))}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/90 px-2.5 text-xs font-semibold text-zinc-600 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/50 dark:hover:text-violet-200",
        className
      )}
      aria-label={`${tCmd("triggerLabel")} (⌘K)`}
    >
      <Zap className="size-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
      <kbd className="hidden rounded border border-zinc-200/90 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] lg:inline dark:border-zinc-600 dark:bg-zinc-950">
        {t("cmdKBadge")}
      </kbd>
    </button>
  )
}

export function PublicNav() {
  const t = useTranslations("PublicNav")
  const tHub = useTranslations("marketplace.mobileHub")
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === "CUSTOMER"
  const cartCount = useBuyerCartCount()
  const [explorerHash, setExplorerHash] = useState(false)

  useEffect(() => {
    const syncHash = () => {
      setExplorerHash(window.location.hash === "#explorer")
    }
    syncHash()
    window.addEventListener("hashchange", syncHash)
    return () => window.removeEventListener("hashchange", syncHash)
  }, [pathname])

  const { onHome, onMarketplace, onShops } = resolvePublicNavActive(pathname, explorerHash)

  const isBuyerContext =
    pathname === "/track-order" || pathname.startsWith("/marketplace/account")
  const signInHref = isBuyerContext
    ? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH)
    : "/login"

  const cartAria = cartCount > 0 ? `${t("cartAria")} (${cartCount})` : t("cartAria")

  const searchShellClass =
    "flex w-full min-w-0 items-center rounded-full border border-zinc-200/90 bg-zinc-50/95 shadow-sm ring-violet-500/10 transition-[box-shadow,border-color] focus-within:border-violet-300/80 focus-within:ring-2 focus-within:ring-violet-500/25 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:focus-within:border-violet-500/50"

  return (
    <nav
      aria-label="Main"
      className="affisell-public-nav mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-2 px-1.5 py-2 text-sm sm:px-2 lg:grid lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-0"
    >
      <div className="flex min-w-0 items-center justify-between gap-2 lg:contents">
        <LocaleLink href="/" className="shrink-0 lg:col-start-1 lg:row-start-1">
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
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-zinc-50/95 text-zinc-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/40 lg:hidden"
          aria-label={tHub("openMenu")}
        >
          <Menu className="size-4" aria-hidden />
        </button>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:hidden">
          <LanguageSwitcher />
          <ThemeToggle className="shrink-0" />
          <FastLink
            href="/cart"
            className={cn(
              buttonVariants({ size: "sm" }),
              "relative h-9 gap-1 border-0 bg-violet-600 px-2.5 text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
            )}
            aria-label={cartAria}
          >
            <ShoppingCart className="size-4 shrink-0" aria-hidden />
            <CartCountBadge count={cartCount} size="md" />
          </FastLink>
          {status !== "loading" && isCustomer ? (
            <FastLink
              href="/marketplace/account"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 w-9 px-0")}
              aria-label={t("myAccount")}
            >
              <User className="size-4 shrink-0" aria-hidden />
            </FastLink>
          ) : (
            <FastLink
              href={signInHref}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 w-9 px-0")}
              aria-label={t("signIn")}
            >
              <User className="size-4 shrink-0" aria-hidden />
            </FastLink>
          )}
        </div>
      </div>

      <div className="hidden min-w-0 items-center gap-0.5 lg:col-start-2 lg:row-start-1 lg:flex affisell-public-nav-pills">
        <NavPill
          href="/"
          label={t("home")}
          icon={Home}
          active={onHome}
          activeVariant="brand"
          localeAware
        />
        <NavPill
          href={PUBLIC_MARKETPLACE_BROWSE_PATH}
          label={t("marketplace")}
          icon={Search}
          active={onMarketplace}
          activeVariant="brand"
        />
        <NavPill
          href="/shops"
          label={t("creatorStores")}
          shortLabel={t("creatorStoresShort")}
          icon={Store}
          active={onShops}
          activeVariant="brand"
        />
      </div>

      <Suspense
        fallback={
          <div className="h-10 min-w-0 lg:col-start-3 lg:row-start-1" aria-hidden />
        }
      >
        <div className="flex min-w-0 items-center gap-2 lg:col-start-3 lg:row-start-1 lg:justify-center">
          <div className={cn(searchShellClass, "lg:max-w-2xl")}>
            <NavHeaderSearch
              id="public-header-search-q"
              placeholder={t("searchPlaceholder")}
              searchTarget="marketplace"
            />
          </div>
          <CommandKTrigger />
        </div>
      </Suspense>

      <div className="relative z-20 hidden min-w-0 items-center justify-end gap-1 sm:gap-2 lg:col-start-4 lg:row-start-1 lg:flex">
        <LanguageSwitcher />
        <ThemeToggle className="shrink-0" />
        <FastLink
          href="/cart"
          className={cn(
            buttonVariants({ size: "sm" }),
            "relative h-9 gap-1.5 border-0 bg-violet-600 px-3 text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
          )}
          aria-label={cartAria}
        >
          <ShoppingCart className="size-4 shrink-0" aria-hidden />
          <span className="hidden md:inline">{t("cart")}</span>
          <CartCountBadge count={cartCount} size="md" />
        </FastLink>
        {status !== "loading" && isCustomer ? (
          <FastLink
            href="/marketplace/account"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 gap-1.5")}
          >
            <User className="size-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{t("myAccount")}</span>
          </FastLink>
        ) : (
          <FastLink
            href={signInHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 px-3")}
          >
            <User className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("signIn")}</span>
          </FastLink>
        )}
      </div>
    </nav>
  )
}
