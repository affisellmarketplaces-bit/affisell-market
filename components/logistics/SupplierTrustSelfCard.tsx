"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"

import { SupplierTrustBadge } from "@/components/logistics/SupplierTrustBadge"
import { formatTrustTooltip, getSupplierBadge } from "@/lib/logistics/supplier-score"

type MetricsPayload = {
  metrics: {
    trustScore: number
    deliveryScore: number
    totalOrders: number
    onTimeDeliveries: number
    promisedVsActualDelta: number
    onTimeRate: number
  }
  badge: { label: string; boost: number }
  tooltip: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`metrics_${res.status}`)
  return res.json() as Promise<MetricsPayload>
}

/** Supplier self-view trust card on request detail / dashboard. */
export function SupplierTrustSelfCard({ supplierId }: { supplierId: string }) {
  const { data } = useSWR(`/api/suppliers/${supplierId}/metrics`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500">
        Chargement Trust Score…
      </div>
    )
  }

  const m = data.metrics
  const onTimePct = Math.round((m.onTimeRate ?? 0) * 100)
  const delta = m.promisedVsActualDelta
  const badge = getSupplierBadge(m.trustScore)

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        badge.tier === "top"
          ? "border-amber-300 bg-amber-50/80"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-zinc-900">
          Ton Trust Score: {m.trustScore}/100
        </p>
        <SupplierTrustBadge
          trustScore={m.trustScore}
          showScore={false}
          tooltip={data.tooltip || formatTrustTooltip(m)}
          totalOrders={m.totalOrders}
          onTimeDeliveries={m.onTimeDeliveries}
          promisedVsActualDelta={m.promisedVsActualDelta}
        />
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        Respect délais: {onTimePct}% — Écart moyen: {delta >= 0 ? "+" : ""}
        {delta.toFixed(1)}j
        {badge.boost !== 0
          ? ` — Visibilité ${badge.boost > 0 ? "+" : ""}${badge.boost}%`
          : ""}
      </p>
    </div>
  )
}

export function useSupplierMetricsMap(supplierIds: string[]) {
  const [map, setMap] = useState<
    Record<
      string,
      {
        trustScore: number
        deliveryScore: number
        totalOrders: number
        onTimeDeliveries: number
        promisedVsActualDelta: number
      }
    >
  >({})

  const key = supplierIds.slice().sort().join(",")

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        supplierIds.map(async (id) => {
          try {
            const res = await fetch(`/api/suppliers/${id}/metrics`, {
              credentials: "same-origin",
            })
            if (!res.ok) return [id, null] as const
            const j = (await res.json()) as MetricsPayload
            return [
              id,
              {
                trustScore: j.metrics.trustScore,
                deliveryScore: j.metrics.deliveryScore,
                totalOrders: j.metrics.totalOrders,
                onTimeDeliveries: j.metrics.onTimeDeliveries,
                promisedVsActualDelta: j.metrics.promisedVsActualDelta,
              },
            ] as const
          } catch {
            return [id, null] as const
          }
        })
      )
      if (cancelled) return
      const next: typeof map = {}
      for (const [id, m] of entries) {
        if (m) next[id] = m
      }
      setMap(next)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures ids
  }, [key])

  return map
}
