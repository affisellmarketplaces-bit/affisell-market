"use client"

import { motion } from "framer-motion"
import { useCallback, useEffect, useState } from "react"

import {
  getMarginLockStatus,
  type MarginLockDto,
  type MarginLockLiveStatus,
} from "@/lib/margin/margin-lock-types"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  salePrice: number
  /** Prefetched active lock (optional). */
  initialLock?: MarginLockDto | null
  className?: string
  onLocked?: (lock: MarginLockDto) => void
}

export function MarginLockBadge({
  productId,
  salePrice,
  initialLock = null,
  className,
  onLocked,
}: Props) {
  const [lock, setLock] = useState<MarginLockDto | null>(initialLock)
  const [status, setStatus] = useState<MarginLockLiveStatus | null>(
    initialLock ? getMarginLockStatus(initialLock) : null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/margin-lock`)
      if (!res.ok) return
      const data = (await res.json()) as {
        lock: MarginLockDto | null
        status: MarginLockLiveStatus | null
      }
      setLock(data.lock)
      setStatus(data.status ?? (data.lock ? getMarginLockStatus(data.lock) : null))
    } catch {
      /* soft */
    }
  }, [productId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!lock || !status?.isActive) return
    const t = window.setInterval(() => {
      setStatus(getMarginLockStatus(lock))
    }, 60_000)
    return () => window.clearInterval(t)
  }, [lock, status?.isActive])

  const createLock = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/margin-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salePrice }),
      })
      const data = (await res.json()) as {
        lock?: MarginLockDto
        status?: MarginLockLiveStatus
        error?: string
      }
      if (!res.ok || !data.lock) {
        setError(data.error === "not_authenticated" ? "Connecte-toi en reseller" : "Lock impossible")
        return
      }
      setLock(data.lock)
      setStatus(data.status ?? getMarginLockStatus(data.lock))
      onLocked?.(data.lock)
      console.log("[margin-lock-ui]", { productId, lockId: data.lock.id, result: "ok" })
    } catch {
      setError("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  if (status?.isActive && lock) {
    const expiring = status.isExpiringSoon
    return (
      <motion.div
        className={cn(
          "inline-flex max-w-full flex-col gap-0.5 rounded-2xl border px-3 py-2 text-xs font-semibold backdrop-blur-xl",
          expiring
            ? "border-amber-300/50 bg-amber-500/15 text-amber-100"
            : "border-emerald-300/40 bg-emerald-500/15 text-emerald-100",
          className
        )}
        animate={expiring ? { opacity: [1, 0.75, 1] } : { scale: [1, 1.02, 1] }}
        transition={{ repeat: Infinity, duration: expiring ? 1.4 : 2.4, ease: "easeInOut" }}
      >
        <span>
          {expiring ? "🟡" : "🟢"} Prix protégé {status.daysLeft}j {status.hoursInDay}h — Marge
          sécurisée {status.profitProtected.toFixed(2)}€
        </span>
        {expiring ? (
          <button
            type="button"
            onClick={() => void createLock()}
            disabled={loading}
            className="text-left text-[10px] font-bold underline underline-offset-2"
          >
            Expire bientôt — Renouvelle 7j
          </button>
        ) : null}
      </motion.div>
    )
  }

  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={() => void createLock()}
        disabled={loading}
        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:bg-cyan-500/20 disabled:opacity-60"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition group-hover:opacity-100" />
        {loading ? "Verrouillage…" : "🔒 Bloquer mon prix 7j"}
      </button>
      {error ? <p className="text-[10px] text-red-300">{error}</p> : null}
    </div>
  )
}
