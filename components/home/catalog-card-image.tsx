"use client"

import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"

type Props = {
  src: string
  alt: string
  /** First 2 grid cards — eager + high priority for LCP. */
  priority?: boolean
  /** Raw gallery URL (e.g. base64) when card `src` is the listing thumbnail proxy. */
  fallbackSrc?: string | null
  /** Buyer home grid uses square hero frame (matches ProductCard customer mode). */
  variant?: "buyer" | "legacy"
}

/** Grid card image with CDN-safe referrer + lightweight fallback on load error. */
export function CatalogCardImage({
  src,
  alt,
  priority = false,
  fallbackSrc,
  variant = "buyer",
}: Props) {
  const isBuyer = variant === "buyer"
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={isBuyer ? 400 : 300}
      height={isBuyer ? 400 : 225}
      className={
        isBuyer
          ? "affisell-product-media-img--buyer pointer-events-none absolute inset-0 z-[1] h-full w-full select-none object-contain transition-transform duration-300 group-hover:scale-[1.05]"
          : "pointer-events-none absolute inset-0 h-full w-full select-none object-contain p-1 sm:p-4"
      }
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      decoding="async"
      draggable={false}
      onError={(e) => {
        const failed = e.currentTarget.src
        if (failed.endsWith(PRODUCT_CARD_IMAGE_FALLBACK)) return
        const fb = fallbackSrc?.trim()
        if (fb && failed !== fb) {
          e.currentTarget.src = fb
          return
        }
        e.currentTarget.src = PRODUCT_CARD_IMAGE_FALLBACK
      }}
    />
  )
}
