import { TrendingUp } from "lucide-react"

import { ProductShowcaseCard } from "@/components/product/product-showcase-card"
import { StorefrontProductCard } from "@/components/storefront/product-card"
import { pickStoreBestsellerProducts } from "@/lib/store-bestsellers-shared"
import {
  sectionCopyString,
  sectionProductLimit,
  type HomepageSectionContent,
} from "@/lib/storefront-sections-shared"
import { shopProductToShowcase, type ShopProductCard } from "@/lib/shop-storefront-shared"
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

  const [lead, ...rest] = picks
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
        <div className="grid gap-5 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start">
          {lead ? (
            <ProductShowcaseCard
              product={shopProductToShowcase(lead, storeSlug, { dedicatedHost })}
              className="mx-auto max-w-[30rem] lg:mx-0 lg:max-w-none"
            />
          ) : null}
          <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
            {rest.map((item) => (
              <li key={item.listingId} className="w-[11rem] shrink-0 snap-start sm:w-[12.5rem] lg:w-auto">
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
      </div>
    </section>
  )
}
