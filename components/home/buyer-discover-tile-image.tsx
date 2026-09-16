"use client"

import { useState } from "react"

import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"
import { cn } from "@/lib/utils"

type Props = {
  src: string
  /** Decorative tile — keep empty so Chrome never dumps alt text into the square. */
  label: string
  className?: string
}

/**
 * Discover grid tiles — native `<img>` (not next/image).
 * Product CDNs (AliExpress, AE, etc.) are often outside `images.remotePatterns`;
 * next/image then 400s and Chrome paints the long French `alt` as visible text.
 */
export function BuyerDiscoverTileImage({ src, label, className }: Props) {
  const [current, setCurrent] = useState(src || PRODUCT_CARD_IMAGE_FALLBACK)

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote marketplace CDNs; matches ProductCard
    <img
      src={current}
      alt=""
      aria-hidden
      title={label}
      width={200}
      height={200}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      className={cn(
        "absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]",
        className
      )}
      onError={() => {
        if (current.endsWith(PRODUCT_CARD_IMAGE_FALLBACK)) return
        setCurrent(PRODUCT_CARD_IMAGE_FALLBACK)
      }}
    />
  )
}
