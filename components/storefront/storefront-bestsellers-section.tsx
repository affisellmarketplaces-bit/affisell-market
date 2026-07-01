import { TrendingUp } from "lucide-react"

import { StorefrontProductCard } from "@/components/storefront/product-card"
import { pickStoreBestsellerProducts } from "@/lib/store-bestsellers-shared"
import {
  sectionCopyString,
  sectionProductLimit,
  type HomepageSectionContent,
} from "@/lib/storefront-sections-shared"
import type { ShopProductCard } from "@/lib/shop-storefront-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string
  products: ShopProductCard[]
  content?: HomepageSectionContent
  dedicatedHost?: boolean
  labels: {
    eyebrow: string
    title: string
    hint: string
  }
  className?: string
}

export function StorefrontBestsellersSection({
  storeSlug,
  products,
  content,
  dedicatedHost = false,
  labels,
  className,
}: Props) {
  const limit = sectionProductLimit(content)
  const picks = pickStoreBestsellerProducts(products, limit)
  if (picks.length < 2) return null

  const title = sectionCopyString(content, "title", labels.title)
  const hint = sectionCopyString(content, "body", labels.hint)

  return (
    <section className={cn("border-b border-zinc-200/80 dark:border-zinc-800", className)}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              <TrendingUp className="size-4" aria-hidden />
              {sectionCopyString(content, "eyebrow", labels.eyebrow)}
            </p>
            <h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{hint}</p>
          </div>
        </div>
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {picks.map((item) => (
            <li key={item.listingId} className="w-[11rem] shrink-0 snap-start sm:w-[12.5rem]">
              <StorefrontProductCard
                product={item}
                storeSlug={storeSlug}
                mode="customer"
                dedicatedHost={dedicatedHost}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
