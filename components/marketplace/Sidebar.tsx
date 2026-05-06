"use client"

import {
  ChevronRight,
  DollarSign,
  Grid3x3,
  Loader2,
  Palette,
  Tag,
  Truck,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type CategoryRow = {
  id: string
  name: string
  icon: string
  count: number
}

type StyleRow = { id: string; name: string; count: number }
type PriceRow = { id: string; name: string; count: number }
type DeliveryRow = { type: string; count: number }
type OffersAgg = {
  onSale: number
  newArrivals: number
  bestSellers: number
  refurbished: number
  hasCoupon: number
}

type FilterCounts = {
  categories: CategoryRow[]
  styles: StyleRow[]
  priceRanges: PriceRow[]
  delivery: DeliveryRow[]
  offers: OffersAgg
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function Sidebar() {
  const [expanded, setExpanded] = useState<string[]>(["category"])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterCounts | null>(null)

  useEffect(() => {
    fetch("/api/filters/counts")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then((data: FilterCounts) => {
        setFilters(data)
        setError(null)
      })
      .catch(() => {
        setFilters(null)
        setError("Could not load filters")
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = useCallback((section: string) => {
    setExpanded((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }, [])

  if (loading) {
    return (
      <aside className="flex h-[calc(100vh-80px)] w-[19rem] shrink-0 items-center justify-center border-r border-gray-200 bg-white lg:sticky lg:top-[5.25rem] lg:self-start">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </aside>
    )
  }

  if (error || !filters) {
    return (
      <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 lg:sticky lg:top-[5.25rem] lg:self-start">
        <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>
      </aside>
    )
  }

  return (
    <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white lg:sticky lg:top-[5.25rem]">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Zap className="h-5 w-5" strokeWidth={3} />
          SMART FILTERS
        </h2>
      </div>
      <div className="space-y-2 px-3 py-4">
        {[
          { icon: "🔥", label: "Trending Now", key: "trending" },
          { icon: "⚡", label: "Ships in 24h", key: "fast" },
          { icon: "💎", label: "Under $100", key: "cheap" },
          { icon: "⭐", label: "Top Rated 4.5+", key: "rated" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-800 transition-all hover:border-violet-500 hover:bg-violet-50"
          >
            <span className="mr-2 text-xl">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => toggle("category")}
        className="sticky top-0 z-20 mt-6 flex w-full items-center justify-between bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          CATEGORY
        </h2>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("category") && "rotate-90"
          )}
        />
      </button>

      {expanded.includes("category") ? (
        <div className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain bg-white">
          <button
            type="button"
            className="w-full border-b border-gray-100 bg-violet-50 px-4 py-3 text-left text-sm font-bold text-violet-600 hover:bg-violet-100"
          >
            All Departments
          </button>
          {filters.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="group flex w-full items-center justify-between border-b border-gray-50 px-4 py-2.5 text-left text-sm text-gray-700 transition-all hover:translate-x-1 hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-base">{cat.icon ?? "📦"}</span>
                <span className="truncate font-medium">{cat.name}</span>
              </span>
              <span className="shrink-0 pl-2 text-xs font-semibold text-gray-400 group-hover:text-gray-600">
                {formatCount(cat.count)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => toggle("style")}
        className="mt-6 flex w-full items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Palette className="h-5 w-5" strokeWidth={3} />
          STYLE
        </h2>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("style") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("style") ? (
        <div className="max-h-[300px] grid grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-3 py-4">
          {filters.styles.length === 0 ? (
            <p className="col-span-2 px-2 text-xs text-gray-500">No style tags indexed yet.</p>
          ) : (
            filters.styles.map((style) => (
              <button
                key={style.id}
                type="button"
                className="rounded-lg border-2 border-gray-200 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-all hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <div>{style.name}</div>
                <div className="mt-0.5 text-[11px] text-gray-400">{formatCount(style.count)} items</div>
              </button>
            ))
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => toggle("price")}
        className="mt-6 flex w-full items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <DollarSign className="h-5 w-5" strokeWidth={3} />
          PRICE
        </h2>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("price") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("price") ? (
        <div className="space-y-3 px-4 py-4">
          {filters.priceRanges.map((range) => (
            <label
              key={range.name}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2 hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-amber-600" readOnly />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {range.name}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-400">{formatCount(range.count)}</span>
            </label>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => toggle("delivery")}
        className="mt-6 flex w-full items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Truck className="h-5 w-5" strokeWidth={3} />
          DELIVERY
        </h2>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("delivery") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("delivery") ? (
        <div className="max-h-[300px] space-y-2 overflow-y-auto overscroll-contain px-4 py-4">
          {filters.delivery.map((opt) => (
            <label
              key={opt.type}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent p-2.5 hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" readOnly />
                <span className="text-sm font-medium capitalize text-gray-700 group-hover:text-gray-900">
                  {opt.type.replaceAll("-", " ")}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-400">{formatCount(opt.count)}</span>
            </label>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => toggle("offers")}
        className="mt-6 flex w-full items-center justify-between bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Tag className="h-5 w-5" strokeWidth={3} />
          OFFERS
        </h2>
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("offers") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("offers") ? (
        <div className="space-y-2 px-3 py-4">
          {filters.offers.onSale > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition-all hover:border-red-500 hover:bg-red-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🏷️</span>
                On Sale
              </span>
              <span className="text-xs font-semibold">{formatCount(filters.offers.onSale)}</span>
            </button>
          ) : null}
          {filters.offers.newArrivals > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all hover:border-emerald-500 hover:bg-emerald-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                New Arrivals (30d)
              </span>
              <span className="text-xs font-semibold">{formatCount(filters.offers.newArrivals)}</span>
            </button>
          ) : null}
          {filters.offers.bestSellers > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 transition-all hover:border-amber-500 hover:bg-amber-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                Best Sellers
              </span>
              <span className="text-xs font-semibold">{formatCount(filters.offers.bestSellers)}</span>
            </button>
          ) : null}
          {filters.offers.refurbished > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-500 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🔧</span>
                Refurbished
              </span>
              <span className="text-xs font-semibold">{formatCount(filters.offers.refurbished)}</span>
            </button>
          ) : null}
          {filters.offers.hasCoupon > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 transition-all hover:border-blue-500 hover:bg-blue-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🎟️</span>
                Coupon Available
              </span>
              <span className="text-xs font-semibold">{formatCount(filters.offers.hasCoupon)}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
