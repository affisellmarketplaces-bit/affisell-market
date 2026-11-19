"use client"

import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import type { SelectionItem } from "@/lib/reseller-copilot/selection"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

type Payload = {
  selection: SelectionItem[]
  blocked: SelectionItem[]
  considered: number
  alreadyInShop: number
  truncated: boolean
  affiliateFeeBps: number | null
}

const money = (c: number) => formatStoreCurrencyFromCents(c, { maximumFractionDigits: 2 })

/**
 * Reseller copilot (lib/reseller-copilot/selection.ts): the products of the catalogue that can really be sold, what one
 * sale really pays (after Affisell's fee), and why some are left out — then add the kept ones in one action.
 */
export function ResellerCopilotPanel({ onAdded }: { onAdded?: () => void }) {
  const t = useTranslations("affiliate.copilot")
  const [data, setData] = useState<Payload | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [state, setState] = useState<"idle" | "loading" | "adding" | "error">("loading")
  const [msg, setMsg] = useState<string | null>(null)
  const [showBlocked, setShowBlocked] = useState(false)

  const load = useCallback(async () => {
    setState("loading")
    const res = await fetch("/api/affiliate/copilot/selection?limit=12", { cache: "no-store", credentials: "include" }).catch(() => null)
    if (!res?.ok) {
      setState("error")
      return
    }
    const json = (await res.json()) as Payload
    setData(json)
    setPicked(new Set(json.selection.filter((s) => s.readiness === "pret").map((s) => s.productId)))
    setState("idle")
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    setState("adding")
    setMsg(null)
    const res = await fetch("/api/affiliate/copilot/selection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ productIds: [...picked] }),
    }).catch(() => null)
    if (!res?.ok) {
      setState("idle")
      setMsg(t("addError"))
      return
    }
    const json = (await res.json()) as { added: number; results: Array<{ ok: boolean }> }
    const refused = json.results.length - json.added
    setMsg(refused > 0 ? t("addedPartial", { added: json.added, refused }) : t("added", { added: json.added }))
    onAdded?.()
    await load()
  }

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (state === "error") return null
  return (
    <section className="mx-auto mt-6 max-w-7xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm md:p-5 dark:border-emerald-900 dark:bg-zinc-950" data-testid="reseller-copilot">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
            <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden />
            {t("title")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void add()}
          disabled={picked.size === 0 || state !== "idle"}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {state === "adding" ? t("adding") : t("addCta", { count: picked.size })}
        </button>
      </header>
      {msg ? <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">{msg}</p> : null}
      {state === "loading" && !data ? <p className="mt-3 text-sm text-zinc-500">{t("loading")}</p> : null}
      {data && data.selection.length === 0 ? <p className="mt-3 text-sm text-zinc-500">{t("empty")}</p> : null}
      {data && data.selection.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.selection.map((s) => (
            <li key={s.productId} className="flex gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <input
                type="checkbox"
                aria-label={t("pick", { name: s.name })}
                className="mt-1 h-4 w-4"
                checked={picked.has(s.productId)}
                onChange={() => toggle(s.productId)}
              />
              {s.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- supplier photos come from many hosts
                <img src={s.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : null}
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{s.name}</p>
                {s.trend?.rising ? (
                  <p className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                    {t("rising", { recent: s.trend.recent14d })}
                  </p>
                ) : null}
                <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
                  <span className="font-bold">{money(s.net.netCents)}</span> {t("netPerSale")}
                </p>
                <p className="text-xs text-zinc-500">
                  {t("priceLine", { price: money(s.suggestedPriceHtCents), ttc: money(s.net.buyerPriceTtcEstimateCents) })}
                </p>
                <p className="text-xs text-zinc-500">
                  {s.demand.paidOrders30d > 0 ? t("demandSeen", { orders: s.demand.paidOrders30d }) : t("demandNone")}
                  {" · "}
                  {t("resellers", { count: s.demand.resellersListing })}
                </p>
                {s.readiness === "a_verifier" ? (
                  <p className="mt-1 text-xs text-amber-700">
                    {s.reasons
                      .filter((r) => ["stock_unknown", "low_stock", "low_net_per_sale"].includes(r.code))
                      .map((r) => t(`reasons.${r.code}`))
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {data ? (
        <footer className="mt-3 space-y-1 text-xs text-zinc-500">
          <p>{data.affiliateFeeBps == null ? t("feeDefault") : t("feeNegotiated", { pct: Math.round(data.affiliateFeeBps / 100) })}</p>
          <p>{t("honesty")}</p>
          {data.blocked.length > 0 ? (
            <button type="button" className="underline" onClick={() => setShowBlocked((v) => !v)}>
              {t("blockedToggle", { count: data.blocked.length })}
            </button>
          ) : null}
          {showBlocked ? (
            <ul className="mt-1 space-y-0.5">
              {data.blocked.map((b) => (
                <li key={b.productId}>
                  {b.name} —{" "}
                  {b.reasons
                    .filter((r) => ["awaiting_affisell_review", "no_explicit_commission", "no_supplier_price", "out_of_stock"].includes(r.code))
                    .map((r) => t(`reasons.${r.code}`))
                    .join(" · ")}
                </li>
              ))}
            </ul>
          ) : null}
        </footer>
      ) : null}
    </section>
  )
}
