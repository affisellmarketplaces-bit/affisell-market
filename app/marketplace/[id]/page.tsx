import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

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
  const gallery = (listing.product.images ?? []).map((s) => s.trim()).filter(Boolean)
  const primary = primaryProductImage(listing.product.images)

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link href="/marketplace" className="text-sm text-zinc-500 underline">
        ← Marketplace
      </Link>
      <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
        {primary ? (
          <Image
            src={primary}
            alt=""
            fill
            className="object-contain p-2"
            sizes="672px"
            unoptimized={primary.startsWith("http")}
          />
        ) : null}
      </div>
      {gallery.length > 1 ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {gallery.slice(0, 10).map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative aspect-square overflow-hidden rounded-lg bg-gray-50 dark:bg-zinc-800"
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-contain p-1"
                sizes="80px"
                unoptimized={url.startsWith("http")}
              />
            </div>
          ))}
        </div>
      ) : null}
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
