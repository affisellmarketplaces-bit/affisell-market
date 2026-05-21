"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { AffisellCarousel } from "@/components/affisell-carousel"
import type { CarouselItemJson } from "@/lib/carousel-types"
import { cn } from "@/lib/utils"

const NICHES = ["fitness", "tech", "home"] as const

type NicheId = (typeof NICHES)[number]

export function HomePickedForYou() {
  const tAI = useTranslations("AI")
  const tDiscovery = useTranslations("discovery")
  const tHome = useTranslations("home")
  const [niche, setNiche] = useState<NicheId>("fitness")
  const [items, setItems] = useState<CarouselItemJson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/carousel/home-picks?niche=${encodeURIComponent(niche)}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as { items?: CarouselItemJson[] }
        if (!cancelled) setItems(Array.isArray(json.items) ? json.items : [])
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [niche])

  return (
    <section aria-label={tAI("pickedForYou")} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-violet-200/80 bg-violet-50/50 p-1 dark:border-violet-900/50 dark:bg-violet-950/30"
          role="tablist"
          aria-label="Niches"
        >
          {NICHES.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={niche === id}
              onClick={() => setNiche(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                niche === id
                  ? "bg-violet-600 text-white"
                  : "text-violet-800 hover:bg-white/80 dark:text-violet-200"
              )}
            >
              {tDiscovery(`niches.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[280px] animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800" />
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">{tHome("pickedEmpty")}</p>
      ) : (
        <AffisellCarousel
          title={tAI("pickedForYou")}
          voirPlusHref="/shops/browse"
          items={items}
          recommendationQuery={null}
        />
      )}
    </section>
  )
}
