"use client"

import { useCallback, useMemo, useState } from "react"
import { Bot, Loader2, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import { detectMarketplaceFromUrl, SUPPORTED_MARKETPLACE_LABELS } from "@/lib/import-marketplace"
import {
  buildUrlImportFormPatch,
  GENERIC_BRAND_LABEL,
  type UrlImportFormPatch,
} from "@/lib/url-import-apply"
import { cn } from "@/lib/utils"

type Props = {
  categoryAttrs: CategoryAttrRow[]
  commissionPct: string
  onApply: (payload: UrlImportFormPatch) => void
}

type AgentCategory = {
  leafId: string | null
  breadcrumb: string
  confidence: number
  reason: string
}

const STEP_LABELS: Record<string, string> = {
  detect: "Détection marketplace",
  fetch: "Extraction produit",
  enrich: "Enrichissement IA",
  categorize: "Catégorie Affisell",
  done: "Prêt pour relecture",
}

export function SupplierAiImportAgent({ categoryAttrs, commissionPct, onApply }: Props) {
  const [url, setUrl] = useState("")
  const [markup, setMarkup] = useState("2.5")
  const [loading, setLoading] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    title: string
    image: string
    price: number
    marketplace: string
    method: string
    aiEnriched: boolean
    category: AgentCategory | null
    warnings: string[]
  } | null>(null)
  const [lastProduct, setLastProduct] = useState<Record<string, unknown> | null>(null)
  const [lastCategory, setLastCategory] = useState<AgentCategory | null>(null)

  const detected = useMemo(() => {
    const u = url.trim()
    if (!u || !/^https?:\/\//i.test(u)) return null
    return detectMarketplaceFromUrl(u)
  }, [url])

  const runAgent = useCallback(async () => {
    const u = url.trim()
    if (!u) {
      toast.error("Collez le lien produit.")
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      toast.error("L’URL doit commencer par http:// ou https://")
      return
    }

    setLoading(true)
    setPreview(null)
    setLastProduct(null)
    setLastCategory(null)
    setActiveStep("detect")

    try {
      const mkNum = Number(markup.replace(",", "."))
      const mk = Number.isFinite(mkNum) && mkNum > 0 ? mkNum : 2.5

      setActiveStep("fetch")
      const res = await fetch("/api/supplier/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: u,
          options: { markup: mk, aiRewrite: true },
        }),
      })

      const data = (await res.json()) as {
        error?: string
        product?: Record<string, unknown>
        marketplace?: { label?: string }
        method?: string
        warnings?: string[]
        aiEnriched?: boolean
        category?: AgentCategory | null
        steps?: string[]
      }

      if (!res.ok) throw new Error(data.error ?? "Import agent impossible")

      const p = data.product
      if (!p || typeof p !== "object") throw new Error("Aucune donnée produit")

      const title = typeof p.title === "string" ? p.title.trim() : ""
      if (!title) throw new Error("Titre introuvable sur cette page.")

      setActiveStep("done")
      setLastProduct(p)
      setLastCategory(data.category ?? null)

      const images = Array.isArray(p.images)
        ? p.images.filter((x): x is string => typeof x === "string")
        : []

      setPreview({
        title,
        image: images[0] ?? "",
        price: typeof p.suggested_price === "number" ? p.suggested_price : Number(p.price) || 0,
        marketplace: data.marketplace?.label ?? detected?.label ?? "—",
        method: String(data.method ?? ""),
        aiEnriched: Boolean(data.aiEnriched),
        category: data.category ?? null,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
      })

      if (data.warnings?.length) {
        toast.warning(data.warnings[0])
      }
      toast.success("Analyse terminée — vérifiez puis remplissez la fiche.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import agent impossible")
      setActiveStep(null)
    } finally {
      setLoading(false)
    }
  }, [url, markup, detected?.label])

  const applyToForm = useCallback(() => {
    if (!lastProduct) {
      toast.error("Lancez d’abord l’analyse.")
      return
    }
    const mkNum = Number(markup.replace(",", "."))
    const mk = Number.isFinite(mkNum) && mkNum > 0 ? mkNum : 2.5
    const patch = buildUrlImportFormPatch(lastProduct, {
      markup: mk,
      categoryAttrs: categoryAttrs.map((a) => ({ key: a.key, label: a.label })),
      commissionPct,
    })

    if (lastCategory?.leafId && lastCategory.confidence >= 0.55) {
      patch.categoryId = lastCategory.leafId
      patch.categoryBreadcrumb = lastCategory.breadcrumb
    }

    onApply(patch)

    const bits: string[] = []
    if (patch.images.length) bits.push(`${patch.images.length} photo(s)`)
    if (patch.variants.mode !== "none") bits.push("variantes")
    if (patch.categoryId) bits.push("catégorie IA")
    toast.success(
      bits.length
        ? `Fiche remplie (${bits.join(", ")}) — modifiez puis publiez.`
        : "Fiche remplie — modifiez puis publiez."
    )
  }, [lastProduct, lastCategory, markup, categoryAttrs, commissionPct, onApply])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-sky-500/10 p-5 shadow-sm dark:border-violet-800/50 dark:from-violet-950/40 dark:via-fuchsia-950/20 dark:to-sky-950/30">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl" aria-hidden />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
            <Bot className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Agent IA — Import produit
              </h2>
              <Badge className="border-0 bg-violet-600 text-white hover:bg-violet-600">
                <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                Nouveau
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Collez un lien ({SUPPORTED_MARKETPLACE_LABELS}…). L’IA extrait photos, prix, description,
              variantes et propose une catégorie. Vous validez avant publication.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-import-url" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Lien produit
          </Label>
          <Input
            id="ai-import-url"
            type="url"
            placeholder="https://www.aliexpress.com/item/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="border-violet-200/80 bg-white/90 dark:border-violet-900/60 dark:bg-zinc-950/80"
          />
          {detected ? (
            <p className="text-xs text-violet-800 dark:text-violet-200">
              Marketplace détectée : <strong>{detected.label}</strong>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Label htmlFor="ai-import-markup" className="text-xs text-zinc-500">
              Marge ×
            </Label>
            <Input
              id="ai-import-markup"
              type="number"
              min={1}
              step={0.1}
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              disabled={loading}
              className="mt-1"
            />
          </div>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void runAgent()}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Analyse…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" aria-hidden />
                Analyser avec l’IA
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!preview || loading}
            onClick={applyToForm}
          >
            Remplir la fiche
          </Button>
        </div>

        {loading && activeStep ? (
          <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {Object.entries(STEP_LABELS).map(([key, label]) => (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-2",
                  activeStep === key && "font-medium text-violet-700 dark:text-violet-300"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    activeStep === key ? "bg-violet-500 animate-pulse" : "bg-zinc-300"
                  )}
                />
                {label}
              </li>
            ))}
          </ul>
        ) : null}

        {preview ? (
          <div className="flex gap-4 rounded-xl border border-white/60 bg-white/70 p-3 dark:border-zinc-700/80 dark:bg-zinc-950/60">
            {preview.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.image}
                alt=""
                className="h-20 w-20 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
                —
              </div>
            )}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2">{preview.title}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {preview.marketplace} · {preview.method}
                {preview.aiEnriched ? " · IA" : ""}
              </p>
              {preview.price > 0 ? (
                <p className="mt-1 text-violet-700 dark:text-violet-300">
                  Prix suggéré ~{preview.price.toFixed(2)} €
                </p>
              ) : null}
              {preview.category ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Catégorie : {preview.category.breadcrumb}{" "}
                  ({Math.round(preview.category.confidence * 100)} %)
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Après import : vérifiez marque ({GENERIC_BRAND_LABEL} si inconnue), prix, photos et catégorie
          avant de publier sur Affisell.
        </p>
      </div>
    </div>
  )
}
