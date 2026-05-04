import { prisma } from "@/lib/prisma"
import { productWhereForMarketplace } from "@/lib/marketplace-listing-filters"
import { primaryProductImage } from "@/lib/product-images"

import { MarketplaceFilterSidebar } from "./marketplace-filter-sidebar"
import { MarketplaceListingCard } from "./marketplace-listing-card"

export const dynamic = "force-dynamic"

function pickString(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key]
  return typeof v === "string" ? v : undefined
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      <p className="mt-1 text-gray-600">Discover curated products from verified sellers</p>

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
        <MarketplaceFilterSidebar current={filterParams} />
        <div className="min-w-0 flex-1">
          <ul className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {listings.length === 0 ? (
              <li className="col-span-full text-center text-zinc-500">No listings match your filters.</li>
            ) : (
              listings.map((item) =>
                item.product ? (
                  <li key={item.id}>
                    <MarketplaceListingCard
                      detailHref={`/marketplace/${item.id}`}
                      imageUrl={primaryProductImage(item.product.images) || null}
                      name={item.product.name}
                      priceDisplay={(item.sellingPriceCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "EUR",
                      })}
                      sellerDisplay={
                        item.affiliate.store?.name ??
                        (item.affiliate.name?.trim() ? item.affiliate.name.trim() : "Verified Seller")
                      }
                      fastShipping={(item.product.deliveryMax ?? 99) <= 3}
                      product={{ id: item.id }}
                    />
                  </li>
                ) : null
              )
            )}
          </ul>
        </div>
      </div>
    </main>
  )
}
