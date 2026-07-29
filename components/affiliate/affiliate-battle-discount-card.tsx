"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Swords } from "lucide-react"

import { BattleDiscountSlider } from "@/components/pulse/BattleDiscountSlider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DEFAULT_DISCOUNT = 20

/**
 * Hub card: loads current battle then mounts legal BattleDiscountSlider.
 * Falls back to create if no live/scheduled battle yet.
 */
export function AffiliateBattleDiscountCard() {
  const [battleId, setBattleId] = useState<string | null>(null)
  const [flashDiscount, setFlashDiscount] = useState(DEFAULT_DISCOUNT)
  const [sellingPriceCents, setSellingPriceCents] = useState(3095)
  const [priceReferenceCents, setPriceReferenceCents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const focusBattle =
      window.location.hash === "#battle" ||
      new URLSearchParams(window.location.search).get("battle") === "1"
    if (!focusBattle) return
    const el = document.getElementById("battle")
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/pulse/battle/current", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json().catch(() => null)) as {
          battle?: {
            id?: string
            status?: string
            flashDiscount?: number
            priceReferenceCents?: number | null
            productA?: { priceCents?: number }
            productB?: { priceCents?: number }
          } | null
        } | null
        const b = data?.battle
        if (!b?.id || cancelled) return
        if (b.status !== "live" && b.status !== "scheduled") return
        setBattleId(b.id)
        if (typeof b.flashDiscount === "number") setFlashDiscount(b.flashDiscount)
        if (typeof b.priceReferenceCents === "number" && b.priceReferenceCents > 0) {
          setPriceReferenceCents(b.priceReferenceCents)
        }
        const sell = b.productA?.priceCents ?? b.productB?.priceCents
        if (typeof sell === "number" && sell > 0) setSellingPriceCents(sell)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function bootstrapBattle() {
    setBootstrapping(true)
    setError(null)
    try {
      const res = await fetch("/api/pulse/battle/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashDiscount: DEFAULT_DISCOUNT }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        battleId?: string | null
        liveId?: string | null
        flashDiscount?: number
      }
      if (!res.ok) throw new Error(data.error || "Impossible de créer le battle")
      const nextId = data.liveId || data.battleId || null
      if (!nextId) throw new Error("Aucun battle disponible")
      setBattleId(nextId)
      if (typeof data.flashDiscount === "number") setFlashDiscount(data.flashDiscount)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setBootstrapping(false)
    }
  }

  return (
    <section
      id="battle"
      className="mx-auto max-w-3xl scroll-mt-24 space-y-3 px-4 pt-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">
          <Swords className="size-3.5" aria-hidden />
          Pulse Battle · discount légal
        </div>
        {battleId ? (
          <Link
            href={`/dashboard/pulse/${battleId}`}
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Ouvrir détail Battle →
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      ) : battleId ? (
        <BattleDiscountSlider
          battleId={battleId}
          initialFlashDiscount={flashDiscount}
          sellingPriceCents={sellingPriceCents}
          priceReferenceCents={priceReferenceCents}
        />
      ) : (
        <div className="rounded-2xl border border-violet-200/80 bg-white p-5 dark:border-violet-900/50 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Aucun battle live/programmé. Crée-en un pour fixer ton % flash (5–50) avec référence
            30j DGCCRF.
          </p>
          <Button
            className="mt-4"
            disabled={bootstrapping}
            onClick={() => void bootstrapBattle()}
          >
            {bootstrapping ? "Création…" : "Créer mon prochain Battle (−20%)"}
          </Button>
          {error ? (
            <p className={cn("mt-2 text-xs font-medium text-rose-600 dark:text-rose-400")}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
