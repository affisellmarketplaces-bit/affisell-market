"use client"

import Link from "next/link"
import { Menu, ShoppingBag } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { BoutiqueBuyerTrustStrip } from "@/components/boutique/boutique-buyer-trust-strip"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  shopHomePath: string
  cartCount: number
  menuLabel: string
  cartLabel: string
  onOpenMenu: () => void
  menuExpanded: boolean
  menuControlsId: string
  trust: StorefrontTrustSnapshot | null
  /** Owner preview — quick link to dashboard without merchant nav chrome. */
  ownerDashboardHref?: string | null
}

function BuyerIconControl({
  label,
  onClick,
  href,
  expanded,
  controls,
  children,
}: {
  label: string
  onClick?: () => void
  href?: string
  expanded?: boolean
  controls?: string
  children: ReactNode
}) {
  const shellClass = cn(
    "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full touch-manipulation",
    "transition duration-200 hover:scale-105 active:scale-95",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
  )
  const style = {
    color: "var(--boutique-merchant-header-icon, #ffffff)",
    background: "var(--boutique-merchant-header-hover-bg, rgba(255,255,255,0.1))",
    boxShadow: "0 0 0 1px var(--boutique-merchant-header-divider, rgba(255,255,255,0.14))",
    outlineColor: "var(--boutique-merchant-header-focus-ring, rgba(34,211,238,0.85))",
  } as React.CSSProperties

  if (href) {
    return (
      <Link href={href} prefetch className={shellClass} style={style} aria-label={label}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={shellClass}
      style={style}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
    >
      {children}
    </button>
  )
}

function StoreLogoMark({ logoUrl, storeName: _storeName }: { logoUrl: string; storeName: string }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full sm:size-11">
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(135deg, var(--boutique-button-from, #7c3aed), var(--boutique-button-to, #4f46e5))",
          boxShadow: "0 0 0 1px var(--boutique-merchant-header-divider, rgba(255,255,255,0.2))",
        }}
        aria-hidden
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="relative size-[calc(100%-4px)] rounded-full object-cover"
        loading="eager"
      />
    </span>
  )
}

function StoreInitialMark({ storeName }: { storeName: string }) {
  const initial = storeName.trim().slice(0, 1).toUpperCase() || "S"
  return (
    <span
      className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:size-11"
      style={{
        color: "var(--boutique-merchant-header-text, #ffffff)",
        background:
          "linear-gradient(135deg, var(--boutique-button-from, #7c3aed), var(--boutique-button-to, #4f46e5))",
        boxShadow: "0 0 0 1px var(--boutique-merchant-header-divider, rgba(255,255,255,0.2))",
      }}
    >
      {initial}
    </span>
  )
}

/** Seamless buyer chrome — procedural skin + store identity + trust signals. */
export function ResellerBoutiqueBuyerHeader({
  storeName,
  logoUrl,
  shopHomePath,
  cartCount,
  menuLabel,
  cartLabel,
  onOpenMenu,
  menuExpanded,
  menuControlsId,
  trust,
  ownerDashboardHref,
}: Props) {
  const tNav = useTranslations("boutique.merchantHeader")
  const displayName = storeName.trim() || "Store"
  const hasLogo = Boolean(logoUrl?.trim())

  return (
    <header
      className="sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)]"
      aria-label={displayName}
    >
      <div
        className="relative overflow-hidden backdrop-blur-2xl backdrop-saturate-150 transition-[background,border-color,box-shadow,color] duration-700 ease-in-out"
        style={{
          color: "var(--boutique-merchant-header-text, #ffffff)",
          backgroundImage: [
            "linear-gradient(180deg, var(--boutique-merchant-header-from) 0%, var(--boutique-merchant-header-via) 38%, var(--boutique-merchant-header-to) 62%, var(--boutique-merchant-header-fade, transparent) 100%)",
            "linear-gradient(90deg, var(--boutique-merchant-header-from) 0%, var(--boutique-merchant-header-via) 48%, var(--boutique-merchant-header-to) 100%)",
          ].join(", "),
          boxShadow: "var(--boutique-merchant-header-shadow, inset 0 -1px 0 rgba(255,255,255,0.08))",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 120% at 0% -20%, var(--boutique-merchant-header-scrim, rgba(255,255,255,0.14)), transparent 55%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 75% 110% at 100% 0%, var(--boutique-merchant-header-glow, rgba(34,211,238,0.22)), transparent 58%)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-[3.75rem] max-w-[1600px] items-center gap-2 px-4 sm:min-h-[4rem] sm:gap-3 sm:px-6 lg:px-10">
          <BuyerIconControl
            label={menuLabel}
            onClick={onOpenMenu}
            expanded={menuExpanded}
            controls={menuControlsId}
          >
            <Menu className="size-5" aria-hidden />
          </BuyerIconControl>

          <Link
            href={shopHomePath}
            className="group relative z-10 shrink-0 transition duration-200 hover:opacity-95"
            aria-label={displayName}
          >
            {hasLogo && logoUrl ? (
              <StoreLogoMark logoUrl={logoUrl} storeName={displayName} />
            ) : (
              <StoreInitialMark storeName={displayName} />
            )}
          </Link>

          <Link
            href={shopHomePath}
            className="pointer-events-none absolute inset-y-0 left-14 right-14 z-20 flex items-center justify-center sm:left-16 sm:right-16"
          >
            <span
              className="pointer-events-auto max-w-[min(68vw,18rem)] truncate text-sm font-semibold uppercase tracking-[0.18em] sm:text-[15px] sm:tracking-[0.22em]"
              style={{ color: "var(--boutique-merchant-header-text, #ffffff)" }}
            >
              {displayName}
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            {ownerDashboardHref ? (
              <Link
                href={ownerDashboardHref}
                className="hidden rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition hover:opacity-90 sm:inline-flex"
                style={{
                  borderColor: "var(--boutique-merchant-header-divider)",
                  color: "var(--boutique-merchant-header-text-muted)",
                  background: "var(--boutique-merchant-header-hover-bg)",
                }}
              >
                {tNav("dashboard")}
              </Link>
            ) : null}
            <BuyerIconControl label={cartLabel} href="/cart">
              <ShoppingBag className="size-5" aria-hidden />
              <CartCountBadge count={cartCount} size="sm" />
            </BuyerIconControl>
          </div>
        </div>

        <BoutiqueBuyerTrustStrip trust={trust} />
      </div>
    </header>
  )
}
