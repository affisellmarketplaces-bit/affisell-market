"use client"

import { DollarSign, Grid3x3, Palette, Tag, Truck, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
 
export function Sidebar() {

  return (
    <aside className="w-[19rem] border-r border-gray-200 bg-white">
      {/* SMART FILTERS - Bande Violette */}
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-4 mb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-5 h-5" strokeWidth={3} />
          SMART FILTERS
        </h2>
      </div>
      <div className="px-3 pb-6 space-y-2">
        {[
          { icon: "🔥", label: "Trending Now", count: "1.2k" },
          { icon: "⚡", label: "Ships in 24h", count: "892" },
          { icon: "💎", label: "Under $100", count: "4.3k" },
          { icon: "⭐", label: "Top Rated 4.5+", count: "2.1k" },
        ].map((filter) => (
          <button
            key={filter.label}
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-violet-500 hover:bg-violet-50 transition-all text-left group"
          >
            <span className="text-2xl">{filter.icon}</span>
            <span className="flex-1 text-sm font-semibold text-gray-800">{filter.label}</span>
            <Badge variant="secondary" className="text-xs">
              {filter.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* CATEGORY - Bande Slate Noir */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4 mb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Grid3x3 className="w-5 h-5" strokeWidth={3} />
          CATEGORY
        </h2>
      </div>
      <div className="px-3 pb-6 space-y-1">
        {[
          { name: "Software", count: "8.2k" },
          { name: "Sports & Outdoors", count: "12.4k", new: true },
          { name: "Subscribe & Save", count: "3.1k" },
          { name: "Tools & Home Improvement", count: "24.8k" },
        ].map((cat) => (
          <button
            key={cat.name}
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-slate-100 hover:translate-x-1 transition-all group"
          >
            <span className="flex items-center gap-2">
              {cat.name}
              {cat.new && (
                <Badge className="bg-emerald-500 text-white text-xs px-1.5 py-0 h-4">
                  NEW
                </Badge>
              )}
            </span>
            <span className="text-xs text-gray-400">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* STYLE - Bande Emerald */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4 mb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Palette className="w-5 h-5" strokeWidth={3} />
          STYLE
        </h2>
      </div>

      {/* PRICE - Bande Amber */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-4 mb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-5 h-5" strokeWidth={3} />
          PRICE
        </h2>
      </div>

      {/* DELIVERY - Bande Blue */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-4 mb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-5 h-5" strokeWidth={3} />
          DELIVERY
        </h2>
      </div>

      {/* OFFERS - Bande Rose */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-4 mb-4">
        <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Tag className="w-5 h-5" strokeWidth={3} />
          OFFERS
        </h2>
      </div>
    </aside>
  )
}
