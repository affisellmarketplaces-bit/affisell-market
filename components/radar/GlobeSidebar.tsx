"use client"

import Link from "next/link"
import { X } from "lucide-react"

import type { LiveEvent } from "@/lib/radar/live-types"

type Props = {
  event: LiveEvent
  onClose: () => void
}

function money(price: number) {
  return price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
}

/**
 * Product detail drawer for a selected Globe pin.
 */
export function GlobeSidebar({ event, onClose }: Props) {
  const { product, location, salesPerHour, growth, videoUrl, sparkline } = event
  const importUrl = product.supplierUrl?.trim()
    ? `/import?url=${encodeURIComponent(product.supplierUrl.trim())}&auto=1`
    : "/dropforge"
  const productHref = product.affiliateProductId
    ? `/marketplace/${product.affiliateProductId}`
    : `/marketplace/${product.id}`

  return (
    <aside
      className="absolute right-0 top-0 z-30 flex h-full w-full max-w-md animate-in slide-in-from-right flex-col border-l border-white/10 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-xl duration-300"
      data-testid="radar-globe-sidebar"
      role="dialog"
      aria-label={product.title}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
        aria-label="Fermer"
      >
        <X className="size-4" />
      </button>

      <div className="relative mt-2 h-48 w-full overflow-hidden rounded-xl bg-zinc-900">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary marketplace CDN URLs
          <img src={product.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Pas d&apos;image
          </div>
        )}
      </div>

      <h2 className="mt-4 pr-8 text-lg font-bold leading-snug text-white">{product.title}</h2>
      <p className="mt-1 text-sm text-white/50">
        {money(product.price)} · {product.category}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">
          {salesPerHour} ventes/h
        </span>
        <span className="rounded-full bg-violet-500/20 px-2 py-1 text-xs text-violet-400">
          +{Math.round(growth)}%
        </span>
        <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70">
          {location.city}
        </span>
        <span className="rounded-full bg-white/5 px-2 py-1 text-xs uppercase tracking-wide text-white/40">
          {event.type}
        </span>
      </div>

      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="mt-4 w-full rounded-xl"
        />
      ) : null}

      <div className="mt-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Courbe 24h
        </div>
        <div className="mt-2 flex h-16 items-end gap-1">
          {sparkline.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-violet-500/80"
              style={{ height: `${Math.round(v * 100)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6">
        <Link
          href={importUrl}
          className="flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-100"
        >
          Copier ce winner → Import 10s
        </Link>
        <Link
          href={productHref}
          className="flex h-11 w-full items-center justify-center rounded-full bg-white/10 text-sm text-white transition hover:bg-white/15"
        >
          Voir fiche complète
        </Link>
      </div>
    </aside>
  )
}
