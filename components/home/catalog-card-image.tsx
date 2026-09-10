"use client"

import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"

type Props = {
  src: string
  alt: string
  priority?: boolean
  fallbackSrc?: string | null
  variant?: "buyer" | "legacy"
}

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
      width={isBuyer? 400 : 300}
      height={isBuyer? 400 : 225}
      className={
        isBuyer
         ? "pointer-events-none relative z-[1] h-full w-full select-none object-contain p-2 transition-transform duration-300 group-hover:scale-[1.05]"
          : "pointer-events-none relative h-full w-full select-none object-contain p-1 sm:p-4"
      }
      loading={priority? "eager" : "lazy"}
      fetchPriority={priority? "high" : "auto"}
      decoding="async"
      sizes={isBuyer? "(max-width: 768px) 50vw, 25vw" : undefined}
      draggable={false}
      style={{ display: "block" }}
      onError={(e) => {
        const failed = e.currentTarget.src
        if (failed.endsWith(PRODUCT_CARD_IMAGE_FALLBACK)) return
        const fb = fallbackSrc?.trim()
        if (fb && failed!== fb) {
          e.currentTarget.src = fb
          return
        }
        e.currentTarget.src = PRODUCT_CARD_IMAGE_FALLBACK
      }}
    />
  )
}