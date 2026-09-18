"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { BentoCard, BentoPageHeading } from "@/components/affisell/bento-ui"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  SUPPLIER_CSV_CANONICAL_FIELDS,
  type SupplierCsvColumnMapping,
  type SupplierCsvFieldKey,
  type SupplierCsvRawRow,
} from "@/lib/supplier-csv-import"
import { cn } from "@/lib/utils"

type MappedPreviewRow = {
  index: number
  title: string
  description: string
  priceEur: number
  stock: number
  imageUrl: string
  categoryName: string
  shippingDays: number
  errors: string[]
}

type RowFailure = { index: number; error: string }

const ROW_ERROR_KEYS: Record<string, string> = {
  missing_title: "errorMissingTitle",
  invalid_price: "errorInvalidPrice",
  invalid_image_url: "errorInvalidImageUrl",
  missing_category: "errorMissingCategory",
  category_not_found: "errorCategoryNotFound",
}

export function SupplierOnboardingCsvWizard({
  kycReady,
  affiliateCount,
}: {
  kycReady: boolean
  affiliateCount: number
}) {
  const t = useTranslations("supplier.csvImport")

  const STEPS = [
    { id: 1, label: t("step1Label") },
    { id: 2, label: t("step2Label") },
    { id: 3, label: t("step3Label") },
    { id: 4, label: t("step4Label") },
  ] as const

  const FIELD_LABELS: Record<SupplierCsvFieldKey, string> = {
    title: t("fieldTitle"),
    description: t("fieldDescription"),
    price_eur: t("fieldPriceEur"),
    stock: t("fieldStock"),
    image_url: t("fieldImageUrl"),
    category: t("fieldCategory"),
    shipping_days: t("fieldShippingDays"),
  }

  function rowErrorLabel(code: string): string {
    const key = ROW_ERROR_KEYS[code]
    return key ? t(key) : code
  }

  const [step, setStep] = useState(1)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<SupplierCsvRawRow[]>([])
  const [mapping, setMapping] = useState<SupplierCsvColumnMapping>({})
  const [preview, setPreview] = useState<MappedPreviewRow[]>([])
  const [summary, setSummary] = useState<{ total: number; valid: number; invalid: number } | null>(
    null
  )
  const [uploading, setUploading] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState<{ created: number; affiliateCount: number } | null>(
    null
  )
  const [failures, setFailures] = useState<RowFailure[]>([])

  const mappingOptions = useMemo(() => ["", ...headers], [headers])

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/supplier/import-csv")
      if (!res.ok) return
      await res.json()
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  async function onUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      const res = await fetch("/api/supplier/import-csv", { method: "POST", body: form })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        headers?: string[]
        rows?: SupplierCsvRawRow[]
        suggestedMapping?: SupplierCsvColumnMapping
      }
      if (!res.ok) {
        toast.error(j.error ?? t("importFailedError"))
        return
      }
      setHeaders(j.headers ?? [])
      setRows(j.rows ?? [])
      setMapping(j.suggestedMapping ?? {})
      setStep(2)
      toast.success(t("rowsLoadedToast", { count: j.rows?.length ?? 0 }))
    } finally {
      setUploading(false)
    }
  }

  async function runPreview() {
    setPreviewing(true)
    try {
      const res = await fetch("/api/supplier/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", mapping, rows }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        preview?: MappedPreviewRow[]
        summary?: { total: number; valid: number; invalid: number }
      }
      if (!res.ok) {
        toast.error(j.error ?? t("previewFailedError"))
        return
      }
      setPreview(j.preview ?? [])
      setSummary(j.summary ?? null)
      setStep(3)
    } finally {
      setPreviewing(false)
    }
  }

  async function publish() {
    setPublishing(true)
    try {
      const res = await fetch("/api/supplier/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", mapping, rows }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        created?: number
        affiliateCount?: number
        failures?: RowFailure[]
      }
      if (!res.ok) {
        toast.error(j.error ?? t("publishFailedError"))
        return
      }
      const rowFailures = j.failures ?? []
      setFailures(rowFailures)
      setPublished({
        created: j.created ?? 0,
        affiliateCount: j.affiliateCount ?? affiliateCount,
      })
      setStep(4)
      if (rowFailures.length > 0) {
        toast.warning(t("failuresHeading", { count: rowFailures.length }))
      } else {
        toast.success(t("publishedToast", { count: j.created ?? 0 }))
      }
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <BentoPageHeading
        eyebrow={t("onboardingEyebrow")}
        title={t("pageTitle")}
        description={
          kycReady
            ? t("kycReadyDescription", { count: affiliateCount.toLocaleString() })
            : t("kycPendingDescription")
        }
      />

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              step === s.id
                ? "bg-emerald-600 text-white"
                : step > s.id
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
            )}
          >
            {s.id}. {s.label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <BentoCard className="space-y-6 p-6">
          <div className="flex items-center gap-3 text-emerald-600">
            <FileSpreadsheet className="size-6" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("step1Heading")}</h2>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("templateColumnsHint")}</p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/supplier/import-csv?download=template"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <Download className="size-4" />
              {t("downloadTemplateCta")}
            </a>
            <label className={cn(buttonVariants(), "cursor-pointer gap-2")}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {t("uploadCsvCta")}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onUpload(f)
                }}
              />
            </label>
          </div>
        </BentoCard>
      )}

      {step === 2 && (
        <BentoCard className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("step2Heading")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {SUPPLIER_CSV_CANONICAL_FIELDS.map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`map-${field}`}>{FIELD_LABELS[field]}</Label>
                <select
                  id={`map-${field}`}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                  }
                >
                  {mappingOptions.map((h) => (
                    <option key={h || "none"} value={h}>
                      {h || "—"}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => void runPreview()} disabled={previewing} className="gap-2">
            {previewing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {t("previewCta")}
          </Button>
        </BentoCard>
      )}

      {step === 3 && (
        <BentoCard className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {t("step3Heading", { valid: summary?.valid ?? 0, total: summary?.total ?? 0 })}
          </h2>
          <ul className="space-y-4">
            {preview.map((row) => (
              <li
                key={row.index}
                className="flex gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
              >
                {row.imageUrl.startsWith("http") ? (
                  <Image
                    src={row.imageUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="size-16 rounded-lg object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="size-16 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{row.title || "—"}</p>
                  <p className="text-sm text-zinc-500">
                    {row.priceEur.toFixed(2)} € · stock {row.stock} · {row.categoryName}
                  </p>
                  {row.errors.length > 0 ? (
                    <p className="text-xs text-red-600">
                      {row.errors.map((e) => rowErrorLabel(e)).join(", ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            onClick={() => void publish()}
            disabled={publishing || (summary?.valid ?? 0) === 0}
            className="gap-2"
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {t("publishCta", { count: affiliateCount.toLocaleString() })}
          </Button>
          {(summary?.valid ?? 0) === 0 ? (
            <p className="text-sm text-red-600">{t("noValidRowsError")}</p>
          ) : null}
        </BentoCard>
      )}

      {step === 4 && published && (
        <BentoCard className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{t("publishedHeading")}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("publishedSummary", {
              created: published.created,
              count: published.affiliateCount.toLocaleString(),
            })}
          </p>

          {failures.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="font-semibold">{t("failuresHeading", { count: failures.length })}</p>
              </div>
              <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">{t("failuresHint")}</p>
              <ul className="mt-3 space-y-1.5">
                {failures.map((f) => (
                  <li key={f.index} className="text-sm text-amber-900 dark:text-amber-100">
                    <span className="font-medium">{t("rowLabel", { index: f.index + 1 })}</span> —{" "}
                    {f.error
                      .split(",")
                      .map((code) => rowErrorLabel(code))
                      .join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Link href="/dashboard/supplier/products" className={buttonVariants()}>
            {t("viewProductsCta")}
          </Link>
        </BentoCard>
      )}
    </div>
  )
}
