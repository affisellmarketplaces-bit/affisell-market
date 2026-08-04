"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

import { DescriptionRichContent } from "@/components/product/description-rich-content"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ProductLivePreviewData = {
  name: string
  description: string
  price: number
  imageUrl: string | null
  brand?: string
  /** Extra illustration images for shopper-rich description (like reseller). */
  illustrationImages?: string[]
}

export type ProductLivePreviewChangeHandlers = {
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onPriceChange: (priceEur: number) => void
}

type Props = {
  data: ProductLivePreviewData
  className?: string
  /** Mobile bottom sheet */
  variant?: "sidebar" | "drawer"
  /**
   * When set, titre / description / prix are editable inline — same mental model
   * as reseller Customize → Shopper preview (edit fields, live shopper card).
   */
  onChange?: ProductLivePreviewChangeHandlers
}

function useDebounced<T>(value: T, ms: number, enabled: boolean): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    if (!enabled) {
      setDebounced(value)
      return
    }
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms, enabled])
  return enabled ? debounced : value
}

export function ProductLivePreview({ data, className, variant = "sidebar", onChange }: Props) {
  const editable = Boolean(onChange)
  const view = useDebounced(data, 300, !editable)
  const priceLabel = useMemo(() => {
    const n = view.price
    if (!Number.isFinite(n) || n <= 0) return "—"
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n)
  }, [view.price])

  const illustrationImages = view.illustrationImages ?? []
  const showRichDescription =
    !editable &&
    (view.description.trim().length > 0 || illustrationImages.length > 0)

  const card = (
    <article
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      aria-label={editable ? "Shopper preview — éditable" : "Aperçu carte affilié"}
    >
      <div className="relative aspect-square min-h-[200px] bg-zinc-100 dark:bg-zinc-900">
        {view.imageUrl ? (
          <Image
            src={view.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="400px"
            unoptimized={view.imageUrl.startsWith("blob:")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            Photo produit
          </div>
        )}
        <Badge className="absolute left-3 top-3 border-violet-400/40 bg-violet-500/90 text-white">
          {editable ? "Shopper preview" : "Aperçu affilié"}
        </Badge>
        {editable ? (
          <span className="absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
            Cliquez pour modifier
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {view.brand ?? "Votre marque"}
        </p>

        {editable && onChange ? (
          <>
            <label className="sr-only" htmlFor={`live-preview-name-${variant}`}>
              Titre shopper
            </label>
            <input
              id={`live-preview-name-${variant}`}
              value={view.name}
              onChange={(e) => onChange.onNameChange(e.target.value.slice(0, 500))}
              placeholder="Titre produit"
              className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-base font-semibold text-zinc-900 outline-none ring-violet-500/40 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-violet-300 focus:ring-2 dark:text-zinc-50 dark:hover:border-zinc-700 dark:focus:border-violet-600"
            />
            <label className="sr-only" htmlFor={`live-preview-desc-${variant}`}>
              Description shopper
            </label>
            <textarea
              id={`live-preview-desc-${variant}`}
              value={view.description}
              onChange={(e) => onChange.onDescriptionChange(e.target.value.slice(0, 20_000))}
              rows={5}
              placeholder="Description marketplace…"
              className="w-full resize-y rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm leading-relaxed text-zinc-600 outline-none ring-violet-500/40 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-violet-300 focus:ring-2 dark:text-zinc-400 dark:hover:border-zinc-700 dark:focus:border-violet-600"
            />
            {(view.description.trim().length > 0 || illustrationImages.length > 0) && (
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Shopper preview
                </p>
                <DescriptionRichContent
                  description={view.description}
                  images={illustrationImages}
                  textClassName="text-zinc-600 dark:text-zinc-400"
                />
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <label className="sr-only" htmlFor={`live-preview-price-${variant}`}>
                Prix EUR
              </label>
              <input
                id={`live-preview-price-${variant}`}
                type="number"
                min={0}
                step={0.01}
                value={Number.isFinite(view.price) && view.price > 0 ? view.price : ""}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  onChange.onPriceChange(Number.isFinite(n) ? n : 0)
                }}
                placeholder="0.00"
                className="w-28 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-lg font-bold tabular-nums text-violet-700 outline-none ring-violet-500/40 placeholder:text-zinc-400 hover:border-zinc-200 focus:border-violet-300 focus:ring-2 dark:text-violet-300 dark:hover:border-zinc-700"
              />
              <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">€</span>
            </div>
          </>
        ) : (
          <>
            <h3 className="line-clamp-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {view.name.trim() || "Titre produit"}
            </h3>
            {showRichDescription ? (
              <div className="line-clamp-6 text-sm">
                <DescriptionRichContent
                  description={view.description}
                  images={illustrationImages.slice(0, 3)}
                  textClassName="text-zinc-600 dark:text-zinc-400"
                />
              </div>
            ) : (
              <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                {view.description.trim() || "Description marketplace…"}
              </p>
            )}
            <p className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-300">
              {priceLabel}
            </p>
          </>
        )}
      </div>
    </article>
  )

  if (variant === "drawer") {
    return (
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 max-h-[55vh] overflow-y-auto border-t border-zinc-200 bg-white/95 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden",
          className
        )}
        role="complementary"
        aria-label="Shopper preview mobile"
      >
        {card}
      </div>
    )
  }

  return (
    <aside
      className={cn("hidden min-h-[320px] lg:block", className)}
      role="complementary"
      aria-label="Shopper preview"
    >
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        {editable ? "Shopper preview — éditable" : "Live preview"}
      </p>
      {card}
    </aside>
  )
}
