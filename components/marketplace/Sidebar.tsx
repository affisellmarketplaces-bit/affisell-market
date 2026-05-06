"use client"

import {
  ChevronDown,
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

type CategoryNav = {
  id: string
  name: string
  icon: string
  count: number
  subcategories: Array<{ id: string; name: string; slug: string; count: number }>
}

const EMPTY_FILTERS = {
  categories: [] as CategoryNav[],
  styles: [] as Array<{ name: string | null; count: number }>,
  priceRanges: [] as Array<{ name: string; min: number; max: number | null; count: number }>,
  delivery: [] as Array<{ type: string; count: number; label: string }>,
  offers: {
    onSale: 0,
    newArrivals: 0,
    bestSellers: 0,
    refurbished: 0,
    hasCoupon: 0,
    ecoFriendly: 0,
  },
}

const fetcher = async (url: string) => {
  try {
    const r = await fetch(url)
    const j = (await r.json()) as Record<string, unknown>
    if (!r.ok || (j.error && !Array.isArray(j.categories))) {
      return EMPTY_FILTERS
    }
    return {
      categories: Array.isArray(j.categories)
        ? (j.categories as unknown[]).map((raw) => {
            const c = raw as Record<string, unknown>
            return {
              id: String(c.id ?? ""),
              name: String(c.name ?? ""),
              icon: String(c.icon ?? "📦"),
              count: typeof c.count === "number" ? c.count : 0,
              subcategories: Array.isArray(c.subcategories)
                ? (c.subcategories as Record<string, unknown>[]).map((s) => ({
                    id: String(s.id ?? ""),
                    name: String(s.name ?? ""),
                    slug: String(s.slug ?? ""),
                    count: typeof s.count === "number" ? s.count : 0,
                  }))
                : [],
            } satisfies CategoryNav
          })
        : [],
      styles: Array.isArray(j.styles) ? j.styles : [],
      priceRanges: Array.isArray(j.priceRanges) ? j.priceRanges : [],
      delivery: Array.isArray(j.delivery) ? j.delivery : [],
      offers: {
        ...EMPTY_FILTERS.offers,
        ...(typeof j.offers === "object" && j.offers !== null ? j.offers : {}),
      } as typeof EMPTY_FILTERS.offers,
    }
  } catch {
    return EMPTY_FILTERS
  }
}

export function Sidebar() {
  const [expanded, setExpanded] = useState<string[]>(["category"])
  const [expandedCats, setExpandedCats] = useState<string[]>([])
  const { data, isLoading } = useSWR("/api/filters", fetcher, {
    refreshInterval: 30_000,
    fallbackData: EMPTY_FILTERS,
  })

  const filters = data ?? EMPTY_FILTERS

  const toggle = (section: string) => {
    setExpanded((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  const toggleCategory = (catId: string) => {
    setExpandedCats((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    )
  }

  if (isLoading) {
    return (
      <aside className="flex h-[calc(100vh-80px)] w-[19rem] shrink-0 items-center justify-center self-start border-r border-gray-200 bg-white lg:sticky lg:top-[5.25rem]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </aside>
    )
  }

  const fmt = (n: number) => (n > 999 ? `${(n / 1000).toFixed(1)}k` : String(n))

  const offers = filters.offers
  const noOffers =
    (offers?.onSale ?? 0) === 0 &&
    (offers?.newArrivals ?? 0) === 0 &&
    (offers?.bestSellers ?? 0) === 0 &&
    (offers?.hasCoupon ?? 0) === 0 &&
    (offers?.ecoFriendly ?? 0) === 0

  return (
    <aside className="sticky top-[5.25rem] h-[calc(100vh-80px)] w-[19rem] shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white lg:self-start">
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
        <div className="max-h-[min(560px,65vh)] overflow-y-auto bg-white">
          {filters.categories.map((cat) => (
            <div key={cat.id} className="border-b border-gray-100">
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="group flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-800 transition-all hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-lg">{cat.icon ?? "📦"}</span>
                  <span className="font-semibold">{cat.name}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">
                    {(cat.count ?? 0) > 0 ? fmt(cat.count) : ""}
                  </span>
                  {(cat.subcategories?.length ?? 0) > 0 ? (
                    expandedCats.includes(cat.id) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )
                  ) : null}
                </div>
              </button>

              {expandedCats.includes(cat.id) &&
                (cat.subcategories ?? []).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className="flex w-full items-center justify-between py-2 pl-12 pr-4 text-left text-sm text-gray-600 transition-all hover:bg-slate-50 hover:text-gray-900"
                  >
                    <span className="min-w-0 truncate">{sub.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-gray-400">
                      {(sub.count ?? 0) > 0 ? sub.count : ""}
                    </span>
                  </button>
                ))}
            </div>
          ))}
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
        <div className="grid max-h-[min(360px,50vh)] grid-cols-2 gap-2 overflow-y-auto px-3 py-4">
          {!filters?.styles?.length ? (
            <div className="col-span-2 py-4 text-center text-sm text-gray-400">
              Styles appear as suppliers add them
            </div>
          ) : (
            filters.styles.map((style) => (
              <button
                key={style.name ?? `idx-${style.count}`}
                type="button"
                className="rounded-lg border-2 border-gray-200 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-all hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <div className="capitalize">{style.name ?? ""}</div>
                <div className="mt-0.5 text-[11px] text-gray-400">
                  {typeof style.count === "number" ? style.count : 0} items
                </div>
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
          {!filters?.priceRanges?.length ? (
            <div className="py-4 text-center text-sm text-gray-400">
              Price ranges will show when products are added
            </div>
          ) : (
            filters.priceRanges.map((range) => (
              <label
                key={range.name}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2 hover:bg-amber-50"
              >
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-amber-600" readOnly />
                  <span className="text-sm font-medium text-gray-700">{range.name}</span>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  {typeof range.count === "number" ? range.count : 0}
                </span>
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
        <div className="space-y-2 px-4 py-4">
          {!filters?.delivery?.length ? (
            <div className="py-4 text-center text-sm text-gray-400">
              Delivery options appear with products
            </div>
          ) : (
            filters.delivery.map((opt) => (
              <label
                key={opt.type}
                className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent p-2.5 hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" readOnly />
                  <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  {typeof opt.count === "number" ? opt.count : 0}
                </span>
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
          {(offers?.onSale ?? 0) > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-red-200 px-4 py-3 text-sm font-semibold text-red-700 transition-all hover:border-red-500 hover:bg-red-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🏷️</span>
                On Sale
              </span>
              <span className="text-xs">{offers.onSale}</span>
            </button>
          ) : null}
          {(offers?.newArrivals ?? 0) > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 transition-all hover:border-emerald-500 hover:bg-emerald-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                New Arrivals
              </span>
              <span className="text-xs">{offers.newArrivals}</span>
            </button>
          ) : null}
          {(offers?.bestSellers ?? 0) > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-amber-200 px-4 py-3 text-sm font-semibold text-amber-700 transition-all hover:border-amber-500 hover:bg-amber-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                Best Sellers
              </span>
              <span className="text-xs">{offers.bestSellers}</span>
            </button>
          ) : null}
          {(offers?.hasCoupon ?? 0) > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 transition-all hover:border-blue-500 hover:bg-blue-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🎟️</span>
                Coupon Available
              </span>
              <span className="text-xs">{offers.hasCoupon}</span>
            </button>
          ) : null}
          {(offers?.ecoFriendly ?? 0) > 0 ? (
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border-2 border-green-200 px-4 py-3 text-sm font-semibold text-green-700 transition-all hover:border-green-500 hover:bg-green-50"
            >
              <span className="flex items-center gap-2">
                <span className="text-xl">🌍</span>
                Eco-Friendly
              </span>
              <span className="text-xs">{offers.ecoFriendly}</span>
            </button>
          ) : null}
          {noOffers ? (
            <div className="py-4 text-center text-sm text-gray-400">No active offers yet</div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
