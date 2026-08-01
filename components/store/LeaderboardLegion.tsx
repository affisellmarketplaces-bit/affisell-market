"use client"

import { useCallback, useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import type { AppLocale } from "@/lib/i18n-locale"
import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import { cn } from "@/lib/utils"

type LeaderboardEntry = {
  boost_id: string
  product_id: string
  product_title: string
  boost_margin_rate: number
  ends_at: string
  username: string
  display_name: string | null
  avatar_url: string | null
  sales_count: number
  total_gmv: number
  total_earnings: number
}

type Props = {
  boostId?: string | null
  productId?: string | null
  className?: string
}

function avatarFor(username: string, avatarUrl: string | null): string {
  const trimmed = avatarUrl?.trim()
  if (trimmed) return trimmed
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(username)}`
}

export function LeaderboardLegion({ boostId, productId, className }: Props) {
  const t = useTranslations("legion")
  const locale = useLocale() as AppLocale
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (boostId?.trim()) params.set("boost_id", boostId.trim())
      if (productId?.trim()) params.set("product_id", productId.trim())
      const qs = params.toString()
      const res = await fetch(`/api/legion/leaderboard${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        setRows([])
        return
      }
      const data = (await res.json()) as {
        ok?: boolean
        leaderboard?: LeaderboardEntry[]
      }
      setRows(Array.isArray(data.leaderboard) ? data.leaderboard : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [boostId, productId])

  useEffect(() => {
    setLoading(true)
    void load()
    const id = window.setInterval(() => void load(), 10_000)
    return () => window.clearInterval(id)
  }, [load])

  const money = (n: number) =>
    new Intl.NumberFormat(intlLocaleTag(locale), {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n)

  if (loading && rows === null) {
    return (
      <div
        className={cn(
          "animate-pulse space-y-3 rounded-[20px] border border-zinc-200 bg-white p-5",
          className
        )}
        data-testid="legion-leaderboard-skeleton"
      >
        <div className="h-5 w-40 rounded-full bg-zinc-100" />
        <div className="h-16 rounded-2xl bg-zinc-100" />
        <div className="h-16 rounded-2xl bg-zinc-100" />
        <div className="h-16 rounded-2xl bg-zinc-100" />
      </div>
    )
  }

  const list = rows ?? []
  const header = list[0]
  const pct = header ? Math.round(header.boost_margin_rate * 100) : null

  if (list.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[24px] border border-dashed border-zinc-300 bg-white/80 p-6 text-center",
          className
        )}
        data-testid="legion-leaderboard-empty"
      >
        <Trophy className="mx-auto size-6 text-zinc-300" aria-hidden />
        <p className="mt-3 text-sm font-medium text-zinc-600">{t("leaderboardEmpty")}</p>
        <p className="mt-4 text-[11px] text-zinc-400">
          SIRET {AFFISELL_LEGAL_IDENTITY.siret}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]",
        className
      )}
      data-testid="legion-leaderboard"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 bg-zinc-950 px-5 py-4 text-white">
        <Trophy className="size-5 text-[#d4ff00]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4ff00]">
            {t("battleRoyale")}
          </p>
          <p className="truncate text-sm font-semibold tracking-tight">
            {header.product_title}
            {pct != null ? (
              <span className="tabular-nums text-white/70"> · {pct}%</span>
            ) : null}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d4ff00] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-black/40" />
            <span className="relative inline-flex size-1.5 rounded-full bg-black" />
          </span>
          {t("leaderboardLive")}
        </span>
      </div>

      <ol className="divide-y divide-zinc-100">
        {list.map((row, index) => {
          const rank = index + 1
          const isFirst = rank === 1
          const name = row.display_name?.trim() || `@${row.username}`
          return (
            <li
              key={`${row.boost_id}:${row.username}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 sm:px-5",
                isFirst && "bg-[#d4ff00]/20"
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums",
                  isFirst ? "bg-black text-[#d4ff00]" : "bg-zinc-100 text-zinc-700"
                )}
              >
                {isFirst ? "👑" : `#${rank}`}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarFor(row.username, row.avatar_url)}
                alt=""
                className="size-10 shrink-0 rounded-full border border-zinc-200 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-950">{name}</p>
                <p className="truncate text-xs text-zinc-500">@{row.username}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-zinc-950">
                  {row.sales_count === 1
                    ? t("leaderboardSalesOne", { count: row.sales_count })
                    : t("leaderboardSales", { count: row.sales_count })}
                </p>
                <p className="text-[11px] tabular-nums text-zinc-500">
                  GMV {money(row.total_gmv)} · {money(row.total_earnings)}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="border-t border-zinc-100 px-5 py-3 text-center text-[11px] text-zinc-400">
        SIRET {AFFISELL_LEGAL_IDENTITY.siret}
      </p>
    </div>
  )
}
