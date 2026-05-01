import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function MarketplaceListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const listing = await prisma.affiliateProduct.findFirst({
    where: { id, active: true, product: { active: true } },
    include: {
      product: true,
      affiliate: { include: { affiliateStore: { select: { slug: true } } } },
    },
  })

  if (!listing?.product) notFound()

  const slug = listing.affiliate.affiliateStore?.slug ?? listing.affiliate.email

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link href="/marketplace" className="text-sm text-zinc-500 underline">
        ← Marketplace
      </Link>
      <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
        {listing.product.image ? (
          <Image
            src={listing.product.image}
            alt=""
            fill
            className="object-cover"
            sizes="672px"
            unoptimized={listing.product.image.startsWith("http")}
          />
        ) : null}
      </div>
      <h1 className="mt-6 text-2xl font-semibold">{listing.product.name}</h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{listing.product.description}</p>
      <p className="mt-4 text-xl font-semibold">
        {(listing.sellingPriceCents / 100).toLocaleString("en-US", {
          style: "currency",
          currency: "EUR",
        })}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        by <span className="font-medium text-zinc-700 dark:text-zinc-300">{slug}</span>
      </p>
      <p className="mt-10 text-xs text-zinc-400">Checkout wired separately via Stripe when configured.</p>
    </main>
  )
}
