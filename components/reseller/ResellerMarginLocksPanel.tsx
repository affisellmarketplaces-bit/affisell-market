"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { getMarginLockStatus, type MarginLockDto, type MarginLockLiveStatus } from "@/lib/margin/margin-lock-types"

type LockRow = MarginLockDto & { live?: MarginLockLiveStatus }

export function ResellerMarginLocksPanel() {
  const [locks, setLocks] = useState<LockRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/reseller/margin-locks")
        if (!res.ok) return
        const data = (await res.json()) as { locks: LockRow[] }
        if (!cancelled) setLocks(data.locks ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-zinc-900">Mes prix protégés 🔒</h2>
        <Link href="/dashboard/affiliate/catalog" className="text-xs font-semibold text-emerald-700">
          Catalogue →
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        Coût fournisseur bloqué 7 jours — liste sans peur d’une hausse surprise.
      </p>

      {loading ? (
        <p className="mt-4 text-xs text-zinc-500">Chargement…</p>
      ) : locks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-white/70 px-3 py-4 text-xs text-zinc-500">
          Aucun lock actif. Ouvre une fiche bulle et clique « Bloquer mon prix 7j ».
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {locks.map((lock) => {
            const live = lock.live ?? getMarginLockStatus(lock)
            return (
              <li
                key={lock.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/product/${encodeURIComponent(lock.productId)}/bubble`}
                    className="block truncate text-sm font-semibold text-zinc-900 hover:text-emerald-700"
                  >
                    {lock.productTitle ?? lock.productId}
                  </Link>
                  <p className="text-[11px] text-zinc-500">
                    Coût verrouillé {lock.lockedCost.toFixed(2)}€ · vente {lock.salePrice.toFixed(2)}€
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={
                      live.isExpiringSoon
                        ? "text-xs font-bold text-amber-600"
                        : "text-xs font-bold text-emerald-700"
                    }
                  >
                    {live.daysLeft}j {live.hoursInDay}h
                  </p>
                  <p className="text-[10px] text-zinc-500">+{live.profitProtected.toFixed(2)}€ protégé</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
