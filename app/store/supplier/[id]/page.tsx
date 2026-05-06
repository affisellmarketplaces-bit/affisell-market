import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export const dynamic = "force-dynamic"

export default async function SupplierStorePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)

  const store = await prisma.store.findFirst({
    where: {
      OR: [{ slug: id }, { userId: id }],
      user: { role: "SUPPLIER" },
    },
    include: { user: { select: { id: true, role: true } } },
  })

  if (!store || store.user.role !== "SUPPLIER") notFound()

  const supplierId = store.userId

  const [products, affiliateGroups, clicksSum] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId, active: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["affiliateId"],
      where: { product: { supplierId } },
    }),
    prisma.affiliateProduct.aggregate({
      where: { product: { supplierId } },
      _sum: { clicks: true },
    }),
  ])

  const affiliateCount = affiliateGroups.length
  const viewHint = clicksSum._sum.clicks ?? 0

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
          {store.bannerUrl ? (
            <div className="relative -mx-2 mb-6 aspect-[5/1] max-h-52 overflow-hidden rounded-xl bg-zinc-100 md:mx-0">
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
          <div className="flex flex-wrap items-start gap-4">
            {store.logoUrl ? (
              <Image
                src={store.logoUrl}
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 rounded-xl border border-zinc-200 object-contain"
                unoptimized={store.logoUrl.startsWith("http") || store.logoUrl.startsWith("/uploads")}
              />
            ) : null}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">{store.name}</h1>
              {store.description ? (
                <p className="mt-2 max-w-2xl text-zinc-600">{store.description}</p>
              ) : (
                <p className="mt-2 text-zinc-500">Affisell supplier - live catalog.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-6 text-sm text-zinc-700">
                <span>
                  <strong>{affiliateCount}</strong> active affiliates
                </span>
                <span>
                  <strong>{products.length}</strong> products
                </span>
                <span className="text-green-600">✓ Verified</span>
                {viewHint > 0 ? (
                  <span className="text-zinc-500">
                    <strong>{viewHint.toLocaleString("en-US")}</strong> listing views
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="mb-6 text-sm">
          <Link href="/marketplace" className="text-zinc-500 underline hover:text-zinc-800">
            ← Marketplace
          </Link>
        </nav>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {products.length === 0 ? (
            <p className="col-span-full text-center text-zinc-500">No active products yet.</p>
          ) : (
            products.map((p) => {
              const img = primaryProductImage(p.images) || "/placeholder.png"
              const price = p.basePriceCents / 100
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-lg"
                >
                  <div className="relative h-48 w-full bg-zinc-100">
                    <Image
                      src={img}
                      alt={p.name}
                      fill
                      className="object-contain p-2"
                      sizes="280px"
                      unoptimized={img.startsWith("http")}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-medium text-zinc-900">{p.name}</h3>
                    <p className="text-2xl font-bold text-zinc-900">
                      {price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{p.stock} in stock</p>
                    <Link
                      href={`/marketplace/${p.id}`}
                      className="mt-3 block w-full rounded-lg bg-zinc-900 py-2 text-center text-sm text-white transition hover:bg-zinc-800"
                    >
                      Add to my store
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
