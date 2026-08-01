"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { calculateBoostUrgency } from "@/lib/legion/boost"

type ActiveBoost = {
  id: string
  product_id: string
  product_title: string
  boost_margin_rate: number
  ends_at: string
  minutes_left: number
  progress: number
  is_critical: boolean
  message: string
}

export function BoostBanner() {
  const t = useTranslations("legion")
  const [boost, setBoost] = useState<ActiveBoost | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/legion/boost/active", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as { ok?: boolean; boosts?: ActiveBoost[] }
      const first = data.boosts?.[0] ?? null
      setBoost(first)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  if (!boost) return null

  const live = calculateBoostUrgency(boost.ends_at)
  if (live.minutesLeft <= 0) return null

  const pct = Math.round(boost.boost_margin_rate * 100)

  return (
    <div className="sticky top-16 z-30 border-b border-black/10 bg-[#d4ff00] text-black shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{t("battleRoyale")}</p>
          <p className="truncate text-sm font-semibold tracking-tight sm:text-base">
            {boost.product_title}{" "}
            <span className="tabular-nums">· {pct}%</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/15">
            <div
              className="h-full rounded-full bg-black transition-[width] duration-500"
              style={{ width: `${Math.round(live.progress * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={
              live.isCritical
                ? "rounded-full bg-black px-2.5 py-1 text-xs font-bold tabular-nums text-[#d4ff00]"
                : "rounded-full border border-black/20 bg-white/70 px-2.5 py-1 text-xs font-bold tabular-nums"
            }
          >
            {t("minutesLeft", { minutes: live.minutesLeft })}
          </span>
          <Link
            href={`/product/${encodeURIComponent(boost.product_id)}?boost=${encodeURIComponent(boost.id)}`}
            className="rounded-full bg-black px-3 py-1.5 text-xs font-bold text-[#d4ff00] transition hover:bg-zinc-800"
          >
            {t("sellNow")}
          </Link>
        </div>
      </div>
    </div>
  )
}
