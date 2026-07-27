"use client"

import Link from "next/link"
import useSWR from "swr"
import { useLocale, useTranslations } from "next-intl"

import { formatProductRequestRelativeTime } from "@/lib/product-request-i18n"
import {
  formatProductRequestCountries,
  type ProductRequestDto,
} from "@/lib/product-request-types"

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`fetch_${res.status}`)
  return res.json() as Promise<{ requests: ProductRequestDto[]; count: number }>
}

/** Additive orange banner on supplier dashboard. */
export function SupplierProductRequestsTeaser() {
  const locale = useLocale()
  const t = useTranslations("productRequests")
  const tTeaser = useTranslations("productRequests.supplier.teaser")
  const { data } = useSWR("/api/requests?status=open&limit=5", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const count = data?.count ?? 0
  const rows = data?.requests ?? []

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-orange-950">
          {tTeaser("title", { count })}
        </h3>
        <Link
          href="/dashboard/supplier/requests"
          className="text-xs font-semibold text-orange-800 hover:underline"
        >
          {tTeaser("viewAll")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-orange-900/70">{tTeaser("empty")}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/supplier/requests/${r.id}`}
                className="text-xs font-medium text-orange-950 hover:underline"
              >
                {formatProductRequestCountries(r.countries)} — {r.title} — {r.quantity}
                {t("common.pieces")} — {formatProductRequestRelativeTime(r.createdAt, locale)}
                {r.quotesCount > 0
                  ? ` · ${t("common.quotesCount", { count: r.quotesCount })}`
                  : ""}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
