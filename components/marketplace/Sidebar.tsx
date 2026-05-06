"use client"

import { Zap, Grid3x3, Palette, DollarSign, Truck, Tag } from "lucide-react"

export function Sidebar() {
  return (
    <aside className="w-[19rem] border-r border-gray-200 bg-white">
      {/* SMART FILTERS - Bande Violette */}
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-5 h-5" strokeWidth={3} />
          SMART FILTERS
        </h2>
      </div>
      <div className="px-3 py-4 space-y-2">
        {["🔥 Trending Now", "⚡ Ships in 24h", "💎 Under $100", "⭐ Top Rated 4.5+"].map((item) => (
          <button
            key={item}
            className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-violet-500 hover:bg-violet-50 text-sm font-semibold text-gray-800"
          >
            {item}
          </button>
        ))}
      </div>

      {/* CATEGORY - Bande Noire */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4 mt-6">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Grid3x3 className="w-5 h-5" strokeWidth={3} />
          CATEGORY
        </h2>
      </div>
      <div className="px-3 py-4 space-y-1">
        {["All Departments", "Voice Skills", "Smart Devices", "Fresh Market", "Affisell Haul", "Pharmacy"].map(
          (cat) => (
            <button
              key={cat}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-slate-100"
            >
              {cat}
            </button>
          )
        )}
      </div>

      {/* STYLE - Bande Emerald */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4 mt-6">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Palette className="w-5 h-5" strokeWidth={3} />
          STYLE
        </h2>
      </div>

      {/* PRICE - Bande Amber */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4 mt-6">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-5 h-5" strokeWidth={3} />
          PRICE
        </h2>
      </div>

      {/* DELIVERY - Bande Blue */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-4 mt-6">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-5 h-5" strokeWidth={3} />
          DELIVERY
        </h2>
      </div>

      {/* OFFERS - Bande Rose */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-4 mt-6">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Tag className="w-5 h-5" strokeWidth={3} />
          OFFERS
        </h2>
      </div>
    </aside>
  )
}
