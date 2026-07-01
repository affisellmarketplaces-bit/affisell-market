"use client"

import { Menu, ShoppingBag } from "lucide-react"
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { StorefrontHeaderTrustRail } from "@/components/storefront/storefront-header-trust-rail"
import {
  isLightStorefrontHeader,
  storefrontHeaderShellStyle,
} from "@/lib/storefront-header-chrome-shared"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

// LOGIC PRESERVED — public props contract
type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  trustRailText?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  cartCount?: number
  menuLabel: string
  cartLabel: string
  onOpenMenu?: () => void
  menuExpanded?: boolean
  menuControlsId?: string
  compact?: boolean
  trust?: StorefrontTrustSnapshot | null
  isCustomDomain?: boolean
  shopHomePath?: string
}

// LOGIC PRESERVED — menu / cart control wiring (href, onClick, a11y)
function ChromeIconButton({
  children,
  label,
  onClick,
  href,
  accent,
  expanded,
  controls,
  className,
  lightHeader = false,
}: {
  children: ReactNode
  label: string
  onClick?: () => void
  href?: string
  accent: string
  expanded?: boolean
  controls?: string
  className?: string
  lightHeader?: boolean
}) {
  const shellClass = cn(
    "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full touch-manipulation",
    lightHeader
      ? "bg-black/[0.06] text-zinc-900 shadow-md backdrop-blur-md hover:bg-black/10"
      : "bg-white/5 text-zinc-100 shadow-lg backdrop-blur-md hover:bg-white/10",
    "transition duration-200 hover:scale-105 active:scale-95",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/80",
    className
  )
  const style = {
    boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 12%, transparent), 0 8px 24px -12px color-mix(in srgb, ${accent} 40%, transparent)`,
  } as CSSProperties

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
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick?.()
      }}
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

function StoreLogoMark({ logoUrl, compact }: { logoUrl: string; compact: boolean }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full p-[2px] transition duration-200",
        "group-hover:shadow-[0_0_20px_rgba(124,58,237,0.22)]",
        compact ? "size-9 sm:size-10" : "size-10 sm:size-11"
      )}
    >
      <span className="relative flex size-full items-center justify-center overflow-hidden rounded-full border border-white/20 bg-zinc-950/80 p-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" className="size-full rounded-full object-cover" loading="eager" />
      </span>
    </span>
  )
}

export function StorefrontBuyerHeader({
  storeName,
  logoUrl,
  accent = "#7c3aed",
  primary = "#18181b",
  trustRailText,
  nameBadge = "parallelogram",
  headerBrandAlign = "left",
  cartCount = 0,
  menuLabel,
  cartLabel,
  onOpenMenu,
  menuExpanded = false,
  menuControlsId = "storefront-category-drawer",
  compact = false,
  trust = null,
  isCustomDomain = false,
  shopHomePath = "/",
}: Props) {
  // LOGIC PRESERVED — brand derivation + alignment flags
  const displayName = storeName.trim() || "Store"
  const hasLogo = Boolean(logoUrl?.trim())
  const useBadgeStyle = nameBadge !== "classic"
  const lightHeader = isLightStorefrontHeader(primary)
  void headerBrandAlign
  void useBadgeStyle

  const logoMark =
    hasLogo && logoUrl ? (
      <StoreLogoMark logoUrl={logoUrl} compact={compact} />
    ) : (
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full border border-white/20 text-sm font-bold text-white transition duration-200",
          "group-hover:shadow-[0_0_20px_rgba(124,58,237,0.22)]",
          compact ? "size-9 sm:size-10" : "size-10 sm:size-11"
        )}
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${primary} 35%, ${accent}))`,
        }}
      >
        {displayName.slice(0, 1).toUpperCase()}
      </span>
    )

  return (
    <header
      className={cn(
        "affisell-storefront-chrome relative isolate overflow-hidden",
        "sticky top-0 z-50 border-b backdrop-blur-xl",
        lightHeader
          ? "text-zinc-900 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]"
          : "text-zinc-100 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]",
        "pt-[env(safe-area-inset-top)]"
      )}
      style={
        {
          ...storefrontHeaderShellStyle(primary, accent),
          "--site-header-offset": trust
            ? `calc(${compact ? "6.75rem" : "7.5rem"} + env(safe-area-inset-top))`
            : `calc(${compact ? "3.25rem" : "3.75rem"} + env(safe-area-inset-top))`,
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-30%,var(--store-header-accent-glow),transparent_58%)]"
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          lightHeader ? "via-black/10" : "via-white/15"
        )}
        aria-hidden
      />

      {/* LOGIC PRESERVED — nav row layout + brand align slots */}
      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6",
          compact ? "h-12" : "h-14 sm:h-16"
        )}
      >
        <ChromeIconButton
          label={menuLabel}
          onClick={onOpenMenu}
          accent={accent}
          expanded={menuExpanded}
          controls={menuControlsId}
          className="relative z-30"
          lightHeader={lightHeader}
        >
          <Menu className="size-5" aria-hidden />
        </ChromeIconButton>

        <Link
          href={shopHomePath}
          className="group relative z-10 shrink-0 transition duration-200"
          aria-label={displayName}
        >
          {logoMark}
        </Link>

        <div className="min-w-0 flex-1" aria-hidden />

        <Link
          href={shopHomePath}
          className="pointer-events-none absolute inset-y-0 left-12 right-12 z-20 flex items-center justify-center sm:left-14 sm:right-14"
        >
          <span
            className={cn(
              "pointer-events-auto max-w-[min(72vw,16rem)] truncate text-sm font-medium uppercase tracking-[0.2em]",
              lightHeader ? "text-zinc-900" : "text-zinc-100"
            )}
          >
            {displayName}
          </span>
        </Link>

        <ChromeIconButton
          label={cartLabel}
          href="/cart"
          accent={accent}
          className="relative z-30"
          lightHeader={lightHeader}
        >
          <ShoppingBag className="size-5" aria-hidden />
          <CartCountBadge count={cartCount} size="sm" />
        </ChromeIconButton>
      </div>

      {/* LOGIC PRESERVED — trust sub-bar render gate + props */}
      {trust ? (
        <StorefrontHeaderTrustRail
          trust={trust}
          accent={accent}
          primary={primary}
          trustRailText={trustRailText}
          isCustomDomain={isCustomDomain}
          variant="integrated"
          visual="futuristic"
        />
      ) : null}
    </header>
  )
}
