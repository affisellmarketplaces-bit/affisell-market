"use client"

import { DollarSign, Grid3x3, Palette, Tag, Truck, Zap } from "lucide-react"

export function Sidebar() {
  return (
    <aside className="w-[19rem] shrink-0 border-r border-gray-200 bg-white">
      {/* SMART FILTERS */}
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase text-white">
          <Zap className="h-5 w-5" strokeWidth={3} />
          SMART FILTERS
        </h2>
      </div>
      <div className="space-y-2 px-3 py-4">
        {["🔥 Trending Now", "⚡ Ships in 24h", "💎 Under $100", "⭐ Top Rated 4.5+"].map((item) => (
          <button
            key={item}
            type="button"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:border-violet-500 hover:bg-violet-50"
          >
            {item}
          </button>
        ))}
      </div>

      {/* CATEGORY */}
      <div className="mt-6 bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase text-white">
          <Grid3x3 className="h-5 w-5" strokeWidth={3} />
          CATEGORY
        </h2>
      </div>
      <div className="space-y-1 px-3 py-4">
        {["All Departments", "Voice Skills", "Smart Devices", "Fresh Market", "Affisell Haul", "Pharmacy"].map(
          (cat) => (
            <button
              key={cat}
              type="button"
              className="w-full rounded-lg px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-slate-100"
            >
              {cat}
            </button>
          )
        )}
      </div>

      {/* STYLE */}
      <div className="mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase text-white">
          <Palette className="h-5 w-5" strokeWidth={3} />
          STYLE
        </h2>
      </div>

      {/* PRICE */}
      <div className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase text-white">
          <DollarSign className="h-5 w-5" strokeWidth={3} />
          PRICE
        </h2>
      </div>

      {/* DELIVERY */}
      <div className="mt-6 bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase text-white">
          <Truck className="h-5 w-5" strokeWidth={3} />
          DELIVERY
        </h2>
      </div>

      {/* OFFERS */}
      <div className="mt-6 bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-4">
        <h2 className="flex items-center gap-2 text-lg font-black uppercase text-white">
          <Tag className="h-5 w-5" strokeWidth={3} />
          OFFERS
        </h2>
      </div>
    </aside>
  )
}
