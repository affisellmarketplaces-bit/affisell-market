"use client"

import { motion } from "framer-motion"
import Image from "next/image"

import { DeliveryBadge } from "@/components/logistics/DeliveryBadge"
import { BubbleShareBar } from "@/components/product/BubbleShareBar"
import { hexToRgba, useDominantColor } from "@/lib/hooks/useDominantColor"
import type { BubbleProductVariant } from "@/lib/social/bubble-product-types"
import { cn } from "@/lib/utils"

export type BubbleProductCardProduct = {
  id: string
  title: string
  imageUrl: string | null
  salePrice: number
  compareAtPrice?: number | null
  marginEuro: number
  deliveryDays: number
  deliveryCountry: string
  supplierTrustScore: number
  bubbleUrl?: string
}

type Props = {
  product: BubbleProductCardProduct
  variant?: BubbleProductVariant
  showStats?: boolean
  showShareBar?: boolean
  className?: string
}

const VARIANT_SIZE: Record<BubbleProductVariant, string> = {
  "bubble-mini": "h-[120px] w-[120px]",
  "bubble-card": "h-[300px] w-[300px] max-w-full",
  "bubble-story": "aspect-[9/16] w-[min(100vw,360px)]",
  "bubble-feed": "aspect-square w-[min(100vw,360px)]",
  "bubble-tiktok": "aspect-[9/16] w-[min(100vw,360px)]",
}

function formatEuro(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2).replace(".", ",")}€`
}

export function BubbleProductCard({
  product,
  variant = "bubble-card",
  showStats = true,
  showShareBar = false,
  className,
}: Props) {
  const dominantColor = useDominantColor(product.imageUrl)
  const isMini = variant === "bubble-mini"
  const imageSize = isMini ? 56 : variant === "bubble-card" ? 120 : 140

  return (
    <motion.div
      className={cn("relative select-none", VARIANT_SIZE[variant], className)}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      whileHover={{ scale: 1.05, y: -6 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className="bubble-container absolute inset-0 rounded-[2rem] shadow-2xl"
        style={{
          background: `radial-gradient(circle at 30% 20%, ${hexToRgba(dominantColor, 0.85)} 0%, ${hexToRgba(dominantColor, 0.35)} 45%, #0f172a 100%)`,
        }}
      />
      <div
        className={cn(
          "glass-bubble relative flex h-full flex-col items-center justify-center gap-2 rounded-[2rem] border border-white/20 p-3 backdrop-blur-xl",
          isMini && "p-2"
        )}
        style={{ boxShadow: `0 20px 60px ${hexToRgba(dominantColor, 0.35)}` }}
      >
        <div
          className="image-bubble relative shrink-0 overflow-hidden rounded-full bg-white/10"
          style={{
            width: imageSize,
            height: imageSize,
            boxShadow: `0 0 0 3px ${dominantColor}, 0 0 24px ${hexToRgba(dominantColor, 0.6)}`,
          }}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes={`${imageSize}px`}
              unoptimized={product.imageUrl.startsWith("http")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">🫧</div>
          )}
        </div>

        {!isMini ? (
          <p className="line-clamp-2 px-2 text-center text-xs font-semibold text-white/90">{product.title}</p>
        ) : null}

        {showStats ? (
          <div className="stats-bubbles flex flex-wrap items-center justify-center gap-1.5">
            <span className="bubble-mini rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-100 backdrop-blur-sm">
              +{formatEuro(product.marginEuro)} sans stock
            </span>
            <span className="bubble-mini inline-flex rounded-full border border-sky-300/40 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-100 backdrop-blur-sm">
              <DeliveryBadge
                days={product.deliveryDays}
                country={product.deliveryCountry}
                variant="compact"
                className="border-0 bg-transparent p-0 text-[10px] text-sky-100"
              />
            </span>
          </div>
        ) : null}

        {!isMini ? (
          <div className="flex flex-col items-center gap-0.5">
            {product.compareAtPrice != null && product.compareAtPrice > product.salePrice ? (
              <span className="text-sm text-white/50 line-through">{formatEuro(product.compareAtPrice)}</span>
            ) : null}
            <span className="text-2xl font-black tracking-tight text-white">{formatEuro(product.salePrice)}</span>
          </div>
        ) : null}

        {showStats && !isMini ? (
          <span className="rounded-full border border-amber-200/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100">
            🏆 {Math.round(product.supplierTrustScore)}%
          </span>
        ) : null}
      </div>

      {showShareBar && product.bubbleUrl ? (
        <BubbleShareBar productId={product.id} bubbleUrl={product.bubbleUrl} className="absolute -bottom-14 left-1/2 z-10 -translate-x-1/2" />
      ) : null}
    </motion.div>
  )
}
