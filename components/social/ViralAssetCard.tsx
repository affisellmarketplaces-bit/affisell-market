"use client"

import Image from "next/image"
import { useState } from "react"

import type { SocialAssetSpec } from "@/lib/social/bubble-product-types"
import {
  downloadViralGifBlob,
  previewViralGifBlob,
  recordViralBubbleGif,
} from "@/lib/social/generate-gif"
import type { ViralMedia } from "@/types/product"

type Props = {
  asset: SocialAssetSpec
  medias: ViralMedia[]
  productId: string
  productTitle: string
  livePrice: number
  baseSalePrice: number
  fallback?: boolean
  onCopyCaption: (caption: string) => void
}

const GIF_FRIENDLY_KEYS = new Set([
  "story_1080x1920",
  "tiktok_1080x1920",
  "reel_cover_1080x1920",
  "whatsapp_800x800",
  "feed_1080x1080",
])

/**
 * Viral asset card — branded PNG preview + GIF (WhatsApp) + caption.
 * Preview never shows margin; price pill is client sale price only.
 */
export function ViralAssetCard({
  asset,
  medias,
  productId,
  productTitle,
  livePrice,
  baseSalePrice,
  fallback = false,
  onCopyCaption,
}: Props) {
  const [gifBusy, setGifBusy] = useState(false)
  const [gifProgress, setGifProgress] = useState(0)

  const caption = asset.caption.replaceAll(
    `${baseSalePrice.toFixed(0)}€`,
    `${livePrice.toFixed(0)}€`
  )
  const showGif = GIF_FRIENDLY_KEYS.has(asset.key) && medias.length > 0

  const exportGif = async () => {
    if (gifBusy || medias.length === 0) return
    setGifBusy(true)
    setGifProgress(0)
    try {
      const isSquare = asset.width === asset.height
      const result = await recordViralBubbleGif({
        medias,
        title: productTitle,
        salePrice: livePrice,
        width: isSquare ? 540 : 540,
        height: isSquare ? 540 : 960,
        fps: 10,
        onProgress: setGifProgress,
      })
      downloadViralGifBlob(result.blob, `${productId}-${asset.key}`)
      previewViralGifBlob(result.blob)
      console.log("[viral-asset-card]", {
        event: "gif_exported",
        productId,
        key: asset.key,
        bytes: result.bytes,
        frames: result.frames,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "gif_failed"
      console.error("[viral-asset-card]", { event: "gif_failed", error: message })
      alert(
        message.includes("image_load_failed")
          ? "GIF bloqué (CORS image)."
          : `Export GIF échoué: ${message}`
      )
    } finally {
      setGifBusy(false)
      setGifProgress(0)
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="relative aspect-video bg-zinc-950">
        <Image
          src={asset.publicUrl}
          alt=""
          fill
          className="object-contain"
          unoptimized
        />
        <div className="absolute bottom-2 right-2 z-20 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
          {livePrice.toFixed(0)}€
        </div>
        <div className="absolute left-2 top-2 z-20 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
          {showGif ? "PNG + GIF ready" : "PNG"}
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
              PNG
            </a>
          )}
          {showGif ? (
            <button
              type="button"
              disabled={gifBusy}
              onClick={() => void exportGif()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {gifBusy ? `GIF ${Math.round(gifProgress * 100)}%` : "GIF animé"}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700"
            onClick={() => onCopyCaption(caption)}
          >
            Caption
          </button>
        </div>
      </div>
    </article>
  )
}
