"use client"

import { useState } from "react"
import { Percent, Swords, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MIN_DISCOUNT = 5
const MAX_DISCOUNT = 80
const DEFAULT_DISCOUNT = 20

function clampDiscount(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_DISCOUNT
  return Math.max(MIN_DISCOUNT, Math.min(MAX_DISCOUNT, Math.round(raw)))
}

export function AffiliateBattleDiscountCard() {
  const [discount, setDiscount] = useState(DEFAULT_DISCOUNT)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveBattleDiscount() {
    setSaving(true)
    setStatus(null)
    setError(null)
    try {
      const value = clampDiscount(discount)
      const res = await fetch("/api/pulse/battle/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashDiscount: value }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        battleId?: string | null
        flashDiscount?: number
        scheduledAt?: string | null
      }
      if (!res.ok) {
        throw new Error(data.error || "Impossible de mettre a jour le battle")
      }
      setDiscount(clampDiscount(data.flashDiscount ?? value))
      setStatus(
        data.scheduledAt
          ? `Battle programme mis a jour: -${clampDiscount(data.flashDiscount ?? value)}%`
          : `Discount battle enregistre: -${clampDiscount(data.flashDiscount ?? value)}%`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur reseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
      <div className="rounded-3xl border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/70 to-fuchsia-50/70 p-5 shadow-sm dark:border-violet-900/50 dark:from-zinc-950 dark:via-violet-950/20 dark:to-fuchsia-950/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">
              <Swords className="size-3.5" aria-hidden />
              Pulse Battle
            </div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Definis toi-meme le discount du prochain battle
            </h2>
            <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              Ce pourcentage sera applique au winner checkout si le battle se termine pendant la
              fenetre flash. Tu supprimes le reglache manuel fondateur et gardes la promo sous
              controle.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-violet-200/80 bg-white/80 px-4 py-3 shadow-sm dark:border-violet-900/50 dark:bg-zinc-900/80">
            <Zap className="size-4 text-violet-600 dark:text-violet-300" aria-hidden />
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
              Winner flash
            </span>
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              -{clampDiscount(discount)}%
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end">
          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <Percent className="size-4" aria-hidden />
              Discount battle
            </span>
            <input
              type="range"
              min={MIN_DISCOUNT}
              max={MAX_DISCOUNT}
              step={1}
              value={clampDiscount(discount)}
              onChange={(e) => setDiscount(clampDiscount(Number(e.target.value)))}
              className="h-2 w-full cursor-pointer accent-violet-600"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>{MIN_DISCOUNT}% min</span>
              <span>{MAX_DISCOUNT}% max</span>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Pourcentage</span>
            <Input
              type="number"
              min={MIN_DISCOUNT}
              max={MAX_DISCOUNT}
              step={1}
              value={discount}
              onChange={(e) => setDiscount(clampDiscount(Number(e.target.value)))}
            />
          </label>

          <Button onClick={() => void saveBattleDiscount()} disabled={saving}>
            {saving ? "Enregistrement..." : "Definir pour le prochain battle"}
          </Button>
        </div>

        <div className="mt-3 space-y-1 text-xs">
          <p className="text-zinc-500 dark:text-zinc-400">
            Recommande: 10-25% pour proteger la marge tout en boostant le CTR checkout.
          </p>
          {status ? <p className="font-medium text-emerald-600 dark:text-emerald-400">{status}</p> : null}
          {error ? <p className={cn("font-medium text-rose-600 dark:text-rose-400")}>{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
