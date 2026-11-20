"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { ReplacementProposal } from "@/lib/reseller-replacement/match"
import type { ShopDemandItem, ShopRecoverySummary } from "@/lib/restock-watch/shop-demand"

const money = (c: number) => formatStoreCurrencyFromCents(c, { maximumFractionDigits: 2 })

/**
 * Reseller: buyers of ITS shop waiting for one exact variant, and up to three alternatives that really offer that same
 * variant (real net per sale). The reseller may choose to OFFER one in its shop; nothing is replaced and the buyers'
 * requests stay as they are — the buyer keeps the choice.
 */
export function ShopDemandPanel({ listingId, variantKey }: { listingId: string; variantKey: string }) {
  const t = useTranslations("affiliate.shopDemand")
  const [data, setData] = useState<{ demand: ShopDemandItem | null; proposal: ReplacementProposal } | null>(null)
  const [recovery, setRecovery] = useState<ShopRecoverySummary | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(() => {
    void fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}/shop-demand?variant=${encodeURIComponent(variantKey)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setFailed(true))
    void fetch("/api/affiliate/shop-demand", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRecovery(d?.recovery ?? null))
      .catch(() => undefined)
  }, [listingId, variantKey])
  useEffect(load, [load])

  const choose = async (productId: string) => {
    setBusy(true)
    setNote(null)
    try {
      const r = await fetch(`/api/affiliate/listings/${encodeURIComponent(listingId)}/shop-demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantKey, productId, confirm: true }),
      })
      const j = (await r.json().catch(() => null)) as { ok?: boolean; alreadyInShop?: boolean; error?: string } | null
      setNote(r.ok && j?.ok ? (j.alreadyInShop ? t("chosenAlready") : t("chosenAdded")) : t("chooseFailed"))
      setConfirming(null)
      load()
    } finally {
      setBusy(false)
    }
  }

  if (failed) return null
  if (!data) return null
  const { demand, proposal } = data
  return (
    <section className="mb-6 space-y-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
      <h2 className="text-base font-semibold">{t("title")}</h2>
      {demand ? (
        <p className="text-sm">{t("signal", { count: demand.buyers, variant: demand.variantLabel, product: demand.productName })}</p>
      ) : (
        <p className="text-sm text-zinc-600">{t("noSignal")}</p>
      )}
      <p className="text-xs text-zinc-600">{t("why")}</p>
      {proposal.status === "found" ? (
        <ul className="space-y-2">
          {proposal.alternatives.map((a) => (
            <li key={a.productId} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{a.name}</p>
                <span className="text-xs text-zinc-500">{a.match === "identique" ? t("matchSame") : t("matchSimilar")}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-700">
                {t("altFacts", {
                  units: a.wantedVariantUnits ?? 0,
                  price: money(a.sellingPriceHtCents),
                  net: money(a.net.netCents),
                  originalNet: money(proposal.originalNet.netCents),
                })}
              </p>
              {a.differences.some((d) => d.field === "variant_low_stock") ? <p className="text-xs text-amber-700">{t("lowStock")}</p> : null}
              {a.differences.some((d) => d.field === "variants_missing") ? <p className="text-xs text-amber-700">{t("missingOptions")}</p> : null}
              <p className="text-xs text-zinc-500">{t("supplier", { supplier: a.supplierLabel })}</p>
              {a.inShop ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700">{t("inShop")}</p>
              ) : confirming === a.productId ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void choose(a.productId)} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                    {t("confirm")}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="rounded-lg border px-3 py-1.5 text-xs">
                    {t("cancel")}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(a.productId)} className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold">
                  {t("offer")}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600">{proposal.reason === "no_sellable_candidate" ? t("noneSellable") : t("noneReliable")}</p>
      )}
      {note ? <p className="text-xs font-medium">{note}</p> : null}
      <p className="text-xs text-zinc-500">{t("buyerChoice")}</p>
      {recovery && (recovery.alternativesChosen > 0 || recovery.proposalsShown > 0) ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
          <p className="font-semibold">{t("recovery.title")}</p>
          <p>{t("recovery.counts", { shown: recovery.proposalsShown, chosen: recovery.alternativesChosen, open: recovery.withoutSolution })}</p>
          <p>{t("recovery.orders", { orders: recovery.ordersAfterChoice, refunded: recovery.refundedOrCancelledAfterChoice, waiting: recovery.byWaitingBuyers })}</p>
          <p className="text-zinc-500">{t("recovery.caveat")}</p>
        </div>
      ) : null}
      <Link href="/dashboard/affiliate/catalog" className="inline-block text-xs underline">
        {t("backToCatalog")}
      </Link>
    </section>
  )
}
