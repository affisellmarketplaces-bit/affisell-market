"use client"

import { ProductVideoPlayer } from "@/components/product/product-video-player"
import { ProductVideoWishlistOverlay } from "@/components/product/product-video-wishlist-overlay"

export function DescriptionIllustrativeMedia({
  productId,
  images,
  videos,
}: {
  productId: string
  images: string[]
  videos: string[]
}) {
  if (images.length === 0 && videos.length === 0) return null
  return (
    <div className="mt-5 space-y-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        Photos & videos
      </p>
      {images.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((src, imageIndex) => (
            <li
              key={`illustration-img-${imageIndex}`}
              className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote supplier / CDN URLs */}
              <img src={src} alt="" className="max-h-80 w-full object-contain p-2" loading="lazy" />
            </li>
          ))}
        </ul>
      ) : null}
      {videos.length > 0 ? (
        <ul className="space-y-4">
          {videos.map((url, videoIndex) => (
            <li key={`illustration-video-${videoIndex}`}>
              <ProductVideoWishlistOverlay
                productId={productId}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-black/5 dark:border-zinc-700"
              >
                <ProductVideoPlayer url={url} />
              </ProductVideoWishlistOverlay>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
