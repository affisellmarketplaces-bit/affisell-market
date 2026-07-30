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
  Swords,
  TrendingUp,
  Truck,
  User,
  Wand2,
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
import { openMobileBuyerHub, openMobileSearch } from "@/lib/buyer-hub-events"
import { loginCustomerPath, MARKETPLACE_BUYER_ORDERS_PATH } from "@/lib/login-redirect"
import { resolvePublicNavActive } from "@/lib/public-nav-active"
import {
  PUBLIC_NAV_ACCOUNT_LINKS,
  resolvePublicNavBackHref,
  resolvePublicNavMode,
} from "@/lib/public-nav-mode"
import { resolvePublicNavSearchContext } from "@/lib/public-nav-search-context"
import { canSeeMagicLabChrome } from "@/lib/role-feature-matrix"
import { isResellerStoresNavContext } from "@/lib/public-nav-stores-context"
import { cn } from "@/lib/utils"

const ACCOUNT_ICONS = {
  orders: Package,
  wishlist: Heart,
  hub: User,
  track: Truck,
} as const

const mobileIconBtn =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/80 bg-zinc-100/90 text-zinc-800 shadow-sm transition active:scale-95 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:text-zinc-100"

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
  const showMagicLab = canSeeMagicLabChrome(session?.user?.role)
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
  const { onHome, onMarketplace, onShops, onDiscover, onBattles } = resolvePublicNavActive(
    pathname,
    explorerHash
  )
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

  const searchMaxWidthClass = useMemo(
    () => (mode === "account" ? "lg:max-w-xl" : "lg:max-w-2xl"),
    [mode]
  )

  /** Desktop wordmark — left-aligned in the lg grid. */
  const desktopLogo = (
    <LocaleLink href="/" className="hidden shrink-0 lg:col-start-1 lg:row-start-1 lg:block">
      <span className={cn("text-lg font-bold affisell-logo-text", "affisell-brand-wordmark")}>
        Affisell
      </span>
    </LocaleLink>
  )

  /** Mobile Apple/Linear bar: ☰ · Affisell · 🔍 + cart */
  const mobileMinimalBar = (
    <div className="relative flex h-11 w-full min-w-0 items-center justify-between lg:hidden">
      <button
        type="button"
        onClick={openMobileBuyerHub}
        className={mobileIconBtn}
        aria-label={tHub("openMenu")}
      >
        <Menu className="size-[18px]" aria-hidden />
      </button>

      <LocaleLink
        href="/"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <span className="affisell-logo-text affisell-brand-wordmark text-[1.05rem] font-black tracking-tight">
          Affisell
        </span>
      </LocaleLink>

      <div className="flex shrink-0 items-center gap-2">
        {mode !== "transaction" ? (
          <>
            <FastLink
              href="/discover"
              className={cn(
                mobileIconBtn,
                onDiscover &&
                  "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-500/50 dark:bg-violet-950/80 dark:text-violet-100"
              )}
              aria-label={t("pulseEntry")}
            >
              <Sparkles className="size-[18px]" aria-hidden />
            </FastLink>
            <FastLink
              href="/battles"
              className={cn(
                mobileIconBtn,
                onBattles &&
                  "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-500/50 dark:bg-fuchsia-950/80 dark:text-fuchsia-100"
              )}
              aria-label={t("battlesEntry")}
            >
              <Swords className="size-[18px]" aria-hidden />
            </FastLink>
            <button
              type="button"
              onClick={openMobileSearch}
              className={mobileIconBtn}
              aria-label={t("searchLabel")}
            >
              <Search className="size-[18px]" aria-hidden />
            </button>
          </>
        ) : null}
        <FastLink
          href="/cart"
          className="relative inline-flex size-9 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-500/30 transition active:scale-95 hover:bg-violet-700"
          aria-label={cartAria}
        >
          <ShoppingCart className="size-[18px] shrink-0" aria-hidden />
          <CartCountBadge
            count={cartCount}
            size="sm"
            className="-right-1 -top-1 bg-zinc-950 ring-1 ring-white dark:ring-zinc-900"
          />
        </FastLink>
      </div>
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
    <div className="affisell-public-nav-pills hidden min-w-0 max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] lg:col-start-2 lg:row-start-1 lg:flex [&::-webkit-scrollbar]:hidden">
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
        href="/discover"
        label={t("pulseEntry")}
        shortLabel={t("pulseEntryShort")}
        icon={Sparkles}
        active={onDiscover}
        activeVariant="brand"
        showNewBadge
      />
      <NavPill
        href="/battles"
        label={t("battlesEntry")}
        shortLabel={t("battlesEntryShort")}
        icon={Swords}
        active={onBattles}
        activeVariant="brand"
      />
      {showMagicLab ? (
        <NavPill
          href="/lab"
          label={t("magicLab")}
          shortLabel={t("magicLabShort")}
          icon={Wand2}
          active={pathname === "/lab" || pathname.startsWith("/lab/")}
          activeVariant="brand"
        />
      ) : null}
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

  const searchBlock = (options: { suggestions: boolean }) => (
    <Suspense
      fallback={
        <div
          className="hidden h-9 min-w-0 lg:col-start-3 lg:row-start-1 lg:block lg:min-w-[17rem]"
          aria-hidden
        />
      }
    >
      <div className="hidden min-w-0 items-center gap-2 lg:col-start-3 lg:row-start-1 lg:flex lg:min-w-[17rem] lg:justify-stretch">
        <div className={cn(searchShellClass, searchMaxWidthClass, "relative w-full overflow-visible")}>
          <NavHeaderSearch
            id="public-header-search-q"
            placeholder={t("searchPlaceholder")}
            searchTarget="marketplace"
            enableSuggestions={options.suggestions}
            searchContext={searchContext}
          />
        </div>
        {options.suggestions ? (
          <CommandKTriggerDeferred className="hidden shrink-0 lg:inline-flex" />
        ) : null}
      </div>
    </Suspense>
  )

  const backLink = (
    <FastLink
      href={backHref}
      className="hidden min-w-0 max-w-full items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 hover:text-violet-950 dark:text-violet-200 dark:hover:bg-violet-950/50 dark:hover:text-violet-50 lg:col-start-2 lg:row-start-1 lg:inline-flex lg:justify-self-center"
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
          {mobileMinimalBar}
          <div className="hidden min-w-0 items-center gap-2 lg:contents">
            {desktopLogo}
            {backLink}
          </div>
          {desktopUtilities()}
        </nav>
      ) : mode === "account" ? (
        <nav
          aria-label="Main"
          className="affisell-public-nav affisell-public-nav--account mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-1 px-1 py-1 text-sm sm:px-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_minmax(17rem,1.15fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-0 lg:py-2"
        >
          {mobileMinimalBar}
          {desktopLogo}
          {accountPills}
          {searchBlock({ suggestions: false })}
          {desktopUtilities()}
        </nav>
      ) : (
        <nav
          aria-label="Main"
          className="affisell-public-nav mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-1 px-1 py-1 text-sm sm:px-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_minmax(17rem,1.15fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-0 lg:py-2"
        >
          {mobileMinimalBar}
          {desktopLogo}
          {browsePills}
          {searchBlock({ suggestions: true })}
          {desktopUtilities({ showAgent: true })}
        </nav>
      )}
    </>
  )
}
