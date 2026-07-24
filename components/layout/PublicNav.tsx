"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Heart,
  Home,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Truck,
  User,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { ThemeToggleDeferred } from "@/components/marketing/theme-toggle-deferred"
import { CommandKTriggerDeferred } from "@/components/navigation/command-k-trigger-deferred"
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
import {
  PUBLIC_NAV_ACCOUNT_LINKS,
  resolvePublicNavBackHref,
  resolvePublicNavMode,
} from "@/lib/public-nav-mode"
import { resolvePublicNavSearchContext } from "@/lib/public-nav-search-context"
import { isResellerStoresNavContext } from "@/lib/public-nav-stores-context"
import { cn } from "@/lib/utils"

const ACCOUNT_ICONS = {
  orders: Package,
  wishlist: Heart,
  hub: User,
  track: Truck,
} as const

function isAccountNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PublicNav() {
  const t = useTranslations("PublicNav")
  const tHub = useTranslations("marketplace.mobileHub")
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const isCustomer = session?.user?.role === "CUSTOMER"
  const isResellerStoresNav = isResellerStoresNavContext(session?.user?.role, pathname)
  const cartCount = useBuyerCartCount({ deferSync: true })
  const [explorerHash, setExplorerHash] = useState(false)

  useEffect(() => {
    const syncHash = () => {
      setExplorerHash(window.location.hash === "#explorer")
    }
    syncHash()
    window.addEventListener("hashchange", syncHash)
    return () => window.removeEventListener("hashchange", syncHash)
  }, [pathname])

  const mode = resolvePublicNavMode(pathname)
  const { onHome, onMarketplace, onShops } = resolvePublicNavActive(pathname, explorerHash)
  const searchContext = resolvePublicNavSearchContext(pathname, explorerHash)

  const isBuyerContext =
    pathname === "/track-order" || pathname.startsWith("/marketplace/account")
  const signInHref = isBuyerContext
    ? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH)
    : "/login"

  const cartAria = cartCount > 0 ? `${t("cartAria")} (${cartCount})` : t("cartAria")
  const backHref = resolvePublicNavBackHref(pathname)
  const backLabel =
    pathname === "/success" || pathname.startsWith("/success/")
      ? t("modeBackOrders")
      : t("modeBackShopping")

  const searchShellClass =
    "flex w-full min-w-0 items-center rounded-full border border-zinc-200/90 bg-zinc-50/95 shadow-sm ring-violet-500/10 transition-[box-shadow,border-color] focus-within:border-violet-300/80 focus-within:ring-2 focus-within:ring-violet-500/25 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:focus-within:border-violet-500/50"

  const showCompactMobileUtilities = mode !== "account"
  const searchMaxWidthClass = useMemo(
    () => (mode === "account" ? "lg:max-w-xl" : "lg:max-w-2xl"),
    [mode]
  )

  const logo = (
    <LocaleLink href="/" className="shrink-0 lg:col-start-1 lg:row-start-1">
      <span className={cn("text-lg font-bold affisell-logo-text", "affisell-brand-wordmark")}>Affisell</span>
    </LocaleLink>
  )

  const mobileMenu = (
    <button
      type="button"
      onClick={openMobileBuyerHub}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-zinc-50/95 text-zinc-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/40 lg:hidden"
      aria-label={tHub("openMenu")}
    >
      <Menu className="size-4" aria-hidden />
    </button>
  )

  const mobileUtilities = (
    <div className="flex shrink-0 items-center gap-1 lg:hidden">
      {mode === "account" ? <LanguageSwitcher /> : null}
      {showCompactMobileUtilities ? <ThemeToggleDeferred className="shrink-0" /> : null}
      <FastLink
        href="/cart"
        className={cn(
          buttonVariants({ size: "sm" }),
          "relative h-9 min-w-9 gap-1 border-0 bg-violet-600 px-2.5 text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
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
  )

  const desktopUtilities = (options?: { showAgent?: boolean }) => (
    <div className="relative z-20 hidden min-w-0 items-center justify-end gap-1 sm:gap-2 lg:col-start-4 lg:row-start-1 lg:flex">
      {options?.showAgent ? (
        <FastLink
          href="/agent"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-violet-200/90 bg-gradient-to-r from-violet-50 via-fuchsia-50/90 to-violet-50 px-2.5 text-xs font-semibold text-violet-800 shadow-sm transition hover:border-violet-300 hover:from-violet-100 hover:to-fuchsia-100 dark:border-violet-500/35 dark:from-violet-950/70 dark:via-fuchsia-950/50 dark:to-violet-950/70 dark:text-violet-100 dark:hover:border-violet-400/50"
          aria-label={t("agentEntry")}
        >
          <Sparkles className="size-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
          <span className="hidden xl:inline">{t("agentEntry")}</span>
        </FastLink>
      ) : null}
      <LanguageSwitcher />
      <ThemeToggleDeferred className="shrink-0" />
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
  )

  const browsePills = (
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
        label={isResellerStoresNav ? t("resellerStores") : t("trustedStores")}
        shortLabel={isResellerStoresNav ? t("resellerStoresShort") : t("trustedStoresShort")}
        icon={isResellerStoresNav ? TrendingUp : ShieldCheck}
        active={onShops}
        activeVariant="brand"
        statusBadge={isResellerStoresNav ? t("resellerStoresBadge") : undefined}
      />
    </div>
  )

  const accountPills = (
    <div className="hidden min-w-0 items-center gap-0.5 overflow-x-auto lg:col-start-2 lg:row-start-1 lg:flex affisell-public-nav-pills">
      {PUBLIC_NAV_ACCOUNT_LINKS.map(({ id, href, labelKey, exact }) => (
        <NavPill
          key={id}
          href={href}
          label={t(labelKey)}
          icon={ACCOUNT_ICONS[id]}
          active={isAccountNavActive(pathname, href, exact)}
          activeVariant="brand"
        />
      ))}
    </div>
  )

  const searchBlock = (options: { suggestions: boolean; hideOnMobileHome?: boolean }) => (
    <Suspense
      fallback={<div className="h-9 min-w-0 lg:col-start-3 lg:row-start-1" aria-hidden />}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 lg:col-start-3 lg:row-start-1 lg:justify-center",
          options.hideOnMobileHome && onHome && "hidden md:flex"
        )}
      >
        <div className={cn(searchShellClass, searchMaxWidthClass)}>
          <NavHeaderSearch
            id="public-header-search-q"
            placeholder={t("searchPlaceholder")}
            searchTarget="marketplace"
            enableSuggestions={options.suggestions}
            searchContext={searchContext}
          />
        </div>
        {options.suggestions ? <CommandKTriggerDeferred className="hidden lg:inline-flex" /> : null}
      </div>
    </Suspense>
  )

  const backLink = (
    <FastLink
      href={backHref}
      className="inline-flex min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 hover:text-violet-950 dark:text-violet-200 dark:hover:bg-violet-950/50 dark:hover:text-violet-50 lg:justify-self-center"
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{backLabel}</span>
    </FastLink>
  )

  return (
    <>
      {mode === "transaction" ? (
        <nav
          aria-label="Main"
          className="affisell-public-nav affisell-public-nav--transaction mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-1 px-1 py-1 text-sm sm:px-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-x-3 lg:py-2"
        >
          <div className="flex min-w-0 items-center gap-2 lg:contents">
            {logo}
            <div className="min-w-0 flex-1 lg:col-start-2 lg:row-start-1">{backLink}</div>
            {mobileMenu}
            {mobileUtilities}
          </div>
          {desktopUtilities()}
        </nav>
      ) : mode === "account" ? (
        <nav
          aria-label="Main"
          className="affisell-public-nav affisell-public-nav--account mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-1 px-1 py-1 text-sm sm:px-2 lg:grid lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-0 lg:py-2"
        >
          <div className="flex min-w-0 items-center justify-between gap-2 lg:contents">
            {logo}
            {mobileMenu}
            {mobileUtilities}
          </div>
          {accountPills}
          {searchBlock({ suggestions: false })}
          {desktopUtilities()}
        </nav>
      ) : (
        <nav
          aria-label="Main"
          className="affisell-public-nav mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-1 px-1 py-1 text-sm sm:px-2 lg:grid lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-0 lg:py-2"
        >
          <div className="flex min-w-0 items-center justify-between gap-2 lg:contents">
            {logo}
            {mobileMenu}
            {mobileUtilities}
          </div>
          {browsePills}
          {searchBlock({ suggestions: true, hideOnMobileHome: true })}
          {desktopUtilities({ showAgent: true })}
        </nav>
      )}
    </>
  )
}
