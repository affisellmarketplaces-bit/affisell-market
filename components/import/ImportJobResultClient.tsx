"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { ArbitrageBadge } from "@/components/import/ArbitrageBadge"
import { formatEnrichEuro } from "@/lib/import/smart-import-enricher"
import type { RadarImportJobProduct } from "@/lib/radar/radar-import-types"
import { scanWorldArbitrage } from "@/lib/radar/world-arbitrage-scanner"

type Props = {
  jobId: string
  country: string
  status: string
  destination: string
  products: RadarImportJobProduct[]
}

export function ImportJobResultClient({
  jobId,
  country,
  status,
  destination,
  products,
}: Props) {
  const t = useTranslations("importPage")
  const [listing, setListing] = useState(false)

  const rows = useMemo(() => {
    return products.map((p) => {
      const cost = p.costPrice ?? 4.2
      const sale = p.salePrice ?? p.price ?? 14.95
      const margin = Math.round((sale - cost) * 100) / 100
      const multiplier = cost > 0 ? Math.round((sale / cost) * 100) / 100 : 3.2
      const scan = scanWorldArbitrage({
        title: p.title,
        supplierPrice: cost,
        category: p.category,
      })
      return { p, cost, sale, margin, multiplier, score: scan.score, scan }
    })
  }, [products])

  const totals = useMemo(() => {
    const cost = rows.reduce((s, r) => s + r.cost, 0)
    const sale = rows.reduce((s, r) => s + r.sale, 0)
    const margin = Math.round((sale - cost) * 100) / 100
    return { cost: Math.round(cost * 100) / 100, sale: Math.round(sale * 100) / 100, margin }
  }, [rows])

  function exportCsv() {
    const header = ["title", "cost", "sale", "margin", "multiplier", "score", "status"]
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          JSON.stringify(r.p.title),
          r.cost,
          r.sale,
          r.margin,
          r.multiplier,
          r.score,
          r.p.importedListingId ? "draft" : r.p.importError ?? "pending",
        ].join(",")
      ),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `affisell-import-${jobId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t("jobToastCsv"))
  }

  async function listAll() {
    setListing(true)
    try {
      const ids = rows
        .map((r) => r.p.importedListingId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
      if (ids.length === 0) {
        toast.error(t("jobToastNoDraft"))
        return
      }
      let ok = 0
      for (const id of ids) {
        const res = await fetch(`/api/affiliate/listings/${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isListed: true }),
        })
        if (res.ok) ok += 1
      }
      toast.success(t("jobToastListed", { ok, total: ids.length }))
    } catch {
      toast.error(t("jobToastListFailed"))
    } finally {
      setListing(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-5 text-white shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
          World Arbitrage · Import Job
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
          {t("jobHeading", {
            id: jobId.slice(0, 10),
            count: rows.length,
            margin: formatEnrichEuro(totals.margin),
          })}
        </h1>
        <p className="mt-2 text-xs text-zinc-400">
          {t("jobMeta", { country, destination, status })}
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">{t("colImage")}</th>
              <th className="px-3 py-2">{t("colTitle")}</th>
              <th className="px-3 py-2">{t("colCost")}</th>
              <th className="px-3 py-2">{t("colSale")}</th>
              <th className="px-3 py-2">{t("colMargin")}</th>
              <th className="px-3 py-2">{t("colMultiplier")}</th>
              <th className="px-3 py-2">{t("colScore")}</th>
              <th className="px-3 py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.winnerId} className="border-b border-zinc-100 align-middle">
                <td className="px-3 py-2">
                  {r.p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.p.imageUrl}
                      alt=""
                      className="size-10 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex size-10 items-center justify-center rounded-lg bg-zinc-100">
                      📦
                    </span>
                  )}
                </td>
                <td className="max-w-xs px-3 py-2">
                  <p className="line-clamp-2 font-medium text-zinc-900">{r.p.title}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {t("jobBest", {
                      country: r.scan.bestOpportunity.country,
                      margin: formatEnrichEuro(r.scan.bestOpportunity.margin),
                    })}
                  </p>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatEnrichEuro(r.cost)}€</td>
                <td className="px-3 py-2 tabular-nums font-semibold text-zinc-900">
                  {formatEnrichEuro(r.sale)}€
                </td>
                <td className="px-3 py-2">
                  <ArbitrageBadge
                    costPrice={r.cost}
                    salePrice={r.sale}
                    margin={r.margin}
                    multiplier={r.multiplier}
                    score={r.score}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">x{r.multiplier.toFixed(1)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.score}/100</td>
                <td className="px-3 py-2 text-xs">
                  {r.p.importedListingId ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                      {t("jobStatusDraft")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
                      {r.p.importError ?? t("jobStatusOk")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4">
        <p className="text-sm font-semibold text-zinc-900">
          {t("jobTotals", {
            cost: formatEnrichEuro(totals.cost),
            sale: formatEnrichEuro(totals.sale),
            margin: formatEnrichEuro(totals.margin),
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            {t("jobExportCsv")}
          </button>
          <button
            type="button"
            disabled={listing || destination !== "affisell_catalog"}
            onClick={() => void listAll()}
            className="rounded-xl bg-[#6D28D9] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-50"
          >
            {listing ? t("jobListing") : t("jobListAll")}
          </button>
          <Link
            href="/dashboard/affiliate/catalog?filter=draft"
            className="rounded-xl px-4 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50"
          >
            {t("jobCatalogDraft")}
          </Link>
        </div>
      </footer>
    </div>
  )
}
