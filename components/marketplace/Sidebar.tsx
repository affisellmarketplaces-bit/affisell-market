"use client"

import Link from "next/link"
import { Flame, Sparkles, Zap, TrendingUp } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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

        <div className="border-b border-gray-100">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-white">
              <Flame className="h-5 w-5" />
              Trending Now
            </h2>
          </div>
          <div className="py-2">
            {[
              { name: "Flash Deals", badge: "-70%", hot: true },
              { name: "Viral on TikTok", badge: "2.3M", hot: true },
              { name: "Last Chance", badge: "2h left", hot: false },
            ].map((item) => (
              <Link
                key={item.name}
                href="#"
                className="group flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50"
              >
                <span className="transition-transform group-hover:translate-x-1">{item.name}</span>
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

        <div className="border-b border-gray-100">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-white">
              <Zap className="h-5 w-5" />
              Smart Filters
            </h2>
          </div>
          <div className="space-y-2 p-3">
            {[
              { icon: "🔥", label: "Trending Now", count: "1.2k" },
              { icon: "⚡", label: "Ships in 24h", count: "892" },
              { icon: "💎", label: "Under $100", count: "4.3k" },
              { icon: "⭐", label: "Top Rated 4.5+", count: "2.1k" },
            ].map((filter) => (
              <button
                key={filter.label}
                className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition-all hover:border-violet-400 hover:bg-violet-50"
              >
                <span className="text-xl">{filter.icon}</span>
                <span className="flex-1 text-sm font-medium text-gray-700">{filter.label}</span>
                <span className="text-xs text-gray-400">{filter.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-gray-100">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3">
            <h2 className="text-base font-black uppercase tracking-wider text-white">Shop by Department</h2>
          </div>
          <div className="py-2">
            {categories.map((cat) => {
              const isActive =
                (activeCategory ? activeCategory.toLowerCase() : "") === cat.slug || (!activeCategory && cat.active)
              return (
                <Link
                  key={cat.name}
                  href={`/category/${cat.slug}`}
                  className={cn(
                    "group flex items-center justify-between px-4 py-2.5 text-sm transition-all",
                    isActive ? "bg-slate-900 font-semibold text-white" : "text-gray-700 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2 transition-transform group-hover:translate-x-1">
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
        </div>

        <div className="border-b border-gray-100">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3">
            <h2 className="text-base font-black uppercase tracking-wider text-white">Shop by Style</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {["Minimalist", "Streetwear", "Business", "Boho"].map((style) => (
              <button
                key={style}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:border-emerald-400 hover:bg-emerald-50"
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
            <h2 className="text-base font-black uppercase tracking-wider text-white">Price Range</h2>
          </div>
          <div className="p-4">
            <div className="mb-3 flex gap-2">
              {["$0-50", "$50-100", "$100-200", "$200+"].map((range) => (
                <button
                  key={range}
                  className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-medium transition-all hover:border-amber-400 hover:bg-amber-50"
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}
