"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"

function HeaderCartBadge({ count }: { count: number }) {
  const label = count > 99 ? "99+" : String(count)
  return (
    <span
      className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[10px] font-bold tabular-nums leading-none text-indigo-950 ring-2 ring-indigo-900/80"
      aria-hidden
    >
      {label}
    </span>
  )
}

/** Minimal buyer chrome when visiting /boutique without merchant session. */
export function ResellerBoutiquePublicHeader() {
  const t = useTranslations("boutique.merchantHeader")
  const cartCount = useBuyerCartCount({ deferSync: true })
  const cartAria = cartCount > 0 ? `${t("cart")} (${cartCount})` : t("cart")

  return (
    <header className="sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <FastLink href="/" className="text-lg font-bold affisell-logo-text affisell-brand-wordmark">
          Affisell
        </FastLink>
        <Link
          href="/cart"
          prefetch
          className="relative inline-flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/15"
          aria-label={cartAria}
        >
          <ShoppingCart className="size-5" aria-hidden />
          <HeaderCartBadge count={cartCount} />
        </Link>
      </div>
    </header>
  )
}
