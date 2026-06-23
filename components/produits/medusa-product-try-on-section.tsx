"use client"

import { useState } from "react"
import Image from "next/image"

import { TryOnModal } from "@/components/try-on/TryOnModal"
import { TryOnTrigger } from "@/components/try-on/TryOnEntry"
import type { ResolvedMedusaProduct } from "@/types/medusa"

type Props = {
  product: ResolvedMedusaProduct
  tryOnFeatureEnabled: boolean
}

export function MedusaProductTryOnSection({ product, tryOnFeatureEnabled }: Props) {
  const [open, setOpen] = useState(false)
  const garmentUrl = product.tryon_garment_url?.trim() ?? ""
  const showTryOn =
    tryOnFeatureEnabled && product.try_on_enabled && garmentUrl.length > 0

  return (
    <article className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">
          {product.source === "medusa" ? "Medusa Store" : "Affisell catalog"}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {product.title}
        </h1>
      </header>

      {product.thumbnail ? (
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <Image
            src={product.thumbnail}
            alt={product.title}
            fill
            className="object-contain p-4"
            sizes="(max-width: 768px) 100vw, 512px"
          />
        </div>
      ) : null}

      {showTryOn ? (
        <TryOnTrigger
          className="w-full min-h-11 border-violet-300 text-violet-800 dark:border-violet-700 dark:text-violet-200"
          onOpen={() => setOpen(true)}
        />
      ) : null}

      {showTryOn ? (
        <TryOnModal
          open={open}
          onClose={() => setOpen(false)}
          productId={product.id}
          affiliateProductId={product.id}
          productName={product.title}
          garmentUrl={garmentUrl}
        />
      ) : null}
    </article>
  )
}
