"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react"
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

const STEPS = [
  { id: 1, label: "Upload CSV" },
  { id: 2, label: "Mapper colonnes" },
  { id: 3, label: "Aperçu" },
  { id: 4, label: "Publier" },
] as const

const FIELD_LABELS: Record<SupplierCsvFieldKey, string> = {
  title: "Titre",
  description: "Description",
  price_eur: "Prix EUR",
  stock: "Stock",
  image_url: "Image URL",
  category: "Catégorie",
  shipping_days: "Jours livraison",
}

export function SupplierOnboardingCsvWizard({
  kycReady,
  affiliateCount,
}: {
  kycReady: boolean
  affiliateCount: number
}) {
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
        toast.error(j.error ?? "Import impossible")
        return
      }
      setHeaders(j.headers ?? [])
      setRows(j.rows ?? [])
      setMapping(j.suggestedMapping ?? {})
      setStep(2)
      toast.success(`${j.rows?.length ?? 0} lignes chargées`)
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
        toast.error(j.error ?? "Aperçu impossible")
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
      }
      if (!res.ok) {
        toast.error(j.error ?? "Publication impossible")
        return
      }
      setPublished({
        created: j.created ?? 0,
        affiliateCount: j.affiliateCount ?? affiliateCount,
      })
      setStep(4)
      toast.success(`${j.created ?? 0} produit(s) publié(s)`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <BentoPageHeading
        eyebrow="Onboarding fournisseur"
        title="Importe ton catalogue"
        description={
          kycReady
            ? `KYC validé — publie pour ${affiliateCount.toLocaleString("fr-FR")}+ affiliés.`
            : "Connecte Stripe Connect pour encaisser, puis importe ton CSV."
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
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Étape 1 — CSV</h2>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Template : title, description, price_eur, stock, image_url, category, shipping_days
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/supplier/import-csv?download=template"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <Download className="size-4" />
              Télécharger le template
            </a>
            <label className={cn(buttonVariants(), "cursor-pointer gap-2")}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Charger mon CSV
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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Étape 2 — Mapper les colonnes
          </h2>
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
            Aperçu 5 produits
          </Button>
        </BentoCard>
      )}

      {step === 3 && (
        <BentoCard className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Étape 3 — Aperçu ({summary?.valid ?? 0}/{summary?.total ?? 0} valides)
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
                    <p className="text-xs text-red-600">{row.errors.join(", ")}</p>
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
            Publier — live pour {affiliateCount.toLocaleString("fr-FR")}+ affiliés
          </Button>
        </BentoCard>
      )}

      {step === 4 && published && (
        <BentoCard className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Catalogue publié</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {published.created} produit(s) visible(s) par {published.affiliateCount.toLocaleString("fr-FR")}+
            affiliés.
          </p>
          <Link href="/dashboard/supplier/products" className={buttonVariants()}>
            Voir mes produits
          </Link>
        </BentoCard>
      )}
    </div>
  )
}
