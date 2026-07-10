"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ProductLivePreviewData = {
  name: string
  description: string
  price: number
  imageUrl: string | null
  brand?: string
}

type Props = {
  data: ProductLivePreviewData
  className?: string
  /** Mobile bottom sheet */
  variant?: "sidebar" | "drawer"
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function ProductLivePreview({ data, className, variant = "sidebar" }: Props) {
  const debounced = useDebounced(data, 300)
  const priceLabel = useMemo(() => {
    const n = debounced.price
    if (!Number.isFinite(n) || n <= 0) return "—"
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
  }, [debounced.price])

  const card = (
    <article
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Aperçu carte affilié"
    >
      <div className="relative aspect-square min-h-[200px] bg-zinc-100 dark:bg-zinc-900">
        {debounced.imageUrl ? (
          <Image
            src={debounced.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="400px"
            unoptimized={debounced.imageUrl.startsWith("blob:")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">Photo produit</div>
        )}
        <Badge className="absolute left-3 top-3 border-violet-400/40 bg-violet-500/90 text-white">
          Aperçu affilié
        </Badge>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {debounced.brand ?? "Votre marque"}
        </p>
        <h3 className="line-clamp-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {debounced.name.trim() || "Titre produit"}
        </h3>
        <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
          {debounced.description.trim() || "Description marketplace…"}
        </p>
        <p className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300">{priceLabel}</p>
      </div>
    </article>
  )

  if (variant === "drawer") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden",
          className
        )}
        role="complementary"
        aria-label="Aperçu produit mobile"
      >
        {card}
      </div>
    )
  }

  return (
    <aside
      className={cn("hidden min-h-[320px] lg:block", className)}
      role="complementary"
      aria-label="Aperçu produit affilié"
    >
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Live preview</p>
      {card}
    </aside>
  )
}
