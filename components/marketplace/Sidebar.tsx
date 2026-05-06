"use client"

import {
  ChevronRight,
  DollarSign,
  Grid3x3,
  Palette,
  Tag,
  Truck,
  Zap,
} from "lucide-react"
import { useState } from "react"

export function Sidebar() {
  const [expanded, setExpanded] = useState<string[]>(["category"])

  const toggle = (section: string) => {
    setExpanded((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  return (
    <aside className="h-[calc(100vh-80px)] w-[19rem] shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
      {/* SMART FILTERS */}
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Zap className="h-5 w-5" strokeWidth={3} />
          SMART FILTERS
        </h2>
      </div>
      <div className="space-y-2 px-3 py-4">
        {[
          { icon: "🔥", label: "Trending Now", count: "1.2k" },
          { icon: "⚡", label: "Ships in 24h", count: "892" },
          { icon: "💎", label: "Under $100", count: "4.3k" },
          { icon: "⭐", label: "Top Rated 4.5+", count: "2.1k" },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            className="group flex w-full items-center justify-between rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition-all hover:border-violet-500 hover:bg-violet-50"
          >
            <span className="flex items-center gap-2">
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </span>
            <span className="text-xs text-gray-500">{item.count}</span>
          </button>
        ))}
      </div>

      {/* CATEGORY */}
      <button
        type="button"
        onClick={() => toggle("category")}
        className="mt-6 flex w-full items-center justify-between bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          CATEGORY
        </h2>
        <ChevronRight
          className={`h-5 w-5 text-white transition-transform ${expanded.includes("category") ? "rotate-90" : ""}`}
        />
      </button>
      {expanded.includes("category") ? (
        <div className="space-y-1 px-3 py-4">
          {["All Departments", "Electronics", "Women's Fashion", "Men's Fashion", "Home & Kitchen", "Beauty", "Sports"].map(
            (cat) => (
              <button
                key={cat}
                type="button"
                className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition-all hover:translate-x-1 hover:bg-slate-100"
              >
                {cat}
              </button>
            )
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
          className={`h-5 w-5 text-white transition-transform ${expanded.includes("style") ? "rotate-90" : ""}`}
        />
      </button>
      {expanded.includes("style") ? (
        <div className="grid grid-cols-2 gap-2 px-3 py-4">
          {["Minimalist", "Vintage", "Modern", "Boho", "Classic", "Sport"].map((style) => (
            <button
              key={style}
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-emerald-500 hover:bg-emerald-50"
            >
              {style}
            </button>
          ))}
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
          className={`h-5 w-5 text-white transition-transform ${expanded.includes("price") ? "rotate-90" : ""}`}
        />
      </button>
      {expanded.includes("price") ? (
        <div className="space-y-3 px-4 py-4">
          {["Under $25", "$25 - $50", "$50 - $100", "$100 - $200", "Over $200"].map((range) => (
            <label key={range} className="group flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-amber-600" />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{range}</span>
            </label>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="number"
              placeholder="Min"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              placeholder="Max"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
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
          className={`h-5 w-5 text-white transition-transform ${expanded.includes("delivery") ? "rotate-90" : ""}`}
        />
      </button>
      {expanded.includes("delivery") ? (
        <div className="space-y-3 px-4 py-4">
          {["Free Shipping", "Same Day", "1-2 Days", "International"].map((opt) => (
            <label key={opt} className="group flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
            </label>
          ))}
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
          className={`h-5 w-5 text-white transition-transform ${expanded.includes("offers") ? "rotate-90" : ""}`}
        />
      </button>
      {expanded.includes("offers") ? (
        <div className="space-y-3 px-4 py-4">
          {["On Sale", "Clearance", "New Arrivals", "Bundle Deals"].map((opt) => (
            <label key={opt} className="group flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-rose-600" />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
            </label>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
