"use client"

import { useCallback, useMemo, useState } from "react"
import { Check, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const MAX_TITLE_VARIANTS = 6

type TitleVariantRow = {
  id: string
  text: string
}

type Props = {
  title: string
  onTitleChange: (value: string) => void
  description: string
  descriptionBullets: string[]
  categoryPathLabel: string
  productGalleryImages: string[]
  onBulletsGenerated: (bullets: string[]) => void
  onSubtitleGenerated?: (subtitle: string) => void
  disabled?: boolean
  hasError?: boolean
  errorMessage?: string
}

function isDataImageUrl(u: string): boolean {
  return /^data:image\//i.test(u)
}

function isHttpsImageUrl(u: string): boolean {
  return /^https?:\/\//i.test(u.trim())
}

function newVariantId(): string {
  return `tv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function titleScore(len: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (len >= 45 && len <= 110) return { label: "Longueur optimale SEO", tone: "good" }
  if (len >= 25 && len < 45) return { label: "Un peu court — enrichir le bénéfice", tone: "warn" }
  if (len > 110) return { label: "Trop long — risque de troncature", tone: "bad" }
  return { label: "Titre trop court", tone: "bad" }
}

export function SupplierTitleOptimizer({
  title,
  onTitleChange,
  description,
  descriptionBullets,
  categoryPathLabel,
  productGalleryImages,
  onBulletsGenerated,
  onSubtitleGenerated,
  disabled = false,
  hasError = false,
  errorMessage,
}: Props) {
  const t = useTranslations("supplier.titleOptimizer")
  const [loading, setLoading] = useState(false)
  const [subtitle, setSubtitle] = useState("")
  const [variantRows, setVariantRows] = useState<TitleVariantRow[]>([])
  const [insight, setInsight] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])

  const score = useMemo(() => titleScore(title.trim().length), [title])

  const updateVariantText = useCallback((id: string, text: string) => {
    setVariantRows((prev) => prev.map((row) => (row.id === id ? { ...row, text } : row)))
  }, [])

  const removeVariant = useCallback((id: string) => {
    setVariantRows((prev) => prev.filter((row) => row.id !== id))
  }, [])

  const addVariant = useCallback(() => {
    setVariantRows((prev) => {
      if (prev.length >= MAX_TITLE_VARIANTS) return prev
      return [...prev, { id: newVariantId(), text: "" }]
    })
  }, [])

  const applyVariant = useCallback(
    (raw: string) => {
      const next = raw.trim().slice(0, 500)
      if (!next) return
      onTitleChange(next)
      toast.success(t("variantApplied"))
    },
    [onTitleChange, t]
  )

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/supplier/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          notes: description.trim(),
          bullets: descriptionBullets.map((s) => s.trim()).filter(Boolean),
          categoryPath: categoryPathLabel,
          productImageUrls: productGalleryImages.filter(isHttpsImageUrl).slice(0, 2),
          productImageDataUrls: productGalleryImages.filter(isDataImageUrl).slice(0, 2),
        }),
      })
      const data = (await res.json()) as {
        error?: string
        title?: string
        titleVariants?: string[]
        subtitle?: string
        bulletPoints?: string[]
        seoKeywords?: string[]
        insight?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Génération impossible")

      if (data.title?.trim()) onTitleChange(data.title.trim().slice(0, 500))
      if (Array.isArray(data.titleVariants)) {
        setVariantRows(
          data.titleVariants
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .slice(0, MAX_TITLE_VARIANTS)
            .map((text) => ({ id: newVariantId(), text: text.trim().slice(0, 500) }))
        )
      }
      if (data.subtitle?.trim()) {
        setSubtitle(data.subtitle.trim())
        onSubtitleGenerated?.(data.subtitle.trim())
      }
      if (Array.isArray(data.bulletPoints) && data.bulletPoints.length > 0) {
        onBulletsGenerated(data.bulletPoints)
      }
      if (Array.isArray(data.seoKeywords)) setKeywords(data.seoKeywords.slice(0, 8))
      if (data.insight?.trim()) setInsight(data.insight.trim())

      toast.success(t("optimizeSuccess"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Service indisponible")
    } finally {
      setLoading(false)
    }
  }, [
    categoryPathLabel,
    description,
    descriptionBullets,
    onBulletsGenerated,
    onSubtitleGenerated,
    onTitleChange,
    productGalleryImages,
    t,
    title,
  ])

  const canAddVariant = variantRows.length < MAX_TITLE_VARIANTS

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="p-name" className="mb-0 text-zinc-800 dark:text-zinc-100">
          {t("titleLabel")} <span className="text-red-600">*</span>
        </Label>
        <Button
          type="button"
          size="sm"
          disabled={disabled || loading}
          onClick={() => void handleGenerate()}
          className="gap-1.5 border-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 text-white shadow-lg shadow-violet-500/25 hover:opacity-95 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          {loading ? t("optimizing") : t("optimizeCta")}
        </Button>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4 shadow-sm",
          "border-violet-200/60 bg-gradient-to-br from-violet-50/90 via-white/95 to-cyan-50/50",
          "dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950/80 dark:to-cyan-950/30"
        )}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700/90 dark:text-violet-300">
            <Wand2 className="size-3.5" aria-hidden />
            {t("copyEngine")}
          </div>
          <Input
            id="p-name"
            className={cn(
              "h-12 border-white/60 bg-white/80 text-base font-semibold shadow-inner dark:border-zinc-700 dark:bg-zinc-900/80",
              hasError && "border-red-500 ring-2 ring-red-500/30"
            )}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Ex. Leggings anti-cellulite — gainage & confort"
            maxLength={500}
            aria-invalid={hasError}
            disabled={disabled || loading}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                score.tone === "good" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                score.tone === "warn" && "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
                score.tone === "bad" && "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              )}
            >
              {title.trim().length} {t("charsSuffix")} · {score.label}
            </span>
            {keywords.slice(0, 4).map((kw) => (
              <span
                key={kw}
                className="rounded-full border border-violet-200/80 bg-white/70 px-2 py-0.5 text-[10px] text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
              >
                {kw}
              </span>
            ))}
          </div>
          {subtitle ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-violet-700 dark:text-violet-300">{t("subtitlePrefix")}</span>{" "}
              {subtitle}
            </p>
          ) : null}
          {insight ? (
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{insight}</p>
          ) : null}

          <div className="space-y-2 border-t border-violet-200/50 pt-3 dark:border-violet-900/40">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{t("abVariantsTitle")}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{t("abVariantsHint")}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || loading || !canAddVariant}
                onClick={addVariant}
                className="shrink-0 gap-1.5 rounded-xl border-violet-200/80 bg-white/70 text-violet-800 hover:bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200"
              >
                <Plus className="size-3.5" aria-hidden />
                {t("addVariant")}
              </Button>
            </div>

            {variantRows.length > 0 ? (
              <ul className="space-y-2">
                {variantRows.map((row, index) => (
                  <li
                    key={row.id}
                    className="flex items-start gap-2 rounded-xl border border-zinc-200/80 bg-white/60 p-2 dark:border-zinc-700 dark:bg-zinc-900/50"
                  >
                    <span
                      className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                      aria-hidden
                    >
                      {String.fromCharCode(65 + (index % 26))}
                    </span>
                    <Input
                      value={row.text}
                      onChange={(e) => updateVariantText(row.id, e.target.value)}
                      placeholder={t("variantPlaceholder")}
                      maxLength={500}
                      disabled={disabled || loading}
                      className="min-h-10 flex-1 border-transparent bg-transparent text-sm shadow-none focus-visible:border-violet-300 dark:focus-visible:border-violet-700"
                      aria-label={`${t("abVariantsTitle")} ${index + 1}`}
                    />
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={disabled || loading || !row.text.trim()}
                        onClick={() => applyVariant(row.text)}
                        className="size-9 rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300"
                        title={t("useAsTitle")}
                        aria-label={t("useAsTitle")}
                      >
                        <Check className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={disabled || loading}
                        onClick={() => removeVariant(row.id)}
                        className="size-9 rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        title={t("removeVariant")}
                        aria-label={t("removeVariant")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-200/80 bg-zinc-50/50 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
                {t("abVariantsHint")}
              </p>
            )}

            {!canAddVariant ? (
              <p className="text-[10px] text-zinc-500">{t("maxVariants", { count: MAX_TITLE_VARIANTS })}</p>
            ) : null}
          </div>
        </div>
      </div>

      {hasError && errorMessage ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{errorMessage}</p>
      ) : null}
    </div>
  )
}
