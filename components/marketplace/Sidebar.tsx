"use client"

import Link from "next/link"
import {
  DollarSign,
  Grid3x3,
  Palette,
  Sparkles,
  Tag,
  Truck,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const subItemClass =
  "group flex w-full items-center justify-between text-left text-sm text-gray-700 hover:bg-gray-50 py-2 px-2 rounded transition-transform hover:translate-x-1"

export function Sidebar({ activeCategory }: { activeCategory?: string }) {
  const categories = [
    { name: "All Departments", count: "89.2k", slug: "all-departments", active: true },
    { name: "Electronics", count: "12.4k", slug: "electronics", isNew: true },
    { name: "Women's Fashion", count: "24.8k", slug: "womens-fashion" },
    { name: "Men's Fashion", count: "18.2k", slug: "mens-fashion" },
    { name: "Home & Kitchen", count: "31.4k", slug: "home-kitchen" },
    { name: "Smart Devices", count: "3.4k", slug: "smart-devices", isNew: true },
    { name: "Beauty & Health", count: "9.1k", slug: "beauty-health" },
  ]

  return (
    <aside className="w-[19rem] border-r border-gray-200 bg-white">
      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 opacity-90" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] [background-size:8px_8px]" />
          <div className="relative p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-white" />
              <h2 className="text-lg font-black uppercase tracking-wide text-white">AI Picks</h2>
              <Badge className="ml-auto border-0 bg-white/20 text-white backdrop-blur hover:bg-white/20">
                <span className="mr-1 relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                Live
              </Badge>
            </div>
            <button className="w-full rounded-lg bg-white py-2.5 font-semibold text-violet-600 transition-all hover:scale-[1.02] hover:bg-gray-50 active:scale-95">
              <Zap className="mr-2 inline h-4 w-4" />
              Ask AI to Shop
            </button>
          </div>
        </div>

        <div className="border-b border-gray-100 px-4 pb-4">
          <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 -mx-4 px-4 py-3 mb-3">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-5 h-5" />
              SMART FILTERS
            </h2>
          </div>
          <div className="space-y-1">
            {[
              { icon: "🔥", label: "Trending Now", count: "1.2k" },
              { icon: "⚡", label: "Ships in 24h", count: "892" },
              { icon: "💎", label: "Under $100", count: "4.3k" },
              { icon: "⭐", label: "Top Rated 4.5+", count: "2.1k" },
            ].map((filter) => (
              <button key={filter.label} type="button" className={subItemClass}>
                <span className="flex items-center gap-2">
                  <span className="text-lg leading-none">{filter.icon}</span>
                  {filter.label}
                </span>
                <span className="text-xs text-gray-400">{filter.count}</span>
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-slate-800 to-slate-900 -mx-4 px-4 py-3 mb-3 mt-6">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Grid3x3 className="w-5 h-5 shrink-0" />
              CATEGORY
            </h2>
          </div>
          <div className="space-y-1">
            {categories.map((cat) => {
              const isActive =
                (activeCategory ? activeCategory.toLowerCase() : "") === cat.slug || (!activeCategory && cat.active)
              return (
                <Link
                  key={cat.name}
                  href={`/category/${cat.slug}`}
                  className={cn(
                    subItemClass,
                    isActive && "bg-slate-900 font-semibold text-white hover:bg-slate-900"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {cat.name}
                    {cat.isNew ? (
                      <Badge className="bg-emerald-500 px-1.5 py-0 text-xs text-white hover:bg-emerald-500">
                        NEW
                      </Badge>
                    ) : null}
                  </span>
                  <span className={cn("text-xs", isActive ? "text-white/70" : "text-gray-400")}>{cat.count}</span>
                </Link>
              )
            })}
          </div>

          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 -mx-4 px-4 py-3 mb-3 mt-6">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-5 h-5 shrink-0" />
              STYLE
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {["Minimalist", "Streetwear", "Business", "Boho"].map((style) => (
              <button key={style} type="button" className={subItemClass}>
                {style}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-amber-500 to-orange-500 -mx-4 px-4 py-3 mb-3 mt-6">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-5 h-5 shrink-0" />
              PRICE
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {["$0-50", "$50-100", "$100-200", "$200+"].map((range) => (
              <button key={range} type="button" className={subItemClass}>
                {range}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 -mx-4 px-4 py-3 mb-3 mt-6">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-5 h-5 shrink-0" />
              DELIVERY
            </h2>
          </div>
          <div className="space-y-1">
            {[
              "Free shipping",
              "Ships in 24h",
              "Express delivery",
              "Local pickup",
            ].map((label) => (
              <button key={label} type="button" className={subItemClass}>
                {label}
              </button>
            ))}
          </div>

          <div className="bg-gradient-to-r from-rose-600 to-pink-600 -mx-4 px-4 py-3 mb-3 mt-6">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-5 h-5 shrink-0" />
              OFFERS
            </h2>
          </div>
          <div className="space-y-1 pb-2">
            {[
              { name: "Flash Deals", badge: "-70%", hot: true },
              { name: "Viral on TikTok", badge: "2.3M", hot: true },
              { name: "Last Chance", badge: "2h left", hot: false },
            ].map((item) => (
              <Link key={item.name} href="#" className={subItemClass}>
                <span>{item.name}</span>
                <Badge
                  variant={item.hot ? "secondary" : "outline"}
                  className={cn("text-xs", item.hot ? "bg-red-500 text-white hover:bg-red-500" : "")}
                >
                  {item.badge}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
