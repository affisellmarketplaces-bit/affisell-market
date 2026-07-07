"use client"

import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"

type Props = {
  src: string
  alt: string
  priority?: boolean
}

/** Grid card image with CDN-safe referrer + lightweight fallback on load error. */
export function CatalogCardImage({ src, alt, priority = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-contain p-1 sm:p-4"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={(e) => {
        const failed = e.currentTarget.src
        if (failed.endsWith(PRODUCT_CARD_IMAGE_FALLBACK)) return
        if (failed.includes("/api/listing-card-image/")) return
        e.currentTarget.src = PRODUCT_CARD_IMAGE_FALLBACK
      }}
    />
  )
}
