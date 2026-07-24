"use client"

import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"

type Props = {
  src: string
  alt: string
  /** First 2 grid cards — eager + high priority for LCP. */
  priority?: boolean
  /** Raw gallery URL (e.g. base64) when card `src` is the listing thumbnail proxy. */
  fallbackSrc?: string | null
}

/** Grid card image with CDN-safe referrer + lightweight fallback on load error. */
export function CatalogCardImage({ src, alt, priority = false, fallbackSrc }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={300}
      height={225}
      className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain p-1 sm:p-4"
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
