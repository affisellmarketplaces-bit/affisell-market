import { prisma } from "@/lib/prisma"

import { MarketplaceListingCard } from "./marketplace-listing-card"

export const dynamic = "force-dynamic"

export default async function MarketplacePage() {
  const listings = await prisma.affiliateProduct.findMany({
    where: { active: true, product: { active: true } },
    include: {
      product: true,
      affiliate: {
        include: {
          affiliateStore: { select: { slug: true } },
        },
      },
    },
    orderBy: { id: "desc" },
  })

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold">Marketplace</h1>
      <p className="mt-2 text-sm text-zinc-500">Active storefront listings</p>

      <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {listings.length === 0 ? (
          <li className="col-span-full text-center text-zinc-500">No listings yet.</li>
        ) : (
          listings.map((item) =>
            item.product ? (
              <li key={item.id}>
                <MarketplaceListingCard
                  detailHref={`/marketplace/${item.id}`}
                  imageUrl={item.product.image || null}
                  name={item.product.name}
                  priceDisplay={(item.sellingPriceCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: "EUR",
                  })}
                  sellerDisplay={item.affiliate.affiliateStore?.slug ?? item.affiliate.email}
                  product={{ id: item.id }}
                />
              </li>
            ) : null
          )
        )}
      </ul>
    </main>
  )
}
