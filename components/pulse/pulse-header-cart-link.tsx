"use client"

import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { affisellBrand } from "@/lib/affisell-brand"
import { guestCartCount } from "@/lib/guest-cart"
import { cn } from "@/lib/utils"

/** Cart entry from full-screen Pulse — the bottom dock sits under the z-140 overlay. */
export function PulseHeaderCartLink({ className }: { className?: string }) {
  const t = useTranslations("nav.dock")
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => setCount(guestCartCount())
    sync()
    window.addEventListener("affisell:cart-updated", sync)
    window.addEventListener("affisell:cart-added", sync)
    return () => {
      window.removeEventListener("affisell:cart-updated", sync)
      window.removeEventListener("affisell:cart-added", sync)
    }
  }, [])

  return (
    <Link
      href="/cart"
      aria-label={t("cart")}
      className={cn(
        affisellBrand.epoxyChip,
        "relative flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 transition active:scale-95",
        className
      )}
    >
      <ShoppingBag className="size-4" aria-hidden />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-white ring-2 ring-violet-950/80">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  )
}
