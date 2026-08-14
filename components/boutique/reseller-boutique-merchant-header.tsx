"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Globe, ShoppingCart } from "lucide-react"
import { useTranslations } from "next-intl"

import { BoutiqueMerchantAvatarMenu } from "@/components/boutique/boutique-merchant-avatar-menu"
import { FastLink } from "@/components/navigation/fast-link"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import { resolveBoutiqueMerchantNav } from "@/lib/boutique/boutique-merchant-header-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string
  storeName: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  isOwner?: boolean
}

function AffisellMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="boutique-affisell-mark" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        fill="url(#boutique-affisell-mark)"
        d="M5 27V5h6.1l4.8 10.4L20.7 5H26.8v22h-4.8V13.6L17.2 27h-3.4L9.8 13.6V27H5z"
      />
    </svg>
  )
}

/** Cyan count pill — always visible, including 0 (matches design spec). */
function HeaderCartBadge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count)
  return (
    <span
      className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-bold tabular-nums leading-none text-indigo-950"
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
        "relative shrink-0 whitespace-nowrap px-4 py-2 text-[15px] tracking-tight transition-colors",
        active ? "font-semibold text-white" : "font-normal text-white/85 hover:text-white"
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {active ? (
        <span
          className="absolute inset-x-3 -bottom-0.5 h-[3px] rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.9)]"
          aria-hidden
        />
      ) : null}
    </FastLink>
  )
}

/** Default chrome for every /boutique/[slug] — pixel-aligned with merchant mockup. */
export function ResellerBoutiqueMerchantHeader({
  storeSlug,
  storeName,
  logoUrl,
  aiAvatarUrl,
  isOwner = false,
}: Props) {
  const t = useTranslations("boutique.merchantHeader")
  const pathname = usePathname() ?? ""
  const cartCount = useBuyerCartCount({ deferSync: true })
  const nav = resolveBoutiqueMerchantNav("AFFILIATE", storeSlug)

  const boutiqueBase = `/boutique/${encodeURIComponent(storeSlug)}`
  const onDashboard =
    pathname === nav.dashboard || pathname.startsWith(`${nav.dashboard}/`)
  const onBoutique = pathname === boutiqueBase || pathname.startsWith(`${boutiqueBase}?`)
  const onOrders = pathname.startsWith(nav.orders)
  const onClients = pathname.startsWith(nav.clients)
  const onSettings = pathname.startsWith(nav.settings)

  const cartAria = cartCount > 0 ? `${t("cart")} (${cartCount})` : t("cart")

  return (
    <header
      className="sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)]"
      aria-label={t("aria")}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-10">
        <div
          className={cn(
            "relative overflow-hidden rounded-t-[1.35rem] border border-white/[0.08]",
            "bg-gradient-to-r from-[#1a1f5c] via-[#312e81] to-[#0891b2]",
            "shadow-[0_18px_50px_rgba(15,23,42,0.55)]"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_0%_0%,rgba(255,255,255,0.12),transparent_50%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_100%_50%,rgba(34,211,238,0.22),transparent_55%)]"
            aria-hidden
          />

          <div className="relative grid min-h-[3.75rem] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 sm:px-6 lg:min-h-[4rem] lg:px-8">
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <FastLink
                href={nav.dashboard}
                className="flex items-center gap-2.5 rounded-lg transition hover:opacity-90"
              >
                <AffisellMark />
                <span className="text-[1.15rem] font-bold tracking-tight text-white">Affisell</span>
              </FastLink>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/70 bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/95">
                <Globe className="size-3 shrink-0 text-cyan-300" aria-hidden />
                {t("badgeReseller")}
              </span>
            </div>

            <nav
              className="hidden min-w-0 items-center justify-center lg:flex"
              aria-label={t("navAria")}
            >
              <NavLink href={nav.dashboard} label={t("dashboard")} active={onDashboard} />
              <NavLink href={nav.boutique} label={t("boutique")} active={onBoutique} />
              <NavLink href={nav.orders} label={t("orders")} active={onOrders} />
              <NavLink href={nav.clients} label={t("clients")} active={onClients} />
              <NavLink href={nav.settings} label={t("settings")} active={onSettings} />
            </nav>

            <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-4">
              <Link
                href="/cart"
                prefetch
                className="relative inline-flex size-10 items-center justify-center text-white transition hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/80"
                aria-label={cartAria}
              >
                <ShoppingCart className="size-[22px] stroke-[1.75]" aria-hidden />
                <HeaderCartBadge count={cartCount} />
              </Link>

              <BoutiqueMerchantAvatarMenu
                storeName={storeName}
                logoUrl={logoUrl}
                aiAvatarUrl={aiAvatarUrl}
                brandStudioHref={nav.brandStudio}
                settingsHref={nav.settings}
                isOwner={isOwner}
              />
            </div>
          </div>

          <nav
            className="relative flex items-center gap-0.5 overflow-x-auto border-t border-white/10 px-2 py-1.5 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
