import { prisma } from "@/lib/prisma"
import { productWhereForMarketplace } from "@/lib/marketplace-listing-filters"
import { primaryProductImage } from "@/lib/product-images"

import { MarketplaceFilterSidebar } from "./marketplace-filter-sidebar"
import { PremiumMarketplaceCard } from "./premium-marketplace-card"

export const dynamic = "force-dynamic"

function pickString(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key]
  return typeof v === "string" ? v : undefined
}

function categoryLabel(name: string) {
  const map: Record<string, string> = {
    Tous: "All",
    Mode: "Fashion",
    Maison: "Home",
    Beauté: "Beauty",
    Sport: "Sports",
  }
  return map[name] ?? name
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const filterParams = {
    shipsFrom: pickString(sp, "shipsFrom"),
    delivery: pickString(sp, "delivery"),
    freeShipping: pickString(sp, "freeShipping"),
    category: pickString(sp, "category"),
    q: pickString(sp, "q"),
  }

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      isListed: true,
      product: productWhereForMarketplace(sp),
    },
    include: {
      product: true,
      affiliate: {
        include: {
          store: { select: { name: true, slug: true, logoUrl: true } },
        },
      },
    },
    orderBy: { id: "desc" },
  })

  const categoryRows = await prisma.product.findMany({
    where: { active: true },
    take: 250,
    select: { categories: true },
  })
  const categoryCountMap = new Map<string, number>()
  for (const row of categoryRows) {
    const seenInProduct = new Set<string>()
    for (const rawCategory of row.categories) {
      if (typeof rawCategory !== "string") continue
      const category = rawCategory.trim()
      if (!category || seenInProduct.has(category)) continue
      seenInProduct.add(category)
      categoryCountMap.set(category, (categoryCountMap.get(category) ?? 0) + 1)
    }
  }
  const categories = [...categoryCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }))
  const activeCategory = filterParams.category?.trim() || ""
  const premiumListingIds = new Set(
    listings
      .filter((item) => item.sellingPriceCents > 10_000 && (item.product?.stock ?? 0) > 10)
      .slice(0, 3)
      .map((item) => item.id)
  )

  function categoryHref(category: string | null) {
    const usp = new URLSearchParams()
    if (filterParams.q) usp.set("q", filterParams.q)
    if (filterParams.shipsFrom) usp.set("shipsFrom", filterParams.shipsFrom)
    if (filterParams.delivery) usp.set("delivery", filterParams.delivery)
    if (filterParams.freeShipping) usp.set("freeShipping", filterParams.freeShipping)
    if (category) usp.set("category", category)
    const s = usp.toString()
    return `/marketplace${s ? `?${s}` : ""}`
  }

  return (
    <main className="min-h-screen bg-[#FCFCFC]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Marketplace</h1>
        <p className="mt-1 text-zinc-500">Curated products from trusted sellers</p>
      </div>

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="w-64 shrink-0">
          <div className="sticky top-6">
            <MarketplaceFilterSidebar current={filterParams} />
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              Top categories:{" "}
              {categories
                .slice(0, 3)
                .map((c) => categoryLabel(c.name))
                .join(", ") || "All"}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.length === 0 ? (
              <li className="col-span-full text-center text-zinc-500">No listings match your filters.</li>
            ) : (
              listings.map((item) =>
                item.product ? (
                  <li key={item.id} className="flex h-full">
                    <PremiumMarketplaceCard
                      detailHref={`/marketplace/${item.id}`}
                      listingId={item.id}
                      productId={item.product.id}
                      imageUrl={primaryProductImage(item.product.images) || null}
                      name={item.product.name}
                      priceDisplay={(item.sellingPriceCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "EUR",
                      })}
                      priceValue={item.sellingPriceCents / 100}
                      showPremiumBadge={premiumListingIds.has(item.id)}
                      sellerDisplay={
                        item.affiliate?.store?.name ??
                        item.affiliate?.name?.trim() ??
                        "Boutique vérifiée"
                      }
                    />
                  </li>
                ) : null
              )
            )}
          </ul>
        </div>
      </div>
      </div>
    </main>
  )
}
