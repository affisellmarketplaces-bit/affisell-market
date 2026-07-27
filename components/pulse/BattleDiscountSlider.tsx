"use client"

import { useState } from "react"
import { Percent, Scale } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MIN = 5
const MAX = 50

function clamp(raw: number): number {
  if (!Number.isFinite(raw)) return 20
  return Math.max(MIN, Math.min(MAX, Math.round(raw)))
}

function eurosFromCents(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  })
}

type Props = {
  battleId: string
  initialFlashDiscount?: number
  /** Listing selling price in cents (prix habituel Affisell). */
  sellingPriceCents: number
  /** DGCCRF lowest-30d reference in cents (falls back to selling). */
  priceReferenceCents?: number | null
  className?: string
  onSaved?: (flashDiscount: number, priceReferenceCents: number | null) => void
}

/**
 * Reseller legal Battle flash % slider (5–50).
 * PATCH /api/pulse/battle/[id]/flash-discount — real paid discount + 30d ref.
 */
export function BattleDiscountSlider({
  battleId,
  initialFlashDiscount = 20,
  sellingPriceCents,
  priceReferenceCents = null,
  className,
  onSaved,
}: Props) {
  const [flashDiscount, setFlashDiscount] = useState(() => clamp(initialFlashDiscount))
  const [referenceCents, setReferenceCents] = useState<number | null>(
    typeof priceReferenceCents === "number" && priceReferenceCents > 0
      ? priceReferenceCents
      : null
  )
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sell = Math.max(0, Math.round(sellingPriceCents))
  const flash = clamp(flashDiscount)
  const battlePriceCents = Math.max(1, Math.floor(sell * (1 - flash / 100)))
  const legalRef = referenceCents && referenceCents > 0 ? referenceCents : sell

  async function save() {
    if (!battleId.trim()) {
      setError("Battle introuvable")
      return
    }
    setSaving(true)
    setStatus(null)
    setError(null)
    try {
      const res = await fetch(`/api/pulse/battle/${encodeURIComponent(battleId)}/flash-discount`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashDiscount: flash }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        battle?: {
          flashDiscount?: number
          priceReferenceCents?: number | null
        }
      }
      if (!res.ok) {
        throw new Error(data.error || "Impossible d’enregistrer le discount Battle")
      }
      const next = clamp(data.battle?.flashDiscount ?? flash)
      setFlashDiscount(next)
      const nextRef =
        typeof data.battle?.priceReferenceCents === "number" &&
        data.battle.priceReferenceCents > 0
          ? data.battle.priceReferenceCents
          : referenceCents
      setReferenceCents(nextRef)
      setStatus(`Enregistré: −${next}% (conforme DGCCRF)`)
      onSaved?.(next, nextRef)
      console.log("[pulse-battle/slider]", {
        result: "saved",
        battleId,
        flashDiscount: next,
        priceReferenceCents: nextRef,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/50 to-teal-50/40 p-5 shadow-sm dark:border-emerald-900/50 dark:from-zinc-950 dark:via-emerald-950/20 dark:to-teal-950/10",
        className
      )}
      data-testid="battle-discount-slider"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            <Scale className="size-3.5" aria-hidden />
            Battle légal
          </p>
          <h2 className="mt-1 text-base font-bold text-zinc-900 dark:text-white">
            Mon Battle: −{flash}% pendant 24h après victoire
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Promo plateforme Affisell — le % est réellement déduit au checkout Stripe.
          </p>
        </div>
        <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">
          −{flash}%
        </span>
      </div>

      <label className="mt-5 block space-y-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Percent className="size-4" aria-hidden />
          Discount flash ({MIN}–{MAX}%)
        </span>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={flash}
          onChange={(e) => setFlashDiscount(clamp(Number(e.target.value)))}
          className="h-2 w-full cursor-pointer accent-emerald-600"
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={flash}
          aria-label="Pourcentage discount Battle"
        />
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>{MIN}%</span>
          <span>{MAX}%</span>
        </div>
      </label>

      <div className="mt-4 space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
        <p>
          Prix habituel: {eurosFromCents(sell)} → Prix Battle:{" "}
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            {eurosFromCents(battlePriceCents)}
          </span>
        </p>
        <p className="text-zinc-500 dark:text-zinc-400">
          Légal: prix de référence = plus bas 30 jours ({eurosFromCents(legalRef)}) — Conforme
          DGCCRF
        </p>
      </div>

      <Button
        type="button"
        className="mt-4 w-full sm:w-auto"
        disabled={saving || !battleId}
        onClick={() => void save()}
      >
        {saving ? "Enregistrement…" : "Sauvegarder"}
      </Button>

      {status ? (
        <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">{status}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
    </section>
  )
}
