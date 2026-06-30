"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type VolumeTier = {
  label: string
  minGmvEur: number
  bonusPercent: number
}

type InsightPayload = {
  categoryPercent?: number
  effectivePercent?: number
  volumeBonusBps?: number
  volumeTierLabel?: string | null
  trailingGmvCents?: number
  dynamicsEnabled?: boolean
  volumeTiers?: VolumeTier[]
}

type Props = {
  categoryId: string
  className?: string
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function SupplierCategoryCommissionInsight({ categoryId, className }: Props) {
  const [data, setData] = useState<InsightPayload | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = categoryId.trim()
    if (!id) {
      setData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetch(`/api/supplier/category-supplier-commission?categoryId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((payload: InsightPayload) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [categoryId])

  if (!categoryId.trim()) return null

  const categoryPct = data?.categoryPercent
  const effectivePct = data?.effectivePercent
  const bonusPct = (data?.volumeBonusBps ?? 0) / 100
  const trailingGmv = data?.trailingGmvCents ?? 0

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-3 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-teal-950/20",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl"
        aria-hidden
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        Grille intelligente Affisell
      </p>
      {loading ? (
        <p className="mt-1 text-xs text-zinc-500">Calcul du taux catégorie…</p>
      ) : categoryPct != null ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            Commission affilié suggérée par catégorie :{" "}
            <span className="font-semibold tabular-nums">{categoryPct.toFixed(1)} %</span>
            {bonusPct > 0 && effectivePct != null ? (
              <>
                {" "}
                →{" "}
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {effectivePct.toFixed(1)} %
                </span>
                <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-500">
                  (+{bonusPct.toFixed(1)} % volume {data?.volumeTierLabel ?? ""})
                </span>
              </>
            ) : null}
          </p>
          {data?.dynamicsEnabled ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              GMV 30 j : {formatEur(trailingGmv)} — bonus volume appliqué si commission produit = 0
              %.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">Grille indisponible pour cette catégorie.</p>
      )}
    </div>
  )
}
