"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import useSWR from "swr"

import {
  formatProductRequestCountries,
  PRODUCT_REQUEST_CATEGORIES,
  productRequestProvenanceDisplay,
  type ProductRequestDto,
} from "@/lib/product-request-types"
import { formatProductRequestRelativeTime } from "@/lib/product-request-i18n"

type FilterTab = "open" | "mine" | "fulfilled"

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`fetch_${res.status}`)
  return res.json() as Promise<{ requests: ProductRequestDto[]; count: number }>
}

function buildUrl(tab: FilterTab, category: string) {
  const params = new URLSearchParams({ limit: "100" })
  if (category) params.set("category", category)
  if (tab === "mine") {
    params.set("filter", "mine")
    params.set("status", "all")
  } else if (tab === "fulfilled") {
    params.set("status", "fulfilled")
  } else {
    params.set("status", "open")
  }
  return `/api/requests?${params.toString()}`
}

export function SupplierRequestsClient() {
  const locale = useLocale()
  const t = useTranslations("productRequests")
  const tList = useTranslations("productRequests.supplier.list")
  const tCat = useTranslations("productRequests.categories")
  const tProv = useTranslations("productRequests.provenance")
  const [category, setCategory] = useState("")
  const [tab, setTab] = useState<FilterTab>("open")

  const url = buildUrl(tab, category)
  const { data, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
  })

  const rows = data?.requests ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-zinc-900">{tList("title")}</h1>
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          {tList("categoryFilter")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-medium"
          >
            <option value="">{tList("categoryAll")}</option>
            {PRODUCT_REQUEST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {tCat(c.id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "open", label: tList("tabOpen") },
            { id: "mine", label: tList("tabMine") },
            { id: "fulfilled", label: tList("tabFulfilled") },
          ] as const
        ).map((tTab) => (
          <button
            key={tTab.id}
            type="button"
            onClick={() => setTab(tTab.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tab === tTab.id
                ? "bg-orange-600 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {tTab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">{tList("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-600">
          {tList("empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/supplier/requests/${r.id}`}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                  r.slaCompatible === false
                    ? "border-zinc-200 bg-zinc-100/80 opacity-60 hover:opacity-80"
                    : "border-zinc-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"
                }`}
              >
                <div>
                  <p className="font-semibold text-zinc-900">{r.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {formatProductRequestCountries(r.countries)} · {tCat(r.category)} ·{" "}
                    {productRequestProvenanceDisplay(r, (key) => tProv(key))}
                    {r.complianceRequirements.length > 0
                      ? ` · ${t("common.complianceCount", { count: r.complianceRequirements.length })}`
                      : ""}{" "}
                    · {r.quantity} {t("common.pieces")} ·{" "}
                    {formatProductRequestRelativeTime(r.createdAt, locale)}
                    {r.deliverySLA != null
                      ? ` · ${tList("slaMax", { days: r.deliverySLA })}`
                      : ""}
                    {r.myQuoteStatus
                      ? ` · ${tList("myQuote", { status: r.myQuoteStatus })}`
                      : ""}
                    {r.slaCompatible === false ? ` · ⚠️ ${t("common.slaWarning")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.quotesCount > 0 ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      {t("common.quotesCount", { count: r.quotesCount })}
                    </span>
                  ) : null}
                  <span className="text-xs font-semibold text-violet-700">
                    {r.myQuoteStatus ? tList("viewQuote") : tList("quoteCta")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
