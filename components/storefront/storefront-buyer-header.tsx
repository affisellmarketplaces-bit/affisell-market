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
    "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/70 text-zinc-800 shadow-sm backdrop-blur-md transition",
    "hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-zinc-100"
  )
  const style = {
    boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 12%, transparent), 0 8px 24px color-mix(in srgb, ${accent} 10%, transparent)`,
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

  const brand = (
    <Link
      href="/"
      className={cn(
        "group flex min-w-0 max-w-[min(100%,16rem)] items-center gap-2.5 transition",
        headerBrandAlign === "center" && "justify-center",
        headerBrandAlign === "right" && "justify-end"
      )}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className={cn(
            "shrink-0 rounded-2xl object-cover ring-2 ring-white/80 dark:ring-zinc-800",
            compact ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10"
          )}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md",
            compact ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10"
          )}
          style={{
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${primary} 40%, ${accent}))`,
          }}
        >
          {displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 overflow-hidden">
        <StoreNameBadge
          name={displayName}
          style={nameBadge}
          accent={accent}
          primary={primary}
          size="preview"
          className="max-w-full transition group-hover:brightness-110"
        />
      </span>
    </Link>
  )

  return (
    <div
      className={cn(
        "relative border-b border-zinc-200/70 bg-white/75 backdrop-blur-2xl dark:border-zinc-800/80 dark:bg-zinc-950/80",
        compact ? "shadow-sm" : "shadow-[0_12px_40px_-24px_color-mix(in_srgb,var(--store-accent,#7c3aed)_45%,transparent)]"
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, color-mix(in srgb, ${accent} 50%, ${primary}), transparent)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(circle at 50% -40%, color-mix(in srgb, ${accent} 14%, transparent), transparent 55%)`,
        }}
        aria-hidden
      />

      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center px-4 sm:px-6",
          compact ? "h-12" : "h-14 sm:h-16"
        )}
      >
        {headerBrandAlign === "center" ? (
          <>
            <ChromeIconButton label={menuLabel} onClick={onOpenMenu} accent={accent} expanded={menuExpanded}>
              <Menu className="size-5" aria-hidden />
            </ChromeIconButton>
            <div className="pointer-events-none absolute inset-x-4 flex justify-center sm:inset-x-6">
              <div className="pointer-events-auto max-w-[min(100%,18rem)]">{brand}</div>
            </div>
            <div className="ml-auto">
              <ChromeIconButton label={cartLabel} href="/cart" accent={accent}>
                <ShoppingBag className="size-5" aria-hidden />
                <CartCountBadge count={cartCount} size="sm" />
              </ChromeIconButton>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ChromeIconButton label={menuLabel} onClick={onOpenMenu} accent={accent} expanded={menuExpanded}>
                <Menu className="size-5" aria-hidden />
              </ChromeIconButton>
              {headerBrandAlign === "left" ? brand : null}
            </div>
            <div className="min-w-0 flex-1" aria-hidden />
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {headerBrandAlign === "right" ? brand : null}
              <ChromeIconButton label={cartLabel} href="/cart" accent={accent}>
                <ShoppingBag className="size-5" aria-hidden />
                <CartCountBadge count={cartCount} size="sm" />
              </ChromeIconButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
