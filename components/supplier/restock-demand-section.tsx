"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { RestockDemandProduct } from "@/lib/restock-watch/restock-demand"

/**
 * Supplier: how many distinct buyers asked to be told when a sold-out variant of its products comes back (from 3).
 * An indication of explicit demand, not a sales forecast. The fix is the variant's quantity in the product sheet.
 * Renders nothing when there is nothing to say (no request reaches the threshold).
 */
export function RestockDemandSection() {
  const t = useTranslations("catalogHealth.restockDemand")
  const [data, setData] = useState<{ minBuyers: number; products: RestockDemandProduct[]; truncated: boolean } | null>(null)

  useEffect(() => {
    void fetch("/api/supplier/restock-demand", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d && Array.isArray(d.products) ? d : null))
      .catch(() => setData(null))
  }, [])

  if (!data || data.products.length === 0) return null
  return (
    <section id="restock-demand" className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-zinc-600">{t("subtitle", { min: data.minBuyers })}</p>
      </header>
      {data.truncated ? <p className="text-xs text-amber-700">{t("truncated")}</p> : null}
      <ul className="space-y-2">
        {data.products.map((p) => (
          <li key={p.productId} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{p.productName}</p>
              <Link className="text-xs font-semibold underline" href={`/dashboard/supplier/products/${encodeURIComponent(p.productId)}/edit`}>
                {t("fix")}
              </Link>
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-zinc-700">
              {p.variants.map((v) => (
                <li key={v.variantKey}>
                  <span className="font-medium">{v.variantLabel}</span> — {t("buyers", { count: v.buyers })}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">{t("disclaimer")}</p>
    </section>
  )
}
