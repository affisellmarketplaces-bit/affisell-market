"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  AlertTriangle,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { SupplierCategoryPicker, type BrowsePayload } from "@/components/supplier/supplier-category-picker"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { pathFromLeafId, type CategoryPathSegment, type RecentCategoryEntry } from "@/lib/category-browse-shared"
import type { ParsedBulkProductRow } from "@/lib/supplier-bulk-excel"
import { errorsToCsv } from "@/lib/supplier-bulk-excel"
import { cn } from "@/lib/utils"

type ParseRow = {
  rowNumber: number
  errors: string[]
  warnings: string[]
  data: ParsedBulkProductRow | null
}

const COMMIT_CHUNK = 8

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SupplierBulkExcelImport() {
  const t = useTranslations("supplier.bulkExcelImport")

  const [browse, setBrowse] = useState<BrowsePayload | null>(null)
  const [recentCategories, setRecentCategories] = useState<RecentCategoryEntry[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(true)
  const [categoryId, setCategoryId] = useState("")
  const [categoryPath, setCategoryPath] = useState<CategoryPathSegment[]>([])

  const [parseRows, setParseRows] = useState<ParseRow[] | null>(null)
  const [parseSummary, setParseSummary] = useState<{ total: number; valid: number; invalid: number } | null>(
    null
  )
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [skipInvalid, setSkipInvalid] = useState(true)
  const [lastCommit, setLastCommit] = useState<{ created: number; failed: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/categories/browse?lite=1").then((r) => r.json()),
      fetch("/api/supplier/recent-categories", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.resolve({ recent: [] })
      ),
    ])
      .then(([b, rec]) => {
        if (cancelled) return
        if (b && typeof b === "object" && Array.isArray((b as BrowsePayload).rootIds)) {
          setBrowse(b as BrowsePayload)
        } else {
          setBrowse(null)
        }
        setRecentCategories(Array.isArray(rec?.recent) ? rec.recent : [])
      })
      .catch(() => {
        if (!cancelled) toast.error(t("couldNotLoadCategoriesError"))
      })
      .finally(() => {
        if (!cancelled) setLoadingBrowse(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!browse || !categoryId) return
    const p = pathFromLeafId(categoryId, browse.nodes)
    if (p?.length) {
      queueMicrotask(() => setCategoryPath(p))
    }
  }, [browse, categoryId])

  const downloadTemplate = useCallback(async () => {
    if (!categoryId.trim()) {
      toast.error(t("selectCategoryFirstError"))
      return
    }
    const url = `/api/supplier/bulk-import/template?categoryId=${encodeURIComponent(categoryId)}`
    try {
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? t("downloadFailedError"))
      }
      const blob = await res.blob()
      const u = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = u
      a.download = "affisell-bulk-template.xlsx"
      a.click()
      URL.revokeObjectURL(u)
      toast.success(t("templateDownloadedToast"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("downloadFailedError"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!categoryId.trim()) {
      toast.error(t("selectMatchingCategoryError"))
      return
    }
    const fd = new FormData()
    fd.set("categoryId", categoryId)
    fd.set("file", file)
    setParsing(true)
    setParseRows(null)
    setParseSummary(null)
    setLastCommit(null)
    try {
      const res = await fetch("/api/supplier/bulk-import/parse", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const j = (await res.json()) as {
        error?: string
        rows?: ParseRow[]
        summary?: { total: number; valid: number; invalid: number }
      }
      if (!res.ok) {
        throw new Error(j.error ?? t("parseFailedError"))
      }
      setParseRows(j.rows ?? [])
      setParseSummary(j.summary ?? null)
      toast.success(t("parsedRowsToast", { count: j.summary?.total ?? 0 }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("parseFailedError"))
    } finally {
      setParsing(false)
    }
  }

  const validDataRows = (parseRows ?? []).filter((r) => r.data && r.errors.length === 0).map((r) => r.data!)

  const downloadErrorReport = () => {
    if (!parseRows?.length) return
    const invalid = parseRows.filter((r) => r.errors.length > 0)
    const csv = errorsToCsv(invalid.map((r) => ({ rowNumber: r.rowNumber, errors: r.errors })))
    downloadTextFile("bulk-import-errors.csv", csv, "text/csv;charset=utf-8")
  }

  const commit = async () => {
    if (!categoryId.trim() || validDataRows.length === 0) {
      toast.error(t("nothingValidError"))
      return
    }
    setCommitting(true)
    setProgress(0)
    setLastCommit(null)
    let created = 0
    let failed = 0
    try {
      for (let i = 0; i < validDataRows.length; i += COMMIT_CHUNK) {
        const chunk = validDataRows.slice(i, i + COMMIT_CHUNK)
        const res = await fetch("/api/supplier/bulk-import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            categoryId,
            rows: chunk,
            skipInvalid,
          }),
        })
        const j = (await res.json()) as {
          error?: string
          created?: number
          failed?: number
          products?: Array<{ id: string; name: string }>
          failures?: Array<{ index: number; error: string }>
        }
        if (!res.ok) {
          throw new Error(j.error ?? t("commitFailedError"))
        }
        created += j.created ?? 0
        failed += j.failed ?? 0
        setProgress(
          Math.round((Math.min(i + chunk.length, validDataRows.length) / validDataRows.length) * 100)
        )
      }
      setProgress(100)
      setLastCommit({ created, failed })
      toast.success(t("createdCountToast", { count: created }) + (failed > 0 ? t("skippedSuffix", { count: failed }) : ""))
      setParseRows(null)
      setParseSummary(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("commitFailedError"))
    } finally {
      setCommitting(false)
      setProgress(0)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/supplier"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("dashboardLink")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("pageTitle")}
        </h1>
      </div>

      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {t("pageDescription")}
      </p>

      <div className="space-y-6">
        <Card className="border-zinc-200 p-6 dark:border-zinc-700">
          <div className="flex flex-wrap items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-6 w-6 shrink-0 text-violet-600" aria-hidden />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{t("step1Heading")}</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("step1Description")}</p>
              </div>
              <div>
                <Label className="text-zinc-800 dark:text-zinc-200">{t("categoryLabel")}</Label>
                <div className="mt-1.5">
                  <SupplierCategoryPicker
                    browse={browse}
                    recent={recentCategories}
                    value={categoryId}
                    onChange={(leafId, path) => {
                      setCategoryId(leafId)
                      setCategoryPath(path)
                      setParseRows(null)
                      setParseSummary(null)
                    }}
                    suggestions={[]}
                    loading={loadingBrowse}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-zinc-200 p-6 dark:border-zinc-700">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{t("step2Heading")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("step2Description")}</p>
          <Button
            type="button"
            className="mt-4 gap-2"
            disabled={!categoryId.trim()}
            onClick={() => void downloadTemplate()}
          >
            <Download className="h-4 w-4" aria-hidden />
            {t("downloadXlsxCta")}
          </Button>
        </Card>

        <Card className="border-zinc-200 p-6 dark:border-zinc-700">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{t("step3Heading")}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("step3Description")}</p>
          <div className="mt-4">
            <Label htmlFor="bulk-xlsx" className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200">
                {parsing ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Upload className="h-5 w-5 text-violet-600" aria-hidden />
                )}
                {parsing ? t("readingWorkbook") : t("chooseXlsxCta")}
              </span>
            </Label>
            <input
              id="bulk-xlsx"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={parsing || !categoryId.trim()}
              onChange={(ev) => void onFile(ev)}
            />
          </div>

          {parseSummary ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                {t("validCountLabel", { count: parseSummary.valid })}
              </span>
              {parseSummary.invalid > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {t("invalidCountLabel", { count: parseSummary.invalid })}
                </span>
              ) : null}
            </div>
          ) : null}

          {parseRows && parseRows.some((r) => r.errors.length > 0) ? (
            <div className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={downloadErrorReport}>
                {t("downloadErrorReportCta")}
              </Button>
            </div>
          ) : null}

          {parseRows && parseRows.length > 0 ? (
            <div className="mt-6 max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-2 py-2 font-medium">{t("colIndex")}</th>
                    <th className="px-2 py-2 font-medium">{t("colName")}</th>
                    <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {parseRows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={cn(
                        "border-t border-zinc-100 dark:border-zinc-800",
                        r.errors.length ? "bg-red-50/80 dark:bg-red-950/20" : ""
                      )}
                    >
                      <td className="px-2 py-1.5 text-zinc-500">{r.rowNumber}</td>
                      <td className="max-w-[240px] truncate px-2 py-1.5">{r.data?.name ?? "—"}</td>
                      <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400">
                        {r.errors.length ? r.errors.join("; ") : t("rowOkLabel")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <Card className="border-zinc-200 p-6 dark:border-zinc-700">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{t("step4Heading")}</h2>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={skipInvalid}
              onChange={(e) => setSkipInvalid(e.target.checked)}
              className="rounded border-zinc-300"
            />
            {t("skipInvalidLabel")}
          </label>
          {committing ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t("publishingProgress", { progress })}</p>
            </div>
          ) : null}
          {lastCommit ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
              {t("lastRunSummary", { created: lastCommit.created, failed: lastCommit.failed })}
            </p>
          ) : null}
          <Button
            type="button"
            className="mt-4"
            disabled={committing || validDataRows.length === 0}
            onClick={() => void commit()}
          >
            {committing ? t("publishingLabel") : t("publishCta", { count: validDataRows.length })}
          </Button>
          <p className="mt-3 text-xs text-zinc-500">{t("batchHint", { size: COMMIT_CHUNK })}</p>
        </Card>

        {categoryPath.length ? (
          <p className="text-xs text-zinc-500">
            {t("selectedCategoryLabel", { path: categoryPath.map((s) => s.name).join(" → ") })} ·{" "}
            <code>{categoryId}</code>
          </p>
        ) : null}
      </div>
    </div>
  )
}
