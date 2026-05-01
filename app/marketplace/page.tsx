import Image from "next/image"
import Link from "next/link"

import { prisma } from "@/lib/prisma"

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
                <Link
                  href={`/marketplace/${item.id}`}
                  className="block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-800">
                    {item.product.image ? (
                      <Image
                        src={item.product.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width:768px) 100vw, 33vw"
                        unoptimized={item.product.image.startsWith("http")}
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold leading-snug">{item.product.name}</p>
                    <p className="mt-2 text-lg font-medium">
                      {(item.sellingPriceCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      by{" "}
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {item.affiliate.affiliateStore?.slug ?? item.affiliate.email}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            ) : null
          )
        )}
      </ul>
    </main>
  )
}
