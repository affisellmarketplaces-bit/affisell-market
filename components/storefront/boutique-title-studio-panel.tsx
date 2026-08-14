"use client"

import Link from "next/link"
import { Loader2, Type } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { BoutiqueStoreTitle } from "@/components/boutique/boutique-store-title"
import {
  BOUTIQUE_TITLE_CHAR_PALETTE,
  BOUTIQUE_TITLE_FONTS,
  BOUTIQUE_TITLE_LAYOUT_IDS,
  BOUTIQUE_TITLE_ORNAMENTS,
  DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  type BoutiqueTitleLayoutId,
  type BoutiqueTitleOrnamentId,
  type BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"
import { cn } from "@/lib/utils"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  storeLabel: string
  initialTypography?: BoutiqueTitleTypography
  disabled?: boolean
  boutiquePreviewHref?: string
  onSaved?: (typography: BoutiqueTitleTypography) => void
}

export function BoutiqueTitleStudioPanel({
  role,
  storeLabel,
  initialTypography = DEFAULT_BOUTIQUE_TITLE_TYPOGRAPHY,
  disabled = false,
  boutiquePreviewHref,
  onSaved,
}: Props) {
  const t = useTranslations("storefront.brandStudio.boutiqueTitle")
  const [typography, setTypography] = useState<BoutiqueTitleTypography>(initialTypography)
  const [displayDraft, setDisplayDraft] = useState(initialTypography.displayOverride ?? "")
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTypography(initialTypography)
    setDisplayDraft(initialTypography.displayOverride ?? "")
  }, [initialTypography])

  const patch = (next: Partial<BoutiqueTitleTypography>) => {
    setTypography((prev) => ({ ...prev, ...next }))
    setSaved(false)
  }

  const save = useCallback(async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    const payload: BoutiqueTitleTypography = {
      ...typography,
      displayOverride: displayDraft.trim() || null,
      layoutId: displayDraft.trim() ? "custom-only" : typography.layoutId,
    }
    try {
      const result = await postBrandAiJson<{ typography: BoutiqueTitleTypography }>(
        "/api/store/update-boutique-title",
        {
          fontId: payload.fontId,
          ornamentId: payload.ornamentId,
          layoutId: payload.layoutId,
          displayOverride: payload.displayOverride,
        },
        t("failed")
      )
      if (!result.ok || !result.data?.typography) {
        throw new Error(result.error ?? t("failed"))
      }
      setTypography(result.data.typography)
      onSaved?.(result.data.typography)
      setSaved(true)
      console.log("[brand-studio]", { event: "boutique_title_saved", role, fontId: payload.fontId })
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(false)
    }
  }, [displayDraft, onSaved, role, t, typography])

  const insertChar = (char: string) => {
    const next = `${displayDraft}${char}`.slice(0, 80)
    setDisplayDraft(next)
    patch({ displayOverride: next.trim() || null, layoutId: "custom-only" })
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800 sm:px-8">
        <div className="flex items-center gap-2 text-violet-600 dark:text-violet-300">
          <Type className="size-5" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em]">{t("badge")}</span>
        </div>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
          {t("title")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("preview")}</p>
          <div className="origin-left scale-[0.65] sm:scale-75 [&_.boutique-theme-root]:!bg-transparent">
            <div
              className="rounded-xl p-2"
              style={{
                background:
                  "linear-gradient(135deg, rgba(24,24,27,0.95) 0%, rgba(39,39,42,0.9) 100%)",
              }}
            >
              <BoutiqueStoreTitle
                storeLabel={storeLabel}
                typography={{
                  ...typography,
                  displayOverride: displayDraft.trim() || typography.displayOverride,
                  layoutId: displayDraft.trim() ? "custom-only" : typography.layoutId,
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("fonts")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {BOUTIQUE_TITLE_FONTS.map((font) => {
              const active = typography.fontId === font.id
              return (
                <button
                  key={font.id}
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => patch({ fontId: font.id })}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition",
                    active
                      ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-100"
                      : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  )}
                  style={{ fontFamily: font.family, fontWeight: font.weight }}
                >
                  {font.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("ornaments")}</p>
          <div className="flex flex-wrap gap-2">
            {BOUTIQUE_TITLE_ORNAMENTS.map((ornament) => {
              const active = typography.ornamentId === ornament.id
              return (
                <button
                  key={ornament.id}
                  type="button"
                  disabled={disabled || busy}
                  onClick={() =>
                    patch({
                      ornamentId: ornament.id as BoutiqueTitleOrnamentId,
                      layoutId: "boutique-accent",
                      displayOverride: null,
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-400 dark:bg-violet-950/50 dark:text-violet-100"
                      : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                  )}
                >
                  {ornament.sample}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("specialChars")}</p>
          <div className="flex flex-wrap gap-1.5">
            {BOUTIQUE_TITLE_CHAR_PALETTE.map((char) => (
              <button
                key={char}
                type="button"
                disabled={disabled || busy}
                onClick={() => insertChar(char)}
                className="flex size-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-base text-zinc-800 transition hover:border-violet-400 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {char}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("customTitle")}</span>
          <input
            type="text"
            value={displayDraft}
            disabled={disabled || busy}
            onChange={(e) => {
              const v = e.target.value.slice(0, 80)
              setDisplayDraft(v)
              patch({
                displayOverride: v.trim() || null,
                layoutId: v.trim() ? "custom-only" : typography.layoutId,
              })
            }}
            placeholder={t("customPlaceholder", { name: storeLabel })}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {BOUTIQUE_TITLE_LAYOUT_IDS.map((layoutId) => (
            <button
              key={layoutId}
              type="button"
              disabled={disabled || busy}
              onClick={() => patch({ layoutId: layoutId as BoutiqueTitleLayoutId })}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide transition",
                typography.layoutId === layoutId
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 text-zinc-500 dark:border-zinc-700"
              )}
            >
              {t(`layout.${layoutId}` as "layout.boutique-accent")}
            </button>
          ))}
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            {t("saved")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void save()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-violet-600 px-6 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? t("saving") : t("save")}
          </button>
          {boutiquePreviewHref ? (
            <Link
              href={boutiquePreviewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              {t("viewBoutique")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
