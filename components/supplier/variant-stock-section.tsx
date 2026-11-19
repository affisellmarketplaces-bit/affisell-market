"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { VariantProductVerdict } from "@/lib/supplier-catalog-health/variant-stockout"

/**
 * Supplier: per-variant stock — variants at 0 while others still sell (partial stock-out), variants about to run out,
 * and products whose variants Affisell can not track. Observed sales are shown apart from calculations; nothing is
 * presented as a lost sale. The fix is the variant's quantity in the product sheet (normal catalogue path).
 */
export function VariantStockSection() {
  const t = useTranslations("catalogHealth.variantStock")
  const tRisk = useTranslations("catalogHealth.stockout.risk")
  const [data, setData] = useState<{ items: VariantProductVerdict[]; truncated: boolean } | null>(null)

  useEffect(() => {
    void fetch("/api/supplier/variant-stock", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && Array.isArray(d.items) ? d : { items: [], truncated: false }))
      .catch(() => setData({ items: [], truncated: false }))
  }, [])

  if (!data) return null
  return (
    <section id="variant-stock" className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>
      {data.truncated ? <p className="text-xs text-amber-700">{t("truncated")}</p> : null}
      {data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((p) => (
            <li key={p.productId} className="space-y-2 rounded-xl border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{p.productName}</p>
                <span className="text-xs text-zinc-600">{t("shops", { count: p.liveListings })}</span>
              </div>
              {p.mode === "variants_not_tracked" ? (
                <p className="text-xs text-amber-700">{t("notTracked")}</p>
              ) : (
                <>
                  {p.partialStockout ? <p className="text-xs font-semibold text-rose-700">{t("partial", { count: p.blockedVariants })}</p> : null}
                  <table className="w-full text-left text-xs">
                    <thead className="text-zinc-500">
                      <tr>
                        <th className="py-1 pr-2">{t("col.variant")}</th>
                        <th className="py-1 pr-2">{t("col.declared")}</th>
                        <th className="py-1 pr-2">{t("col.sold")}</th>
                        <th className="py-1 pr-2">{t("col.cover")}</th>
                        <th className="py-1">{t("col.state")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.variants.map((v, i) => (
                        <tr key={`${v.label}:${i}`} className="border-t border-zinc-100 align-top">
                          <td className="py-1 pr-2 font-medium">{v.label}</td>
                          <td className="py-1 pr-2">{v.declaredUnits === null ? t("unknown") : v.declaredUnits}</td>
                          <td className="py-1 pr-2">
                            {v.ambiguous
                              ? "—"
                              : v.units90d > 0
                                ? t("soldValue", { units: v.units90d, pct: v.salesSharePct ?? 0 })
                                : t("noSale")}
                            {v.sellingResellers !== null ? <div className="text-zinc-500">{t("resellers", { count: v.sellingResellers })}</div> : null}
                            {v.sellingResellersBelowThreshold ? <div className="text-zinc-500">{t("resellersFew")}</div> : null}
                          </td>
                          <td className="py-1 pr-2">
                            {v.forecast && v.available && v.forecast.calculation.coverDays !== null
                              ? t("coverValue", { days: v.forecast.calculation.coverDays, low: v.forecast.calculation.coverDaysLow ?? 0 })
                              : "—"}
                          </td>
                          <td className="py-1">
                            {v.ambiguous
                              ? t("ambiguous")
                              : v.declaredUnits === null
                                ? t("notEvaluable")
                                : !v.available
                                  ? t("soldOut")
                                  : v.forecast
                                    ? tRisk(v.forecast.risk)
                                    : t("notEvaluable")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {p.unattributedUnits90d > 0 ? <p className="text-xs text-zinc-500">{t("unattributed", { units: p.unattributedUnits90d })}</p> : null}
                  <p className="text-xs text-zinc-500">{t("confirmationScope")}</p>
                </>
              )}
              <Link href={`/dashboard/supplier/products/${encodeURIComponent(p.productId)}/edit`} className="text-xs font-medium text-violet-700 underline">
                {p.mode === "variants_not_tracked" ? t("fixTrack") : t("fixRows")}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-zinc-500">{t("note")}</p>
    </section>
  )
}
