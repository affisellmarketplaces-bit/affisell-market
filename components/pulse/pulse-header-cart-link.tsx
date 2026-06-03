"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { useTranslations } from "next-intl"

import { CartCountBadge } from "@/components/cart/cart-count-badge"
import { useBuyerCartCount } from "@/hooks/use-buyer-cart-count"
import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

/** Cart entry from full-screen Pulse — the bottom dock sits under the z-140 overlay. */
export function PulseHeaderCartLink({ className }: { className?: string }) {
  const t = useTranslations("nav.dock")
  const count = useBuyerCartCount()
  const aria = count > 0 ? `${t("cart")} (${count})` : t("cart")

  return (
    <Link
      href="/cart"
      aria-label={aria}
      className={cn(
        affisellBrand.epoxyChip,
        "relative flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 transition active:scale-95",
        className
      )}
    >
      <ShoppingBag className="size-4" aria-hidden />
      <CartCountBadge count={count} size="sm" className="ring-violet-950/80" />
    </Link>
  )
}
