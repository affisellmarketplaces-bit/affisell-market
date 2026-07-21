"use client"

import useSWR from "swr"

import { SupplierTrustBadge } from "@/components/logistics/SupplierTrustBadge"

type RankingRow = {
  id: string
  name: string | null
  trustScore: number
  isTopSupplier: boolean
  onTimeRate: number | null
  badge: { label: string; boost: number }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`ranking_${res.status}`)
  return res.json() as Promise<{ suppliers: RankingRow[] }>
}

/** Additive radar rail: Top suppliers by delivery trust. */
export function RadarTopSuppliersRail() {
  const { data } = useSWR("/api/suppliers/ranking?limit=5", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  })

  const rows = data?.suppliers ?? []
  if (rows.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
        Trust fournisseurs Affisell
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {rows.map((s) => {
          const onTime =
            s.onTimeRate != null ? `${Math.round(s.onTimeRate * 100)}% à l'heure` : "nouveau"
          const dimmed = s.trustScore < 40
          return (
            <li
              key={s.id}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
                s.isTopSupplier
                  ? "border-amber-400 bg-white shadow-sm"
                  : dimmed
                    ? "border-zinc-200 bg-zinc-100 opacity-60"
                    : "border-zinc-200 bg-white"
              }`}
            >
              <SupplierTrustBadge trustScore={s.trustScore} showScore />
              <span className="text-[10px] text-zinc-600">
                {s.name || "Fournisseur"} · {onTime}
                {s.badge.boost > 0 ? ` · Boost +${s.badge.boost}%` : ""}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
