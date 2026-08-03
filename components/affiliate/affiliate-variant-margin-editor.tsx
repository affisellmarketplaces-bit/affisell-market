"use client"

import { ImagePlus, Link2, Loader2, Percent, Sparkles, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import type { AffiliateVariantOption } from "@/lib/affiliate-storefront-variants"
import {
  marginEuroFromPrices,
  sellingPriceCentsFromMargin,
} from "@/lib/affiliate-variant-pricing"
import { ColorSwatchSizeError, processColorSwatchFile } from "@/lib/color-swatch-image"
import { imageFilesFromDataTransfer } from "@/lib/description-illustration-image"
import { cn } from "@/lib/utils"

type PresentationDraft = {
  label: string
  imageUrl: string
}

type Props = {
  options: AffiliateVariantOption[]
  pick: Record<string, boolean>
  marginEuroByKey: Record<string, string>
  presentationByKey: Record<string, PresentationDraft>
  onPickChange: (key: string, checked: boolean) => void
  onMarginChange: (key: string, value: string) => void
  onPresentationChange: (key: string, patch: Partial<PresentationDraft>) => void
  onSelectAll: () => void
  onSelectNone: () => void
  onApplyGlobalMargin: (marginEuro: number) => void
  globalMarginEuro: number | null
  highlightVariantKeys?: string[]
  disabled?: boolean
}

function parseEuroInput(raw: string): number | null {
  const n = Number(String(raw).replace(",", "."))
  return Number.isFinite(n) ? n : null
}

async function uploadVariantPhotoFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.set("file", file)

  // Prefer CDN processed upload (AFFILIATE | SUPPLIER | ADMIN)
  const cdnRes = await fetch("/api/upload/processed-image", {
    method: "POST",
    body: fd,
    credentials: "include",
  })
  if (cdnRes.ok) {
    const data = (await cdnRes.json()) as { url?: string }
    if (typeof data.url === "string" && data.url.trim()) return data.url.trim()
  }

  // Affiliate local upload fallback (PNG/JPEG ≤ 2MB)
  const localFd = new FormData()
  localFd.set("file", file)
  const localRes = await fetch("/api/affiliate/uploads", {
    method: "POST",
    body: localFd,
    credentials: "include",
  })
  if (localRes.ok) {
    const data = (await localRes.json()) as { url?: string }
    if (typeof data.url === "string" && data.url.trim()) return data.url.trim()
  }

  // Last resort: compact data URL swatch
  return processColorSwatchFile(file)
}

function urlDraftFromValue(value: string): string {
  const t = value.trim()
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/uploads/")) return t
  return ""
}

function VariantPhotoControl({
  value,
  disabled,
  onChange,
  labels,
}: {
  value: string
  disabled?: boolean
  onChange: (url: string) => void
  labels: {
    file: string
    urlPlaceholder: string
    applyUrl: string
    remove: string
    missing: string
    dropHint: string
  }
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [urlDraft, setUrlDraft] = useState(() => urlDraftFromValue(value))
  const preview = value.trim()

  useEffect(() => {
    setUrlDraft(urlDraftFromValue(value))
  }, [value])

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return
      if (!file.type.startsWith("image/")) {
        toast.error("Image requise (JPG, PNG, WebP…)")
        return
      }
      setBusy(true)
      try {
        const url = await uploadVariantPhotoFile(file)
        onChange(url)
        setUrlDraft(urlDraftFromValue(url))
        toast.success("Photo variante ajoutée")
      } catch (e) {
        if (e instanceof ColorSwatchSizeError) {
          toast.error(`${e.fileName} : min. ${e.minW}×${e.minH} px.`)
        } else {
          toast.error(e instanceof Error ? e.message : "Upload impossible")
        }
      } finally {
        setBusy(false)
      }
    },
    [disabled, onChange]
  )

  const applyUrl = useCallback(() => {
    const t = urlDraft.trim()
    if (!t) {
      toast.error("Collez une URL https://…")
      return
    }
    if (!/^https?:\/\//i.test(t) && !t.startsWith("/uploads/")) {
      toast.error("URL invalide — https://… ou /uploads/…")
      return
    }
    onChange(t)
    toast.success("Lien photo enregistré")
  }, [onChange, urlDraft])

  return (
    <div className="space-y-2">
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (disabled || busy) return
          const files = imageFilesFromDataTransfer(e.dataTransfer)
          void onFile(files[0])
        }}
        className={cn(
          "flex flex-wrap items-start gap-3 rounded-xl border border-dashed p-2.5 transition",
          dragOver
            ? "border-violet-400 bg-violet-50/80 dark:border-violet-600 dark:bg-violet-950/30"
            : "border-transparent bg-transparent"
        )}
      >
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border transition",
            preview
              ? "border-emerald-300 bg-white dark:border-emerald-800"
              : "border-dashed border-amber-300 bg-amber-50/80 hover:border-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
          )}
          title={labels.file}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5 text-amber-600 dark:text-amber-300" aria-hidden />
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-white/75 dark:bg-zinc-950/75">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-800 transition hover:border-violet-400 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              {labels.file}
            </button>
            {preview ? (
              <button
                type="button"
                disabled={disabled || busy}
                className="text-[10px] font-medium text-red-600 underline decoration-dotted"
                onClick={() => {
                  onChange("")
                  setUrlDraft("")
                }}
              >
                {labels.remove}
              </button>
            ) : (
              <span className="self-center text-[10px] text-amber-700 dark:text-amber-300">
                {labels.missing}
              </span>
            )}
          </div>

          <div className="flex gap-1.5">
            <input
              type="url"
              disabled={disabled || busy}
              value={urlDraft}
              placeholder={labels.urlPlaceholder}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyUrl()
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              disabled={disabled || busy}
              onClick={applyUrl}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Link2 className="h-3 w-3" aria-hidden />
              {labels.applyUrl}
            </button>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-zinc-500">{labels.dropHint}</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          void onFile(f)
        }}
      />
    </div>
  )
}

export function AffiliateVariantMarginEditor({
  options,
  pick,
  marginEuroByKey,
  presentationByKey,
  onPickChange,
  onMarginChange,
  onPresentationChange,
  onSelectAll,
  onSelectNone,
  onApplyGlobalMargin,
  globalMarginEuro,
  highlightVariantKeys = [],
  disabled = false,
}: Props) {
  const t = useTranslations("affiliateDashboard.listingBuilder.variantMargins")
  const highlightSet = new Set(highlightVariantKeys.map((k) => k.toLowerCase()))
  const selectedCount = options.filter((o) => pick[o.key]).length

  const photoLabels = {
    file: t("photoFile"),
    urlPlaceholder: t("photoUrlPlaceholder"),
    applyUrl: t("photoApplyUrl"),
    remove: t("photoRemove"),
    missing: t("photoMissing"),
    dropHint: t("photoDropHint"),
  }

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-zinc-950 dark:to-teal-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{t("title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>
        {selectedCount > 0 && globalMarginEuro != null && Number.isFinite(globalMarginEuro) ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onApplyGlobalMargin(globalMarginEuro)}
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-200"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t("applyGlobalMargin", { amount: globalMarginEuro.toFixed(2) })}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="text-xs font-medium text-emerald-800 underline decoration-dotted"
          onClick={onSelectAll}
          disabled={disabled}
        >
          {t("selectAll")}
        </button>
        <button
          type="button"
          className="text-xs font-medium text-gray-600 underline decoration-dotted"
          onClick={onSelectNone}
          disabled={disabled}
        >
          {t("selectNone")}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {options.map((opt) => {
          const checked = Boolean(pick[opt.key])
          const marginRaw = marginEuroByKey[opt.key] ?? ""
          const marginEuro = parseEuroInput(marginRaw)
          const sellingCents =
            marginEuro != null && marginEuro >= 0
              ? sellingPriceCentsFromMargin({
                  wholesaleCents: opt.wholesaleCents,
                  marginEuro,
                })
              : null
          const marginPct =
            marginEuro != null && opt.wholesaleCents > 0
              ? (marginEuro / (opt.wholesaleCents / 100)) * 100
              : null
          const isHighlighted = highlightSet.has(opt.key.toLowerCase())
          const presentation = presentationByKey[opt.key] ?? {
            label: opt.label,
            imageUrl: opt.imageUrl ?? "",
          }
          const displayLabel = presentation.label.trim() || opt.label

          return (
            <li
              key={opt.key}
              className={cn(
                "rounded-xl border transition",
                isHighlighted
                  ? "border-amber-400/90 bg-amber-50/80 ring-1 ring-amber-300/60 dark:border-amber-700/60 dark:bg-amber-950/20"
                  : checked
                    ? "border-emerald-300/80 bg-white shadow-sm dark:border-emerald-800/60 dark:bg-zinc-950/80"
                    : "border-gray-200/80 bg-gray-50/50 opacity-75 dark:border-zinc-800 dark:bg-zinc-900/40"
              )}
            >
              <label className="flex cursor-pointer items-start gap-3 px-3 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onPickChange(opt.key, !checked)}
                  className="mt-1 rounded border-gray-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                      {displayLabel}
                    </span>
                    {displayLabel !== opt.key ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {opt.key}
                      </span>
                    ) : null}
                    {opt.stock > 0 ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {t("stock", { count: opt.stock })}
                      </span>
                    ) : null}
                    {isHighlighted ? (
                      <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:bg-amber-900/60 dark:text-amber-100">
                        {t("reviewBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
                    {t("supplier")}{" "}
                    <span className="font-medium tabular-nums text-gray-700 dark:text-zinc-300">
                      {formatStoreCurrencyFromCents(opt.wholesaleCents)}
                    </span>
                  </p>
                </div>
              </label>

              {checked ? (
                <div className="space-y-3 border-t border-emerald-100/80 px-3 py-3 dark:border-emerald-900/40">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {t("nameLabel")}
                      </label>
                      <input
                        type="text"
                        disabled={disabled}
                        value={presentation.label}
                        maxLength={64}
                        placeholder={opt.label}
                        onChange={(e) => onPresentationChange(opt.key, { label: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <p className="mt-1 text-[10px] text-gray-500">{t("nameHint")}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {t("photoLabel")}
                      </label>
                      <div className="mt-1">
                        <VariantPhotoControl
                          value={presentation.imageUrl}
                          disabled={disabled}
                          labels={photoLabels}
                          onChange={(imageUrl) => onPresentationChange(opt.key, { imageUrl })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {t("marginLabel")}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={disabled}
                        value={marginRaw}
                        onChange={(e) => onMarginChange(opt.key, e.target.value)}
                        placeholder="0.00"
                        className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {t("clientPrice")}
                      </label>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {sellingCents != null ? formatStoreCurrencyFromCents(sellingCents) : "—"}
                      </p>
                    </div>
                    <div className="flex items-end pb-1">
                      {marginPct != null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          <Percent className="h-3 w-3" aria-hidden />
                          +{marginPct.toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function initialVariantMarginEuroByKey(args: {
  options: AffiliateVariantOption[]
  variantPricing:
    | Record<string, { sellingPriceCents: number; marginCents: number }>
    | null
    | undefined
  globalMarginEuro: number | null
}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const opt of args.options) {
    const saved = args.variantPricing?.[opt.key]
    if (saved?.marginCents != null && saved.marginCents >= 0) {
      out[opt.key] = (saved.marginCents / 100).toFixed(2)
    } else if (saved?.sellingPriceCents != null) {
      out[opt.key] = marginEuroFromPrices(opt.wholesaleCents, saved.sellingPriceCents).toFixed(2)
    } else if (args.globalMarginEuro != null && Number.isFinite(args.globalMarginEuro)) {
      out[opt.key] = args.globalMarginEuro.toFixed(2)
    } else {
      out[opt.key] = "0.00"
    }
  }
  return out
}

export function initialVariantPresentationByKey(args: {
  options: AffiliateVariantOption[]
  presentation: Record<string, { label?: string; image?: string }> | null | undefined
}): Record<string, PresentationDraft> {
  const map = args.presentation ?? {}
  const out: Record<string, PresentationDraft> = {}
  for (const opt of args.options) {
    const entry =
      map[opt.key] ??
      Object.entries(map).find(([k]) => k.toLowerCase() === opt.key.toLowerCase())?.[1]
    out[opt.key] = {
      label: entry?.label?.trim() || opt.label,
      imageUrl: entry?.image?.trim() || opt.imageUrl || "",
    }
  }
  return out
}
