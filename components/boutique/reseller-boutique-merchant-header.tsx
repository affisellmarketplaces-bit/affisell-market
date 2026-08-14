"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Globe, ShoppingCart } from "lucide-react"
import { useTranslations } from "next-intl"

import { BoutiqueMerchantAvatarMenu } from "@/components/boutique/boutique-merchant-avatar-menu"
import { FastLink } from "@/components/navigation/fast-link"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import {
  resolveBoutiqueMerchantNav,
  type BoutiqueMerchantRole,
} from "@/lib/boutique/boutique-merchant-header-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string
  storeName: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  role?: BoutiqueMerchantRole
  isOwner?: boolean
}

function AffisellMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="boutique-affisell-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        fill="url(#boutique-affisell-mark)"
        d="M6 26V6h5.2l5.4 11.2L22 6h5.2v20h-4.4V14.8L17.6 26h-3.2L9.2 14.8V26H6z"
      />
    </svg>
  )
}

function HeaderCartBadge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count)
  return (
    <span
      className={cn(
        "pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums leading-none",
        count > 0
          ? "bg-gradient-to-br from-rose-500 to-orange-500 text-white ring-2 ring-indigo-900"
          : "bg-cyan-400 text-indigo-950 ring-2 ring-indigo-900/80"
      )}
      aria-hidden
    >
      {label}
    </span>
  )
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <FastLink
      href={href}
      className={cn(
        "relative shrink-0 px-3 py-2 text-sm transition-colors",
        active ? "font-bold text-white" : "font-medium text-white/75 hover:text-white"
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {active ? (
        <span
          className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.85)]"
          aria-hidden
        />
      ) : null}
    </FastLink>
  )
}

export function ResellerBoutiqueMerchantHeader({
  storeSlug,
  storeName,
  logoUrl,
  aiAvatarUrl,
  role = "AFFILIATE",
  isOwner = false,
}: Props) {
  const t = useTranslations("boutique.merchantHeader")
  const pathname = usePathname() ?? ""
  const cartCount = useBuyerCartCount({ deferSync: true })
  const nav = resolveBoutiqueMerchantNav(role, storeSlug)

  const onDashboard =
    pathname === nav.dashboard || pathname.startsWith(`${nav.dashboard}/`)
  const onBoutique =
    pathname === nav.boutique || pathname.startsWith(`${nav.boutique}?`)
  const onOrders = pathname.startsWith(nav.orders)
  const onClients = pathname.startsWith(nav.clients)
  const onSettings = pathname.startsWith(nav.settings)

  const badgeLabel = role === "SUPPLIER" ? t("badgeSupplier") : t("badgeReseller")
  const cartAria =
    cartCount > 0 ? `${t("cart")} (${cartCount})` : t("cart")

  return (
    <header
      className="sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)]"
      aria-label={t("aria")}
    >
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8">
        <div
          className={cn(
            "relative overflow-hidden rounded-b-2xl border border-white/10 shadow-[0_20px_60px_rgba(49,46,129,0.45)]",
            "bg-gradient-to-r from-indigo-950 via-violet-900 to-cyan-600"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_10%_-20%,rgba(255,255,255,0.14),transparent_55%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.06)_50%,transparent_60%)]"
            aria-hidden
          />

          <div className="relative flex min-h-14 items-center gap-3 px-3 py-2 sm:gap-4 sm:px-5">
            <div className="flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3">
              <FastLink
                href={nav.dashboard}
                className="flex items-center gap-2 rounded-lg transition hover:opacity-90"
              >
                <AffisellMark />
                <span className="hidden text-lg font-black tracking-tight text-white sm:inline affisell-brand-wordmark">
                  Affisell
                </span>
              </FastLink>
              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-400/30 bg-indigo-950/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/90 shadow-inner">
                <Globe className="size-3 shrink-0 text-cyan-300" aria-hidden />
                {badgeLabel}
              </span>
            </div>

            <nav
              className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex"
              aria-label={t("navAria")}
            >
              <NavLink href={nav.dashboard} label={t("dashboard")} active={onDashboard} />
              <NavLink href={nav.boutique} label={t("boutique")} active={onBoutique} />
              <NavLink href={nav.orders} label={t("orders")} active={onOrders} />
              <NavLink href={nav.clients} label={t("clients")} active={onClients} />
              <NavLink href={nav.settings} label={t("settings")} active={onSettings} />
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <Link
                href="/cart"
                prefetch
                className="relative inline-flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/80"
                aria-label={cartAria}
              >
                <ShoppingCart className="size-5" aria-hidden />
                <HeaderCartBadge count={cartCount} />
              </Link>

              {isOwner ? (
                <BoutiqueMerchantAvatarMenu
                  storeName={storeName}
                  logoUrl={logoUrl}
                  aiAvatarUrl={aiAvatarUrl}
                  brandStudioHref={nav.brandStudio}
                  settingsHref={nav.settings}
                  isOwner
                />
              ) : (
                <BoutiqueMerchantAvatarMenu
                  storeName={storeName}
                  logoUrl={logoUrl}
                  aiAvatarUrl={aiAvatarUrl}
                  brandStudioHref={nav.brandStudio}
                  settingsHref={nav.settings}
                  isOwner={false}
                />
              )}
            </div>
          </div>

          <nav
            className="relative flex items-center gap-0.5 overflow-x-auto border-t border-white/10 px-2 py-1 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={t("navAria")}
          >
            <NavLink href={nav.dashboard} label={t("dashboard")} active={onDashboard} />
            <NavLink href={nav.boutique} label={t("boutique")} active={onBoutique} />
            <NavLink href={nav.orders} label={t("orders")} active={onOrders} />
            <NavLink href={nav.clients} label={t("clients")} active={onClients} />
            <NavLink href={nav.settings} label={t("settings")} active={onSettings} />
          </nav>
        </div>
      </div>
    </header>
  )
}
