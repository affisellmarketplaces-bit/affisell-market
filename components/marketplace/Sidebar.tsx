"use client"

import {
  ChevronRight,
  DollarSign,
  Grid3x3,
  Loader2,
  Palette,
  Tag,
  Truck,
} from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type FiltersPayload = {
  categories: Array<{ id: string; name: string; icon: string; count: number }>
  styles: Array<{ name: string | null; count: number }>
  priceRanges: Array<{ name: string; min: number; max: number | null; count: number }>
  delivery: Array<{ type: string; count: number; label: string }>
  offers: {
    onSale: number
    newArrivals: number
    bestSellers: number
    refurbished: number
    hasCoupon: number
    ecoFriendly: number
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n > 999) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function Sidebar() {
  const [expanded, setExpanded] = useState<string[]>(["category"])
  const { data: filters, error, isLoading } = useSWR<FiltersPayload>("/api/filters", fetcher, {
    refreshInterval: 30_000,
  })

  const toggle = (section: string) => {
    setExpanded((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  if (isLoading) {
    return (
      <aside className="flex h-[calc(100vh-80px)] w-[19rem] shrink-0 items-center justify-center self-start border-r border-gray-200 bg-white lg:sticky lg:top-[5.25rem]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </aside>
    )
  }

  if (error || !filters) {
    return (
      <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white p-4 lg:sticky lg:top-[5.25rem]">
        <p className="text-sm text-red-600">Could not load filters.</p>
      </aside>
    )
  }

  const hasCategoryStock = filters.categories.some((c) => c.count > 0)

  return (
    <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white lg:sticky lg:top-[5.25rem]">
      {/* CATEGORY */}
      <button
        type="button"
        onClick={() => toggle("category")}
        className="sticky top-0 z-10 flex w-full items-center justify-between bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4"
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
          {!hasCategoryStock ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No products yet</div>
          ) : (
            filters.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="group flex w-full items-center justify-between border-b border-gray-50 px-4 py-2.5 text-left text-sm text-gray-700 transition-all hover:translate-x-1 hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-base">{cat.icon ?? "📦"}</span>
                  <span className="truncate font-medium">{cat.name}</span>
                </span>
                <span className="shrink-0 pl-2 text-xs font-bold text-gray-400 group-hover:text-gray-600">
                  {formatCount(cat.count)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {/* STYLE */}
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
        <div className="grid max-h-[min(360px,50vh)] grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-3 py-4">
          {filters.styles.length === 0 ? (
            <div className="col-span-2 py-4 text-center text-sm text-gray-400">No styles yet</div>
          ) : (
            filters.styles.map((style) => (
              <button
                key={style.name ?? "unknown"}
                type="button"
                className="rounded-lg border-2 border-gray-200 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-all hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <div className="capitalize">{style.name}</div>
                <div className="mt-0.5 text-[11px] text-gray-400">{formatCount(style.count)} items</div>
              </button>
            ))
          )}
        </div>
      ) : null}

      {/* PRICE */}
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
          {filters.priceRanges.length === 0 ? (
            <p className="text-center text-sm text-gray-400">No matching price bands</p>
          ) : (
            filters.priceRanges.map((range) => (
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
                <span className="text-xs font-bold text-gray-400">{formatCount(range.count)}</span>
              </label>
            ))
          )}
        </div>
      ) : null}

      {/* DELIVERY */}
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
        <div className="max-h-[min(320px,45vh)] space-y-2 overflow-y-auto overscroll-contain px-4 py-4">
          {filters.delivery.length === 0 ? (
            <p className="text-center text-sm text-gray-400">No delivery options yet</p>
          ) : (
            filters.delivery.map((opt) => (
              <label
                key={opt.type}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent p-2.5 hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" readOnly />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {opt.label}
                  </span>
                </div>
                <span className="text-xs font-bold text-gray-400">{formatCount(opt.count)}</span>
              </label>
            ))
          )}
        </div>
      ) : null}

      {/* OFFERS */}
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
              <span className="text-xs font-bold">{formatCount(filters.offers.onSale)}</span>
            </button>
          ) : null}
          {filters.offers.newArrivals > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all hover:border-emerald-500 hover:bg-emerald-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                New Arrivals
              </span>
              <span className="text-xs font-bold">{formatCount(filters.offers.newArrivals)}</span>
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
              <span className="text-xs font-bold">{formatCount(filters.offers.bestSellers)}</span>
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
              <span className="text-xs font-bold">{formatCount(filters.offers.refurbished)}</span>
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
              <span className="text-xs font-bold">{formatCount(filters.offers.hasCoupon)}</span>
            </button>
          ) : null}
          {filters.offers.ecoFriendly > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-green-200 px-4 py-3 text-sm font-semibold text-green-800 transition-all hover:border-green-500 hover:bg-green-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🌿</span>
                Eco-friendly
              </span>
              <span className="text-xs font-bold">{formatCount(filters.offers.ecoFriendly)}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
