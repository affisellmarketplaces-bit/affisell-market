"use client"

import { Flame } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"

type Item = {
  id: string
  name: string
  imageUrl: string | null
  priceCents: number
  totalSold: number
  soldThisWeek: number
  href: string
  store: { name: string; slug: string; logoUrl: string | null; aiAvatarUrl: string | null } | null
}

export function BestSellers() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/products/bestsellers", { cache: "no-store" })
        const json = (await res.json()) as { items?: Item[] }
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : [])
      } catch {
        if (!cancelled) setError("Could not load best sellers")
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
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Flame className="h-7 w-7 shrink-0 text-orange-500" aria-hidden />
          Best Sellers
        </h2>
        <p className="mt-1 text-sm text-gray-500">Most purchased in the last 7 days</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No sales data yet. Browse the marketplace to get started.</p>
      ) : (
        <div className="-mx-1 flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex w-[42vw] max-w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-100 transition hover:shadow-md hover:ring-gray-200 sm:w-[30vw] md:max-w-none md:w-[calc((100%-5*1rem)/6)] lg:min-w-[160px]"
            >
              <div className="relative aspect-square w-full bg-white p-3">
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
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-gray-900 group-hover:text-green-700">
                  {item.name}
                </p>
                <div className="flex items-center gap-2">
                  {item.store?.aiAvatarUrl || item.store?.logoUrl ? (
                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                      <Image
                        src={item.store.aiAvatarUrl || item.store.logoUrl || ""}
                        alt=""
                        width={32}
                        height={32}
                        className="object-cover object-center"
                        unoptimized
                      />
                    </span>
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-[10px] text-gray-500">
                      shop
                    </span>
                  )}
                  <span className="truncate text-xs text-gray-500">{item.store?.name ?? "Store"}</span>
                </div>
                <p className="text-base font-semibold text-green-600">{priceLabel(item.priceCents)}</p>
                <span className="inline-flex w-fit rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  {item.soldThisWeek} sold this week
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
