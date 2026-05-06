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
      <div className="mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Palette className="h-5 w-5" strokeWidth={3} />
          STYLE
        </h2>
      </div>

      {/* PRICE */}
      <div className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <DollarSign className="h-5 w-5" strokeWidth={3} />
          PRICE
        </h2>
      </div>

      {/* DELIVERY */}
      <div className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Truck className="h-5 w-5" strokeWidth={3} />
          DELIVERY
        </h2>
      </div>

      {/* OFFERS */}
      <div className="mt-6 bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
          <Tag className="h-5 w-5" strokeWidth={3} />
          OFFERS
        </h2>
      </div>
    </aside>
  )
}
