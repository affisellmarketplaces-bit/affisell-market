"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { QualityFeature, QualityRecommendation } from "@/lib/listing-quality/quality-effect"

type Data = {
  windowDays: number
  evidence: Array<{ feature: QualityFeature; adjustedRatio: number | null; lo: number | null; hi: number | null }>
  recommendations: QualityRecommendation[]
}

const ratio = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/**
 * Supplier: sheet elements that go with more sales per day in a shop ON AFFISELL (marketplace aggregate, same category,
 * price band and age), and which of ITS sheets lack them. An association, never a promise; nothing is changed.
 * Renders nothing until an association is established.
 */
export function ListingQualitySection() {
  const t = useTranslations("catalogHealth.listingQuality")
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    void fetch("/api/supplier/listing-quality", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => setData(d && Array.isArray(d.recommendations) ? d : null))
      .catch(() => setData(null))
  }, [])
  if (!data || data.recommendations.length === 0) return null
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800" id="listing-quality">
      <h2 className="text-base font-semibold">{t("title")}</h2>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("intro", { days: data.windowDays })}</p>
      <ul className="space-y-2">
        {data.recommendations.map((r) => (
          <li key={`${r.productId}:${r.feature}`} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <p className="font-medium">{r.productName}</p>
            <p className="mt-1">{t(`feature.${r.feature}`)}</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("evidence", { ratio: ratio(r.adjustedRatio), lo: ratio(r.lo) })}</p>
            <Link className="mt-2 inline-block text-xs font-semibold underline" href={`/dashboard/supplier/products/${encodeURIComponent(r.productId)}/edit`}>
              {t("cta")}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-500">{t("caveat")}</p>
    </section>
  )
}
