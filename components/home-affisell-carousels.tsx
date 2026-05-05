"use client"

import { useEffect, useState } from "react"

import { AffisellCarousel } from "@/components/affisell-carousel"
import { getOrCreateAgentSessionId } from "@/lib/agent-session"
import type { CarouselItemJson } from "@/lib/carousel-types"

export function HomeAffisellCarousels() {
  const [consultation, setConsultation] = useState<{
    items: CarouselItemJson[]
    recommendationQuery: string | null
  } | null>(null)
  const [aiPicks, setAiPicks] = useState<{
    items: CarouselItemJson[]
    recommendationQuery: string | null
  } | null>(null)

  useEffect(() => {
    const sid = getOrCreateAgentSessionId()
    const q = sid ? `?sessionId=${encodeURIComponent(sid)}` : ""
    let cancelled = false
    void (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/carousel/consultations${q}`),
          fetch(`/api/carousel/ai-picks${q}`),
        ])
        const j1 = (await r1.json()) as {
          items: CarouselItemJson[]
          recommendationQuery: string | null
        }
        const j2 = (await r2.json()) as {
          items: CarouselItemJson[]
          recommendationQuery: string | null
        }
        if (!cancelled) {
          setConsultation(j1)
          setAiPicks(j2)
        }
      } catch {
        if (!cancelled) {
          setConsultation({ items: [], recommendationQuery: null })
          setAiPicks({ items: [], recommendationQuery: null })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!consultation || !aiPicks) {
    return (
      <div className="grid gap-6">
        <div className="h-[320px] animate-pulse rounded-lg bg-zinc-200" />
        <div className="h-[320px] animate-pulse rounded-lg bg-zinc-200" />
      </div>
    )
  }

  return (
    <div className="grid gap-8">
      {consultation.items.length > 0 ? (
        <AffisellCarousel
          title="En lien avec vos consultations"
          voirPlusHref="/marketplace"
          items={consultation.items}
          recommendationQuery={consultation.recommendationQuery}
        />
      ) : null}
      {aiPicks.items.length > 0 ? (
        <AffisellCarousel
          title="Choisi pour vous par Affisell AI"
          voirPlusHref="/marketplace"
          items={aiPicks.items}
          recommendationQuery={aiPicks.recommendationQuery}
        />
      ) : null}
    </div>
  )
}
