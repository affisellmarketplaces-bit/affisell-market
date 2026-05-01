import Image from "next/image"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { prisma } from "@/lib/prisma"

import { MarketplaceCheckoutButton } from "./checkout-button"

export const dynamic = "force-dynamic"

export default async function MarketplaceListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: "product" })

  const listing = await prisma.affiliateProduct.findFirst({
    where: { id, active: true, product: { active: true } },
    include: { product: { include: { supplier: true } } },
  })

  if (!listing?.product) {
    notFound()
  }

  const product = listing.product
  const seller = product.supplier.email

  return (
    <main className="mx-auto max-w-2xl p-8">
      {product.image ? (
        <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-lg bg-zinc-100">
          <Image
            src={product.image}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 672px) 100vw, 672px"
            unoptimized={product.image.startsWith("http")}
          />
        </div>
      ) : null}
      <h1 className="text-2xl font-semibold">{product.name}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{product.description}</p>
      <p className="mt-4 text-lg font-medium">
        {(listing.sellingPriceCents / 100).toLocaleString("en-US", {
          style: "currency",
          currency: "EUR",
        })}
      </p>
      <p className="mt-1 text-sm text-zinc-500">{t("soldBy", { seller })}</p>
      <MarketplaceCheckoutButton
        affiliateProductId={listing.id}
        cancelPath={`/marketplace/${listing.id}`}
        successPath="/success"
      />
    </main>
  )
}
