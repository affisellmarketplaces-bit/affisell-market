import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

import { MarketplaceListingCard } from "../../marketplace/marketplace-listing-card"

export const dynamic = "force-dynamic"

export default async function PublicStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      user: { select: { id: true, role: true } },
    },
  })

  if (!store) notFound()

  const role = store.user.role

  if (role === "AFFILIATE") {
    const listings = await prisma.affiliateProduct.findMany({
      where: { affiliateId: store.user.id, active: true, product: { active: true } },
      include: { product: true },
      orderBy: { id: "desc" },
    })

    return (
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <nav className="text-sm">
          <Link href="/marketplace" className="text-zinc-500 underline hover:text-zinc-700">
            ← Marketplace
          </Link>
        </nav>

        <header className="mt-8 flex flex-wrap items-center gap-4">
          {store.logoUrl ? (
            <Image
              src={store.logoUrl}
              alt=""
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-xl border border-zinc-200 object-contain"
              unoptimized={store.logoUrl.startsWith("http") || store.logoUrl.startsWith("/uploads")}
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{store.name}</h1>
            {store.customDomain ? (
              <p className="text-sm text-zinc-500">{store.customDomain}</p>
            ) : (
              <p className="text-sm text-zinc-500">{slug}</p>
            )}
          </div>
        </header>

        {store.description ? (
          <p className="mt-4 max-w-2xl text-sm text-zinc-600">{store.description}</p>
        ) : null}

        {store.bannerUrl ? (
          <div className="relative mt-6 aspect-[5/1] w-full overflow-hidden rounded-xl bg-zinc-100">
            <Image
              src={store.bannerUrl}
              alt=""
              fill
              className="object-cover"
              sizes="1200px"
              unoptimized={store.bannerUrl.startsWith("http") || store.bannerUrl.startsWith("/uploads")}
            />
          </div>
        ) : null}

        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {listings.filter((x) => x.product).length === 0 ? (
            <li className="col-span-full text-center text-zinc-500">No active listings.</li>
          ) : (
            listings
              .filter((item) => item.product)
              .map((item) => (
                <li key={item.id}>
                  <MarketplaceListingCard
                    detailHref={`/marketplace/${item.id}`}
                    imageUrl={primaryProductImage(item.product!.images) || null}
                    name={item.product!.name}
                    priceDisplay={(item.sellingPriceCents / 100).toLocaleString("en-US", {
                      style: "currency",
                      currency: "EUR",
                    })}
                    sellerDisplay={store.name}
                    product={{ id: item.id }}
                  />
                </li>
              ))
          )}
        </ul>
      </main>
    )
  }

  const supplierProducts =
    role === "SUPPLIER"
      ? await prisma.product.findMany({
          where: { supplierId: store.user.id, active: true },
          orderBy: { name: "asc" },
        })
      : []

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <nav className="text-sm">
        <Link href="/marketplace" className="text-zinc-500 underline hover:text-zinc-700">
          ← Marketplace
        </Link>
      </nav>

      <header className="mt-8 flex flex-wrap items-center gap-4">
        {store.logoUrl ? (
          <Image
            src={store.logoUrl}
            alt=""
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-xl border border-zinc-200 object-contain"
            unoptimized={store.logoUrl.startsWith("http") || store.logoUrl.startsWith("/uploads")}
          />
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{store.name}</h1>
          <p className="text-sm text-zinc-500">Supplier catalog</p>
        </div>
      </header>

      {store.description ? (
        <p className="mt-4 max-w-2xl text-sm text-zinc-600">{store.description}</p>
      ) : null}

      <section className="mt-12">
        <h2 className="text-lg font-medium text-zinc-900">Products</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {supplierProducts.length === 0 ? (
            <li className="col-span-full text-zinc-500">No active products listed.</li>
          ) : (
            supplierProducts.map((p) => {
              const mainImg = primaryProductImage(p.images) || "/placeholder.png"
              return (
                <li
                  key={p.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <Link href={`/marketplace`} className="block">
                    <div className="relative mx-auto mb-3 aspect-square w-full max-h-40 bg-zinc-50 dark:bg-zinc-800">
                      <Image
                        src={mainImg}
                        alt={p.name}
                        fill
                        className="object-contain p-2"
                        sizes="240px"
                        unoptimized={mainImg.startsWith("http")}
                      />
                    </div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Available through affiliate listings on the marketplace
                    </p>
                  </Link>
                </li>
              )
            })
          )}
        </ul>
      </section>
    </main>
  )
}
