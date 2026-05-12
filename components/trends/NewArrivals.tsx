"use client"

import { Sparkles } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"

type Item = {
  id: string
  name: string
  imageUrl: string | null
  priceCents: number
  href: string
  storeName: string
}

export function NewArrivals() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/products/new-arrivals", { cache: "no-store" })
        const json = (await res.json()) as { items?: Item[] }
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : [])
      } catch {
        if (!cancelled) setError("Could not load new arrivals")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function priceLabel(cents: number) {
    return formatStoreCurrencyFromCents(cents)
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
      <div className="mb-8">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Sparkles className="h-7 w-7 shrink-0 text-amber-500" aria-hidden />
          New Arrivals
        </h2>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No products yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group block overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-200"
              >
                <div className="relative aspect-square w-full bg-white p-3">
                  <span className="absolute left-3 top-3 z-10 rounded-md bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                    NEW
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl || "/placeholder.png"}
                    alt=""
                    className="h-full w-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.png"
                    }}
                  />
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-green-700">
                    {item.name}
                  </p>
                  <p className="text-sm font-semibold text-green-600">{priceLabel(item.priceCents)}</p>
                  <p className="truncate text-xs text-gray-500">{item.storeName}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
