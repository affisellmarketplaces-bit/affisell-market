"use client"

import { Menu, ShoppingBag } from "lucide-react"
import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { StoreNameBadge } from "@/components/storefront/store-name-badge"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import type { StorefrontHeaderBrandAlign } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  accent?: string
  primary?: string
  nameBadge?: StoreNameBadgeStyle
  headerBrandAlign?: StorefrontHeaderBrandAlign
  cartCount?: number
  menuLabel: string
  cartLabel: string
  onOpenMenu?: () => void
  menuExpanded?: boolean
  compact?: boolean
}

function ChromeIconButton({
  children,
  label,
  onClick,
  href,
  accent,
  expanded,
}: {
  children: ReactNode
  label: string
  onClick?: () => void
  href?: string
  accent: string
  expanded?: boolean
}) {
  const className = cn(
    "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/90 text-zinc-800 shadow-sm backdrop-blur-md transition",
    "hover:border-violet-300 hover:bg-violet-50/80 dark:border-zinc-700/80 dark:bg-zinc-900/90 dark:text-zinc-100"
  )
  const style = {
    boxShadow: `0 1px 2px color-mix(in srgb, ${accent} 8%, transparent), 0 8px 20px -12px color-mix(in srgb, ${accent} 35%, transparent)`,
  } as CSSProperties

  if (href) {
    return (
      <Link href={href} className={className} style={style} aria-label={label}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
      aria-label={label}
      aria-expanded={expanded}
    >
      {children}
    </button>
  )
}

function StoreLogoMark({
  logoUrl,
  accent,
  compact,
}: {
  logoUrl: string
  accent: string
  compact: boolean
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11"
      )}
      style={{
        boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 10%, transparent)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        loading="eager"
      />
    </span>
  )
}

export function StorefrontBuyerHeader({
  storeName,
  logoUrl,
  accent = "#7c3aed",
  primary = "#18181b",
  nameBadge = "parallelogram",
  headerBrandAlign = "left",
  cartCount = 0,
  menuLabel,
  cartLabel,
  onOpenMenu,
  menuExpanded = false,
  compact = false,
}: Props) {
  const displayName = storeName.trim() || "Store"
  const hasLogo = Boolean(logoUrl?.trim())

  const brand = (
    <Link
      href="/"
      className={cn(
        "group flex min-w-0 items-center gap-2.5 transition",
        headerBrandAlign === "center" ? "max-w-[min(100%,14rem)] justify-center" : "max-w-[min(100%,15rem)]",
        headerBrandAlign === "right" && "justify-end"
      )}
    >
      {hasLogo && logoUrl ? (
        <StoreLogoMark logoUrl={logoUrl} accent={accent} compact={compact} />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm",
            compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11"
          )}
          style={{
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${primary} 35%, ${accent}))`,
          }}
        >
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      {hasLogo ? (
        <span className="min-w-0 truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[15px]">
          {displayName}
        </span>
      ) : (
        <span className="min-w-0 overflow-hidden">
          <StoreNameBadge
            name={displayName}
            style={nameBadge}
            accent={accent}
            primary={primary}
            size="preview"
            className="max-w-full origin-left transition group-hover:brightness-105"
          />
        </span>
      )}
    </Link>
  )

  return (
    <div
      className={cn(
        "relative isolate border-b border-zinc-200/70 bg-white/90 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/90",
        compact ? "shadow-sm" : "shadow-[0_10px_30px_-22px_color-mix(in_srgb,var(--store-accent,#7c3aed)_50%,transparent)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 55%, transparent), transparent)`,
        }}
        aria-hidden
      />

      <div
        className={cn(
          "relative mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:gap-3 sm:px-6",
          compact ? "h-12" : "h-14 sm:h-16"
        )}
      >
        <ChromeIconButton label={menuLabel} onClick={onOpenMenu} accent={accent} expanded={menuExpanded}>
          <Menu className="size-5" aria-hidden />
        </ChromeIconButton>

        <div
          className={cn(
            "flex min-w-0 justify-self-center px-1",
            headerBrandAlign === "left" && "justify-self-start",
            headerBrandAlign === "right" && "justify-self-end"
          )}
        >
          {brand}
        </div>

        <ChromeIconButton label={cartLabel} href="/cart" accent={accent}>
          <ShoppingBag className="size-5" aria-hidden />
          <CartCountBadge count={cartCount} size="sm" />
        </ChromeIconButton>
      </div>
    </div>
  )
}
