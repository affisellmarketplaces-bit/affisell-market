"use client"

import Image from "next/image"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type CatalogProduct = {
  id: string
  name: string
  description: string
  image: string
  basePriceCents: number
  commissionRate: number
  supplier: { email: string }
}

type Listing = {
  id: string
  sellingPriceCents: number
  active: boolean
  product: CatalogProduct | null
}

type Props = {
  catalog: CatalogProduct[]
  listings: Listing[]
}

export function AffiliateDashboard({ catalog, listings: initialListings }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<"catalog" | "store">("catalog")
  const [listings, setListings] = useState(initialListings)
  const [toast, setToast] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [sellEUR, setSellEUR] = useState("")

  useEffect(() => {
    setListings(initialListings)
  }, [initialListings])

  function fmtEUR(cents: number) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "EUR" })
  }

  async function addToStore(productId: string, basePriceCents: number) {
    const euro = Number(String(sellEUR).replace(",", "."))
    if (!Number.isFinite(euro) || euro * 100 < basePriceCents) {
      setToast("Selling price must be ≥ base price.")
      setTimeout(() => setToast(null), 2400)
      return
    }
    const res = await fetch("/api/affiliate/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, sellingPriceCents: Math.round(euro * 100) }),
    })
    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      setToast(json.error ?? "Could not add")
      setTimeout(() => setToast(null), 2400)
      return
    }
    setToast("Added to your store.")
    setTimeout(() => setToast(null), 1800)
    setAddingId(null)
    router.refresh()
  }

  async function patchListing(id: string, active: boolean) {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, active } : l)))
    const res = await fetch(`/api/affiliate/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      setToast(json.error ?? "Update failed")
      setTimeout(() => setToast(null), 2400)
      router.refresh()
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Affiliate dashboard</h1>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-zinc-50"
        >
          Logout
        </button>
      </div>

      <div className="mt-6 flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={
            tab === "catalog"
              ? "border-b-2 border-zinc-900 px-4 py-2 text-sm font-medium dark:border-zinc-100"
              : "px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }
        >
          Supplier catalog
        </button>
        <button
          type="button"
          onClick={() => setTab("store")}
          className={
            tab === "store"
              ? "border-b-2 border-zinc-900 px-4 py-2 text-sm font-medium dark:border-zinc-100"
              : "px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }
        >
          My store
        </button>
      </div>

      {tab === "catalog" ? (
        <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((p) => (
            <article key={p.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                  src={p.image || "/placeholder.png"}
                  alt={p.name}
                  className="h-48 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.png"
                  }}
                />
              </div>
              <div className="p-4">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.description}</p>
                <p className="mt-2 text-sm">{fmtEUR(p.basePriceCents)} · {p.commissionRate}% of margin</p>
                <p className="text-xs text-zinc-400">Supplier: {p.supplier.email}</p>
                {addingId === p.id ? (
                  <div className="mt-3 space-y-2">
                    <label className="block text-xs text-zinc-500">
                      Selling price (EUR)
                      <input
                        type="number"
                        step="0.01"
                        min={p.basePriceCents / 100}
                        value={sellEUR}
                        onChange={(e) => setSellEUR(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => addToStore(p.id, p.basePriceCents)}
                        className="flex-1 rounded bg-zinc-900 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Add to store
                      </button>
                      <button type="button" onClick={() => setAddingId(null)} className="text-xs underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingId(p.id)
                      setSellEUR((p.basePriceCents / 100).toFixed(2))
                    }}
                    className="mt-3 w-full rounded-md bg-zinc-900 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Add to store
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-8 space-y-4">
          {listings.filter((l) => l.product).length === 0 ? (
            <p className="text-zinc-500">No items in your store yet. Add from the catalog.</p>
          ) : (
            listings
              .filter((l): l is Listing & { product: CatalogProduct } => Boolean(l.product))
              .map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
                    {l.product.image ? (
                      <Image src={l.product.image} alt="" fill className="object-cover" unoptimized={l.product.image.startsWith("http")} />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.product.name}</p>
                    <p className="text-sm text-zinc-600">{fmtEUR(l.sellingPriceCents)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={l.active} onChange={(e) => patchListing(l.id, e.target.checked)} />
                    Listed
                  </label>
                </div>
              ))
          )}
        </section>
      )}

      {toast ? (
        <div className="fixed bottom-8 right-8 z-50 max-w-xs rounded-lg bg-black px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
