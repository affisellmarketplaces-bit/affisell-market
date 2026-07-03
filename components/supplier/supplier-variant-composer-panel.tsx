"use client"

import { useCallback, useId, useMemo, useState } from "react"
import {
  Loader2,
  Sparkles,
  Wand2,
  CheckCircle2,
  Palette,
  Ruler,
  Tags,
  Zap,
  Keyboard,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import {
  buildVariantComposerFormPatch,
  type GenerateVariantsResult,
  type VariantComposerFormPatch,
} from "@/lib/supplier-generate-variants"
import { readJsonResponse } from "@/lib/read-json-response"
import { cn } from "@/lib/utils"

export type { VariantComposerFormPatch }

export type VariantComposerApplyMeta = {
  rowCount: number
  columnLabels: string[]
  variantMode: VariantComposerFormPatch["variantMode"]
  isConfigurationMatrix: boolean
}

type Props = {
  title: string
  description: string
  categoryPathLabel: string
  bullets: string[]
  basePriceEur: number
  defaultCommission: number
  categoryAttrs: CategoryAttrRow[]
  disabled?: boolean
  compact?: boolean
  onApply: (patch: VariantComposerFormPatch, meta: VariantComposerApplyMeta) => void
}

const EXAMPLE_KEYS = ["colorsSizes", "pcConfigs", "fullMatrix", "specsOnly", "fashion"] as const

function buildApplyMeta(
  preview: GenerateVariantsResult,
  patch: VariantComposerFormPatch
): VariantComposerApplyMeta {
  const rowCount =
    patch.variantMode === "advanced"
      ? patch.advancedSkuRows.length
      : patch.simpleColors.filter((r) => r.name.trim().length > 0).length
  return {
    rowCount,
    columnLabels: patch.skuCustomColumns.map((c) => c.label),
    variantMode: patch.variantMode,
    isConfigurationMatrix: preview.customColumns.length > 0,
  }
}

export function SupplierVariantComposerPanel({
  title,
  description,
  categoryPathLabel,
  bullets,
  basePriceEur,
  defaultCommission,
  categoryAttrs,
  disabled = false,
  compact = false,
  onApply,
}: Props) {
  const t = useTranslations("supplier.variantComposer")
  const textareaId = useId()
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<GenerateVariantsResult | null>(null)

  const characteristics = useMemo(
    () =>
      categoryAttrs.map((a) => ({
        key: a.key,
        label: a.label,
        type: a.type,
        options: a.options,
        required: a.required,
      })),
    [categoryAttrs]
  )

  const examples = useMemo(
    () => EXAMPLE_KEYS.map((key) => ({ key, text: t(`examples.${key}`) })),
    [t]
  )

  const applyPreview = useCallback(
    (result: GenerateVariantsResult) => {
      const patch = buildVariantComposerFormPatch(result, {
        basePriceEur,
        defaultCommission,
        skuPrefix: "PRD",
      })
      const meta = buildApplyMeta(result, patch)
      onApply(patch, meta)
      toast.success(
        meta.isConfigurationMatrix
          ? t("appliedMatrix", {
              rows: meta.rowCount,
              cols: meta.columnLabels.join(", "),
            })
          : t("applied")
      )
      setPreview(null)
      setPrompt("")
    },
    [basePriceEur, defaultCommission, onApply, t]
  )

  const runGenerate = useCallback(async (): Promise<GenerateVariantsResult | null> => {
    const text = prompt.trim()
    if (text.length < 8) {
      toast.error(t("errorPromptShort"))
      return null
    }

    setLoading(true)
    setPreview(null)
    try {
      const res = await fetch("/api/supplier/generate-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt: text,
          title,
          description,
          categoryPath: categoryPathLabel,
          bullets,
          basePriceEur,
          defaultCommission,
          characteristics,
        }),
      })
      const data = await readJsonResponse<GenerateVariantsResult & { error?: string }>(res)
      if (!res.ok) throw new Error(data.error ?? t("errorGeneric"))

      setPreview(data)
      toast.success(t("previewReady"))
      return data
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorGeneric"))
      return null
    } finally {
      setLoading(false)
    }
  }, [
    basePriceEur,
    bullets,
    categoryPathLabel,
    characteristics,
    defaultCommission,
    description,
    prompt,
    t,
    title,
  ])

  const handleGenerateAndApply = useCallback(async () => {
    const result = preview ?? (await runGenerate())
    if (result) applyPreview(result)
  }, [applyPreview, preview, runGenerate])

  const handleApply = useCallback(() => {
    if (!preview) return
    applyPreview(preview)
  }, [applyPreview, preview])

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (preview) void handleGenerateAndApply()
        else void runGenerate()
      }
    },
    [handleGenerateAndApply, preview, runGenerate]
  )

  const specEntries = preview ? Object.entries(preview.specs) : []
  const showMatrixPreview =
    preview != null &&
    preview.advancedRows.length > 0 &&
    preview.customColumns.length > 0

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-violet-200/70",
        "bg-gradient-to-br from-violet-50/95 via-white to-indigo-50/90",
        compact ? "p-4" : "p-5",
        "shadow-sm ring-1 ring-violet-500/10",
        "dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-indigo-950/30 dark:ring-violet-400/10"
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/15"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <Wand2 className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t("title")}
              </h3>
              <Badge
                variant="secondary"
                className="border-violet-200/80 bg-violet-100/80 text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
              >
                {t("badge")}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {compact ? t("descriptionCompact") : t("description")}
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor={textareaId} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {t("promptLabel")}
            </Label>
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              <Keyboard className="h-3 w-3" aria-hidden />
              {t("keyboardHint")}
            </span>
          </div>
          <textarea
            id={textareaId}
            rows={compact ? 3 : 4}
            value={prompt}
            disabled={disabled || loading}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={t("promptPlaceholder")}
            className={cn(
              "mt-1.5 w-full resize-y rounded-xl border border-violet-200/80 bg-white/90 px-3.5 py-3",
              "text-sm text-zinc-900 shadow-inner shadow-violet-500/5 placeholder:text-zinc-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "dark:border-violet-900/60 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            )}
          />
        </div>

        {!compact ? (
          <div className="flex flex-wrap gap-2">
            <span className="w-full text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t("examplesLabel")}
            </span>
            {examples.map(({ key, text }) => (
              <button
                key={key}
                type="button"
                disabled={disabled || loading}
                onClick={() => setPrompt(text)}
                className={cn(
                  "rounded-full border border-violet-200/80 bg-white/80 px-3 py-1.5 text-left text-xs text-violet-900",
                  "transition hover:border-violet-400 hover:bg-violet-50",
                  "dark:border-violet-800/60 dark:bg-zinc-900/60 dark:text-violet-100 dark:hover:bg-violet-950/50"
                )}
              >
                {text.length > 72 ? `${text.slice(0, 72)}…` : text}
              </button>
            ))}
          </div>
        ) : null}

        {preview ? (
          <div
            className={cn(
              "rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25"
            )}
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  {preview.summary || t("previewDefault")}
                </p>

                {showMatrixPreview ? (
                  <div className="overflow-x-auto rounded-lg border border-emerald-200/60 bg-white/90 dark:border-emerald-900/40 dark:bg-zinc-950/80">
                    <table className="w-full min-w-[280px] text-left text-xs">
                      <thead className="border-b border-emerald-100 bg-emerald-50/80 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <tr>
                          <th className="px-3 py-2">{t("matrixPreviewAxis")}</th>
                          {preview.customColumns.map((col) => (
                            <th key={col.key} className="px-3 py-2">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.advancedRows.slice(0, 8).map((row, i) => (
                          <tr
                            key={`${row.color}-${i}`}
                            className="border-b border-emerald-50 last:border-0 dark:border-emerald-950/50"
                          >
                            <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                              {row.color}
                            </td>
                            {preview.customColumns.map((col) => (
                              <td key={col.key} className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                                {row.customFields[col.key] ?? "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.advancedRows.length > 8 ? (
                      <p className="px-3 py-2 text-[10px] text-emerald-800/80 dark:text-emerald-200/70">
                        +{preview.advancedRows.length - 8} {t("rowsLabel")}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {preview.variantMode !== "none" && preview.colors.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-xs dark:bg-zinc-900/60">
                        <Palette className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                        {preview.colors.map((c) => c.name).join(" · ")}
                      </span>
                    ) : null}
                    {preview.sizesText ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-xs dark:bg-zinc-900/60">
                        <Ruler className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                        {preview.sizesText}
                      </span>
                    ) : null}
                    {specEntries.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-xs dark:bg-zinc-900/60">
                        <Tags className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                        {specEntries.map(([k, v]) => `${k}: ${v}`).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {preview.variantMode === "advanced" ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t("modeAdvanced")} · {preview.advancedRows.length || preview.colors.length}{" "}
                      {t("rowsLabel")}
                    </Badge>
                  ) : preview.variantMode === "simple" ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t("modeSimple")}
                    </Badge>
                  ) : null}
                  {showMatrixPreview ? (
                    <Badge variant="outline" className="border-violet-300 text-[10px] text-violet-800 dark:text-violet-200">
                      {t("editableAfterApply")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={disabled || loading || prompt.trim().length < 8}
            onClick={() => void runGenerate()}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {loading ? t("generating") : t("generateCta")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || loading || prompt.trim().length < 8}
            onClick={() => void handleGenerateAndApply()}
            className="gap-2 border border-violet-200 bg-white text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-100"
          >
            <Zap className="h-4 w-4" aria-hidden />
            {t("generateAndApplyCta")}
          </Button>
          {preview ? (
            <Button type="button" variant="outline" disabled={disabled || loading} onClick={handleApply}>
              {t("applyCta")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
