"use client"

import { ProductCard, type ProductCardDisplayMode } from "@/components/product/ProductCard"
import { shopProductToCardProps, type ShopProductCard } from "@/lib/shop-storefront-shared"
import { STOREFRONT_IMMERSIVE_CARD_CLASS } from "@/lib/storefront-immersive-shared"
import { cn } from "@/lib/utils"

type Props = {
  product: ShopProductCard
  storeSlug: string
  mode?: ProductCardDisplayMode
  dedicatedHost?: boolean
  immersive?: boolean
  className?: string
}

function showLightningSupplierBadge(product: ShopProductCard): boolean {
  const supplier = product.supplier
  if (!supplier) return false
  return supplier.lightningEnabled && supplier.trustScore >= 80
}

export function StorefrontProductCard({
  product,
  storeSlug,
  mode = "customer",
  dedicatedHost = false,
  immersive = false,
  className,
}: Props) {
  const lightningBadge = showLightningSupplierBadge(product)

  return (
    <div className={cn("relative h-full", immersive && STOREFRONT_IMMERSIVE_CARD_CLASS, className)}>
      {lightningBadge ? (
        <span
          className="pointer-events-none absolute left-2 top-2 z-30 max-w-[calc(100%-3rem)] rounded-full border border-amber-300/80 bg-amber-50/95 px-2 py-0.5 text-[10px] font-semibold leading-tight text-amber-950 shadow-sm backdrop-blur-sm dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-100 sm:text-[11px]"
          title="Paiement fournisseur accéléré"
        >
          ⚡ Paiement fournisseur 2min
        </span>
      ) : null}
      <ProductCard
        product={shopProductToCardProps(product, storeSlug, { dedicatedHost })}
        mode={mode}
      />
    </div>
  )
}
