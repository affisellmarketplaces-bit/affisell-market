"use client"

import type { SocialAssetSpec } from "@/lib/social/bubble-product-types"
import { ViralCarousel } from "@/components/social/ViralCarousel"
import type { ViralMedia } from "@/types/product"

type Props = {
  asset: SocialAssetSpec
  medias: ViralMedia[]
  productId: string
  livePrice: number
  baseSalePrice: number
  fallback?: boolean
  onCopyCaption: (caption: string) => void
}

/**
 * Viral asset card — cinematic product carousel preview + PNG download.
 * Preview never shows margin; price pill is client sale price only.
 */
export function ViralAssetCard({
  asset,
  medias,
  productId,
  livePrice,
  baseSalePrice,
  fallback = false,
  onCopyCaption,
}: Props) {
  const caption = asset.caption.replaceAll(
    `${baseSalePrice.toFixed(0)}€`,
    `${livePrice.toFixed(0)}€`
  )
  const previewMedias: ViralMedia[] =
    medias.length > 0
      ? medias
      : [{ type: "image", url: asset.publicUrl, duration: 2000 }]

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="relative aspect-video bg-zinc-950">
        <ViralCarousel medias={previewMedias} autoPlay shape="rect" className="absolute inset-0 rounded-none" />
        <div className="absolute bottom-2 right-2 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
          {livePrice.toFixed(0)}€
        </div>
        <div className="absolute left-2 top-2 z-20 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
          ciné · {previewMedias.length} média{previewMedias.length > 1 ? "s" : ""}
        </div>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs font-mono text-zinc-500">{asset.key}</p>
        <div className="flex flex-wrap gap-2">
          {fallback ? (
            <a
              href={asset.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Ouvrir image
            </a>
          ) : (
            <a
              href={`/api/products/${encodeURIComponent(productId)}/social-assets/download?format=${encodeURIComponent(asset.key)}`}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Télécharger PNG
            </a>
          )}
          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700"
            onClick={() => onCopyCaption(caption)}
          >
            Copier caption
          </button>
        </div>
      </div>
    </article>
  )
}
