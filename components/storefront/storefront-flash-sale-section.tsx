import { Zap } from "lucide-react"

import { StorefrontProductCard } from "@/components/storefront/product-card"
import { StorefrontFlashSaleCountdown } from "@/components/storefront/storefront-flash-sale-countdown"
import {
  flashSaleFromSectionContent,
  isFlashSaleActive,
  pickFlashSaleProducts,
} from "@/lib/storefront-flash-sale-shared"
import type { HomepageSectionContent } from "@/lib/storefront-sections-shared"
import type { ShopProductCard } from "@/lib/shop-storefront-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string
  products: ShopProductCard[]
  content?: HomepageSectionContent
  accent?: string
  dedicatedHost?: boolean
  labels: {
    eyebrow: string
    title: string
    liveBadge: string
  }
  className?: string
}

export function StorefrontFlashSaleSection({
  storeSlug,
  products,
  content,
  accent,
  dedicatedHost = false,
  labels,
  className,
}: Props) {
  const config = flashSaleFromSectionContent(content)
  if (!config || !isFlashSaleActive(config.endsAt)) return null

  const picks = pickFlashSaleProducts(products, config.listingIds)
  if (picks.length === 0) return null

  const eyebrow = config.eyebrow ?? labels.eyebrow
  const title = config.title ?? labels.title
  const accentStyle = accent?.trim() ? { borderColor: accent, color: accent } : undefined

  return (
    <section
      id="flash-sale"
      className={cn(
        "border-b border-rose-200/80 bg-gradient-to-r from-rose-600 via-red-600 to-orange-500 dark:border-rose-900/50",
        className
      )}
      data-testid="flash-sale-section"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-white">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/90">
              <Zap className="size-4 shrink-0" aria-hidden />
              {eyebrow}
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                {labels.liveBadge}
              </span>
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">{title}</h2>
          </div>
          <StorefrontFlashSaleCountdown endsAt={config.endsAt} className="shrink-0" />
        </div>

        <ul className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {picks.map((item) => (
            <li key={item.listingId} className="w-[11rem] shrink-0 snap-start sm:w-[12.5rem]">
              <StorefrontProductCard
                product={item}
                storeSlug={storeSlug}
                mode="customer"
                dedicatedHost={dedicatedHost}
                flashSale
                flashAccent={accentStyle?.color}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
