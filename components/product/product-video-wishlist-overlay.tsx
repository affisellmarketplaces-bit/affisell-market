"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"

import { WishlistHeart } from "@/components/wishlist-heart"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  children: ReactNode
  className?: string
}

/** Like / save while watching a product video (same wishlist + public like count as listing ♥). */
export function ProductVideoWishlistOverlay({ productId, children, className }: Props) {
  const t = useTranslations("wishlist.heart")

  if (!productId.trim()) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {children}
      <WishlistHeart
        productId={productId}
        ariaLabelAdd={t("addVideo")}
        ariaLabelRemove={t("removeVideo")}
        className="pointer-events-auto absolute right-2 top-2 z-20 sm:right-3 sm:top-3"
      />
    </div>
  )
}
