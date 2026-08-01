"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { AFFISELL_LEGAL_IDENTITY } from "@/lib/legal/auto-entreprise-identity"
import type { AppLocale } from "@/lib/i18n-locale"
import { intlLocaleTag } from "@/lib/i18n-ui-locale"
import {
  BOOST_DURATION_HOURS,
  BOOST_MARGIN_DEFAULT,
} from "@/lib/legion/boost"

const RATE_OPTIONS = [0.35, 0.4, 0.45, 0.5] as const

type Props = {
  productId: string
  productTitle: string
  currentArmySize: number
}

export function BoostButton({ productId, productTitle, currentArmySize }: Props) {
  const t = useTranslations("legion")
  const locale = useLocale() as AppLocale
  const [rate, setRate] = useState<number>(BOOST_MARGIN_DEFAULT)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boosted, setBoosted] = useState<{
    id: string
    endsAt: string
    rate: number
  } | null>(null)

  async function launchBoost() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/legion/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          product_title: productTitle,
          boost_margin_rate: rate,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        already?: boolean
        boost?: { id: string; ends_at: string; boost_margin_rate: number }
      }
      if (!res.ok || !data.ok || !data.boost) {
        setError(t("errorBoostFailed"))
        return
      }
      setBoosted({
        id: data.boost.id,
        endsAt: data.boost.ends_at,
        rate: data.boost.boost_margin_rate,
      })
      console.log("[legion-boost]", {
        productId,
        result: data.already ? "already_active" : "launched",
        boostId: data.boost.id,
      })
    } catch {
      setError(t("errorNetwork"))
    } finally {
      setLoading(false)
    }
  }

  if (boosted) {
    const endsLabel = new Date(boosted.endsAt).toLocaleTimeString(intlLocaleTag(locale), {
      hour: "2-digit",
      minute: "2-digit",
    })
    return (
      <div className="rounded-[20px] border border-black/10 bg-[#d4ff00] p-5 text-black shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{t("battleActive")}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
          {Math.round(boosted.rate * 100)}% · {BOOST_DURATION_HOURS}h
        </p>
        <p className="mt-2 text-sm text-black/70">
          {t("battleActiveHint", { time: endsLabel })}
        </p>
        <p className="mt-4 text-[11px] text-black/50">
          SIRET {AFFISELL_LEGAL_IDENTITY.siret}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        {t("eyebrow")}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 tabular-nums">
        {currentArmySize.toLocaleString(intlLocaleTag(locale))}
      </p>
      <p className="text-sm text-zinc-500">{t("armyLabel")}</p>

      <p className="mt-5 text-xs font-semibold text-zinc-700">{t("commissionLabel")}</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {RATE_OPTIONS.map((opt) => {
          const active = rate === opt
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setRate(opt)}
              className={
                active
                  ? "rounded-xl bg-black px-2 py-2 text-sm font-bold text-[#d4ff00]"
                  : "rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm font-semibold text-zinc-800 hover:border-zinc-300"
              }
            >
              {Math.round(opt * 100)}%
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-sm text-zinc-600">{t("battleHint", { hours: BOOST_DURATION_HOURS })}</p>

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={() => void launchBoost()}
        className="mt-4 w-full rounded-full bg-[#d4ff00] px-4 py-3 text-sm font-bold text-black transition hover:brightness-95 disabled:opacity-60"
      >
        {loading ? t("launching") : t("launchBattle")}
      </button>

      <p className="mt-4 text-center text-[11px] text-zinc-400">
        SIRET {AFFISELL_LEGAL_IDENTITY.siret}
      </p>
    </div>
  )
}
