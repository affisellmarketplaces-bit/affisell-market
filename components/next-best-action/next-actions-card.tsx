"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { NextAction } from "@/lib/next-best-action/next-best-action"

const PRIORITY_STYLE: Record<NextAction["priority"], string> = {
  haute: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
  moyenne: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
  basse: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
}

const money = (c: number) => formatStoreCurrencyFromCents(c, { maximumFractionDigits: 2 })

/**
 * One to three next actions for the signed-in supplier or reseller (lib/next-best-action). Each says what, why, on
 * which data, the POTENTIAL impact (observed on that product, never promised) and its priority. Nothing is shown when
 * the account's data produced no action — no generic advice.
 */
export function NextActionsCard({ role }: { role: "supplier" | "affiliate" }) {
  const t = useTranslations("nextActions")
  const [actions, setActions] = useState<NextAction[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void fetch(`/api/${role}/next-actions`, { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as { actions: NextAction[] }
        if (alive) setActions(json.actions)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [role])

  if (failed || !actions || actions.length === 0) return null

  const impactLine = (a: NextAction): string => {
    const parts: string[] = []
    if (typeof a.impact.netChangeCents === "number") parts.push(t("impact.netChange", { amount: money(Math.abs(a.impact.netChangeCents)) }))
    if (typeof a.impact.netPerSaleCents === "number") parts.push(t("impact.netPerSale", { amount: money(a.impact.netPerSaleCents) }))
    if (typeof a.impact.paidOrders30d === "number") parts.push(t("impact.orders", { count: a.impact.paidOrders30d }))
    if (typeof a.impact.resellersListing === "number") parts.push(t("impact.resellers", { count: a.impact.resellersListing }))
    if (typeof a.impact.waitingBuyers === "number") parts.push(t("impact.waitingBuyers", { count: a.impact.waitingBuyers }))
    return `${t("impact.label")} ${parts.join(" · ")}`
  }

  return (
    <section
      aria-labelledby={`next-actions-${role}`}
      className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-900 dark:bg-zinc-950"
    >
      <h2 id={`next-actions-${role}`} className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h2>
      <p className="text-xs text-zinc-500">{t("subtitle")}</p>
      <ol className="mt-3 space-y-3">
        {actions.map((a) => (
          <li key={a.key} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[a.priority]}`}>
                {t(`priority.${a.priority}`)}
              </span>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t(`kind.${a.kind}`, { product: a.productName })}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t(`reason.${a.reason}`, { variant: a.variantLabel ?? "", count: a.impact.waitingBuyers ?? 0 })}</p>
            {a.impact.qualityRatio != null && a.impact.qualityRatioLow != null ? (
              <p className="mt-1 text-xs text-zinc-500">
                {t("qualityEvidence", { ratio: a.impact.qualityRatio.toFixed(1), lo: a.impact.qualityRatioLow.toFixed(1) })}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-500">{impactLine(a)}</p>
            <Link href={a.href} className="mt-2 inline-block text-sm font-medium text-violet-700 underline">
              {t(`cta.${a.kind}`)}
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-zinc-500">{t("honesty")}</p>
    </section>
  )
}
