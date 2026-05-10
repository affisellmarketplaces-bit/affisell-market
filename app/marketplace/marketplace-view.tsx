"use client"

import { useEffect, useState } from "react"

import Link from "next/link"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { ProductCard } from "@/components/ProductCard"
import { Sidebar } from "@/components/marketplace/Sidebar"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
      price:
        o.price ??
        (typeof o.sellingPriceCents === "number"
          ? (o.sellingPriceCents as number) / 100
          : typeof o.basePriceCents === "number"
            ? (o.basePriceCents as number) / 100
            : undefined),
      image: o.image ?? (Array.isArray(o.images) ? o.images[0] : undefined),
    }
  })
}

export function MarketplaceView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryId = searchParams.get("category")
  const subcategoryId = searchParams.get("subcategory")
  const searchQuery = searchParams.get("q") ?? ""

  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    if (categoryId) params.set("categoryId", categoryId)
    if (subcategoryId) params.set("subcategoryId", subcategoryId)
    const q = searchQuery.trim()
    if (q) params.set("q", q)

    const qs = params.toString()
    setLoading(true)
    const url = qs ? `/api/products?${qs}` : `/api/products`

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setProducts(normalizeProducts(data))
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [categoryId, subcategoryId, searchQuery])

  const handleCategoryClick = (catId: string, subId?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    params.delete("subcategory")
    if (subId) {
      params.set("subcategory", subId)
    } else {
      params.set("category", catId)
    }
    const s = params.toString()
    router.push(`/marketplace${s ? `?${s}` : ""}`)
  }

  const hasFilters = Boolean(categoryId || subcategoryId || searchQuery.trim())

  function clearFilters() {
    router.push("/marketplace")
  }

  return (
    <main className="min-h-screen bg-[#FCFCFC]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Marketplace</h1>
            <p className="mt-1 text-zinc-500">Live listings from partner stores — search, filter, open a product.</p>
          </div>
          {hasFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters} className="shrink-0 gap-1.5">
              <X className="h-4 w-4" aria-hidden />
              Clear filters
            </Button>
          ) : null}
        </div>

        <form
          className="mb-8 max-w-xl"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const next = new URLSearchParams(searchParams.toString())
            const localQ = String(fd.get("localQ") ?? "").trim()
            if (localQ) next.set("q", localQ)
            else next.delete("q")
            const s = next.toString()
            router.push(`/marketplace${s ? `?${s}` : ""}`)
          }}
        >
          <label htmlFor="marketplace-local-search" className="sr-only">
            Search listings
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              id="marketplace-local-search"
              name="localQ"
              type="search"
              defaultValue={searchQuery}
              placeholder="Search by product name or description…"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm text-zinc-900 shadow-sm outline-none ring-violet-500/20 placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2"
            />
          </div>
        </form>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="shrink-0 lg:sticky lg:top-[5.25rem] lg:self-start">
            <Sidebar onCategoryClick={handleCategoryClick} />
          </div>

          <div className="min-w-0 flex-1">
            {loading ? (
              <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="animate-pulse">
                    <div className="aspect-square rounded-2xl bg-zinc-200" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-zinc-200" />
                    <div className="mt-2 h-5 w-20 rounded bg-zinc-200" />
                  </li>
                ))}
              </ul>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
                <p className="text-lg font-medium text-zinc-800">No listings match</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                  {hasFilters
                    ? "Try another search or category, or reset filters to see everything in the marketplace."
                    : "There are no published partner listings yet."}
                </p>
                {hasFilters ? (
                  <Button type="button" className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={clearFilters}>
                    Show all listings
                  </Button>
                ) : (
                  <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-6 inline-flex")}>
                    Back home
                  </Link>
                )}
              </div>
            ) : (
              <p className="mb-4 text-sm text-zinc-500">
                <strong className="font-semibold text-zinc-800">{products.length}</strong> listing
                {products.length === 1 ? "" : "s"}
                {searchQuery.trim() ? (
                  <>
                    {" "}
                    for &ldquo;{searchQuery.trim()}&rdquo;
                  </>
                ) : null}
              </p>
            )}
            {!loading && products.length > 0 ? (
              <ul className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <li key={String(product.listingId ?? product.id)} className="flex h-full">
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}
