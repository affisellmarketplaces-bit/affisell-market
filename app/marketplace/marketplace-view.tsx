"use client"

import { useEffect, useState } from "react"

import { useRouter, useSearchParams } from "next/navigation"

import { ProductCard } from "@/components/ProductCard"
import { Sidebar } from "@/components/marketplace/Sidebar"

type ProductRow = Record<string, unknown>

function normalizeProducts(raw: unknown): ProductRow[] {
  const list: unknown = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && raw !== null && "products" in raw
      ? (raw as { products: unknown }).products
      : null
  if (!Array.isArray(list)) return []
  return list.map((p) => {
    const o = p as Record<string, unknown>
    return {
      ...o,
      title: o.title ?? o.name,
      price: o.price ?? (typeof o.basePriceCents === "number" ? (o.basePriceCents as number) / 100 : undefined),
      image: o.image ?? (Array.isArray(o.images) ? o.images[0] : undefined),
    }
  })
}

export function MarketplaceView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryId = searchParams.get("category")
  const subcategoryId = searchParams.get("subcategory")

  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (categoryId) params.set("categoryId", categoryId)
    if (subcategoryId) params.set("subcategoryId", subcategoryId)

    const q = params.toString()
    setLoading(true)
    const url = q ? `/api/products?${q}` : `/api/products`

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setProducts(normalizeProducts(data))
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [categoryId, subcategoryId])

  const handleCategoryClick = (catId: string, subId?: string) => {
    const params = new URLSearchParams()
    if (subId) {
      params.set("subcategory", subId)
    } else {
      params.set("category", catId)
    }
    router.push(`/marketplace?${params.toString()}`)
  }

  return (
    <main className="min-h-screen bg-[#FCFCFC]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-zinc-500">Curated products from trusted sellers</p>
        </div>

        <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="shrink-0 lg:sticky lg:top-[5.25rem] lg:self-start">
            <Sidebar onCategoryClick={handleCategoryClick} />
          </div>

          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="py-20 text-center text-zinc-500">Loading…</div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center text-zinc-400">No products in this category yet</div>
            ) : (
              <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <li key={String(product.id)} className="flex h-full">
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
