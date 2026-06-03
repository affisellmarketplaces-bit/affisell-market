"use client"

import Link from "next/link"
import { Layers, Rows3 } from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { affisellBrand } from "@/lib/affisell-brand"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import { cn } from "@/lib/utils"

type Props = {
  target: "scroll" | "swipe"
  label: string
  categoryId?: string | null
  subcategoryId?: string | null
  className?: string
  /** Compact chip for header; rail = full-width footer strip */
  variant?: "chip" | "rail"
}

export function PulseLayoutModeLink({
  target,
  label,
  categoryId = null,
  subcategoryId = null,
  className,
  variant = "chip",
}: Props) {
  const router = useRouter()
  const href = discoverSwipeHref({
    category: categoryId,
    subcategory: subcategoryId,
    layout: target === "scroll" ? "scroll" : undefined,
  })

  useEffect(() => {
    router.prefetch(href)
  }, [href, router])

  const Icon = target === "scroll" ? Layers : Rows3

  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "affisell-pulse-mode-toggle",
        affisellBrand.epoxyChip,
        variant === "rail"
          ? "flex w-full max-w-[380px] items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-violet-100 ring-1 ring-violet-400/35"
          : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100 ring-1 ring-cyan-400/30",
        className
      )}
    >
      <Icon className={variant === "rail" ? "size-4 shrink-0" : "size-3.5 shrink-0"} aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  )
}
