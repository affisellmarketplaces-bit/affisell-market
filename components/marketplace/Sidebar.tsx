"use client"

import {
  ChevronRight,
  DollarSign,
  Grid3x3,
  Palette,
  Search,
  Tag,
  Truck,
  Zap,
} from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DEPARTMENTS } from "@/lib/categories"
import {
  DELIVERY_OPTIONS,
  OFFER_TYPES,
  PRICE_RANGES,
  STYLE_FILTERS,
} from "@/lib/filters"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const [expanded, setExpanded] = useState<string[]>(["category"])
  const [searchDept, setSearchDept] = useState("")

  const filteredDepts = DEPARTMENTS.filter((d) =>
    d.name.toLowerCase().includes(searchDept.toLowerCase())
  )

  const toggle = (section: string) => {
    setExpanded((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  return (
    <aside className="sticky top-20 h-[calc(100vh-80px)] w-[19rem] shrink-0 self-start overflow-y-auto border-r border-gray-200 bg-white lg:top-24">
      {/* SMART FILTERS */}
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Zap className="h-5 w-5" strokeWidth={3} />
          SMART FILTERS
        </h2>
      </div>
      <div className="space-y-2 px-3 py-4">
        {["🔥 Trending Now", "⚡ Ships in 24h", "💎 Under $100", "⭐ Top Rated 4.5+"].map((item) => (
          <button
            key={item}
            type="button"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-800 transition-all hover:border-violet-500 hover:bg-violet-50"
          >
            {item}
          </button>
        ))}
      </div>

      {/* CATEGORY - Full list with search */}
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
        <div className="bg-white">
          <div className="sticky top-12 z-10 border-b border-gray-100 bg-white px-3 py-3 lg:top-14">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search categories..."
                value={searchDept}
                onChange={(e) => setSearchDept(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            className="w-full border-b border-gray-100 bg-violet-50 px-4 py-3 text-left text-sm font-bold text-violet-600 hover:bg-violet-100"
          >
            All Departments
          </button>

          <div className="max-h-[min(52vh,480px)] overflow-y-auto overscroll-contain">
            {filteredDepts.map((dept) => (
              <button
                key={dept.id}
                type="button"
                className="group flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-gray-700 transition-all hover:translate-x-1 hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-base">{dept.icon}</span>
                  <span className="truncate font-medium">{dept.name}</span>
                  {dept.badge ? (
                    <Badge
                      className={cn(
                        "h-4 shrink-0 px-1.5 py-0 text-[10px] font-semibold",
                        dept.badge === "NEW" && "border-0 bg-emerald-500 text-white hover:bg-emerald-500",
                        dept.badge === "ECO" && "border-0 bg-green-600 text-white hover:bg-green-600"
                      )}
                    >
                      {dept.badge}
                    </Badge>
                  ) : null}
                </span>
                <span className="shrink-0 pl-2 text-xs text-gray-400 group-hover:text-gray-600">
                  {dept.count}
                </span>
              </button>
            ))}
          </div>
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
        <div className="max-h-[300px] grid grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-3 py-4">
          {STYLE_FILTERS.map((style) => (
            <button
              key={style.id}
              type="button"
              className="rounded-lg border-2 border-gray-200 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-all hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <div>{style.name}</div>
              <div className="mt-0.5 text-[11px] text-gray-400">{style.count}</div>
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
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("price") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("price") ? (
        <div className="max-h-[300px] space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {PRICE_RANGES.map((range) => (
            <label
              key={range.id}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2 hover:bg-amber-50"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {range.name}
                </span>
              </div>
              <span className="text-xs text-gray-400">{range.count}</span>
            </label>
          ))}
          <div className="border-t border-gray-200 pt-3">
            <p className="mb-2 text-xs font-bold uppercase text-gray-500">Custom Range</p>
            <div className="flex items-center gap-2">
              <Input type="number" placeholder="Min" className="h-9 text-sm" />
              <span className="text-gray-400">—</span>
              <Input type="number" placeholder="Max" className="h-9 text-sm" />
              <button
                type="button"
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600"
              >
                Go
              </button>
            </div>
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
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("delivery") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("delivery") ? (
        <div className="max-h-[300px] space-y-2 overflow-y-auto overscroll-contain px-4 py-4">
          {DELIVERY_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent p-2.5 hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {opt.name}
                  </span>
                  {opt.badge ? (
                    <Badge className="h-4 border-0 bg-blue-500 px-1.5 py-0 text-[10px] text-white hover:bg-blue-500">
                      {opt.badge}
                    </Badge>
                  ) : null}
                </span>
              </div>
              <span className="shrink-0 text-xs text-gray-400">{opt.count}</span>
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
          className={cn(
            "h-5 w-5 shrink-0 text-white transition-transform",
            expanded.includes("offers") && "rotate-90"
          )}
        />
      </button>
      {expanded.includes("offers") ? (
        <div className="max-h-[300px] space-y-2 overflow-y-auto overscroll-contain px-3 py-4">
          {OFFER_TYPES.map((offer) => (
            <button
              key={offer.id}
              type="button"
              className={cn(
                "group flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all",
                offer.color === "red" && "border-red-200 text-red-700 hover:border-red-500 hover:bg-red-50",
                offer.color === "orange" &&
                  "border-orange-200 text-orange-700 hover:border-orange-500 hover:bg-orange-50",
                offer.color === "emerald" &&
                  "border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50",
                offer.color === "amber" &&
                  "border-amber-200 text-amber-700 hover:border-amber-500 hover:bg-amber-50",
                offer.color === "violet" &&
                  "border-violet-200 text-violet-700 hover:border-violet-500 hover:bg-violet-50",
                offer.color === "rose" && "border-rose-200 text-rose-700 hover:border-rose-500 hover:bg-rose-50",
                offer.color === "blue" && "border-blue-200 text-blue-700 hover:border-blue-500 hover:bg-blue-50",
                offer.color === "teal" && "border-teal-200 text-teal-700 hover:border-teal-500 hover:bg-teal-50",
                offer.color === "green" &&
                  "border-green-200 text-green-700 hover:border-green-500 hover:bg-green-50",
                offer.color === "slate" &&
                  "border-slate-200 text-slate-700 hover:border-slate-500 hover:bg-slate-50"
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xl">{offer.icon}</span>
                <span className="truncate">{offer.name}</span>
                {offer.badge ? (
                  <Badge className="h-4 animate-pulse border-0 bg-red-500 px-1.5 py-0 text-[10px] text-white hover:bg-red-500">
                    {offer.badge}
                  </Badge>
                ) : null}
              </span>
              <span className="shrink-0 text-xs opacity-60">{offer.count}</span>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
