"use client"

import { Loader2, RefreshCw, Sparkles, Type, X } from "lucide-react"
import { useMemo, useState } from "react"

import { BoutiqueStoreTitle } from "@/components/boutique/boutique-store-title"
import {
  BOUTIQUE_TITLE_CHAR_PALETTE,
  BOUTIQUE_TITLE_FONTS,
  BOUTIQUE_TITLE_LAYOUT_IDS,
  BOUTIQUE_TITLE_ORNAMENTS,
  type BoutiqueTitleFontId,
  type BoutiqueTitleLayoutId,
  type BoutiqueTitleOrnamentId,
  type BoutiqueTitleTypography,
} from "@/lib/boutique/boutique-title-typography-shared"
import { cn } from "@/lib/utils"
import {
  FEATURED_THEME_INDICES,
  getStorefrontThemeByIndex,
  STOREFRONT_THEME_COUNT,
  themeRefFromVibe,
  type StorefrontTheme,
} from "@/lib/boutique/storefront-themes"

type Props = {
  open: boolean
  onClose: () => void
  storeSlug: string
  storeLabel: string
  selectedTheme: StorefrontTheme
  titleTypography: BoutiqueTitleTypography
  onThemeSelect: (themeId: StorefrontTheme) => void
  onTitleTypographyChange: (next: BoutiqueTitleTypography) => void
  onGenerate: (input: {
    vibe: string
    themeId: StorefrontTheme
    titleTypography: BoutiqueTitleTypography
  }) => Promise<void>
  onRegenerateDescription: () => Promise<void>
  generating?: boolean
}

const FEATURED_FONTS: BoutiqueTitleFontId[] = [
  "syne",
  "orbitron",
  "playfair",
  "space-grotesk",
  "unbounded",
  "jetbrains",
]

export function AIPersonalizeModal({
  open,
  onClose,
  storeSlug,
  storeLabel,
  selectedTheme,
  titleTypography,
  onThemeSelect,
  onTitleTypographyChange,
  onGenerate,
  onRegenerateDescription,
  generating = false,
}: Props) {
  const [vibe, setVibe] = useState("")
  const [displayDraft, setDisplayDraft] = useState(titleTypography.displayOverride ?? "")

  const featuredThemes = useMemo(
    () => FEATURED_THEME_INDICES.map((index) => getStorefrontThemeByIndex(index)),
    []
  )

  if (!open) return null

  const patchTypography = (patch: Partial<BoutiqueTitleTypography>) => {
    onTitleTypographyChange({ ...titleTypography, ...patch })
  }

  const insertChar = (char: string) => {
    const next = `${displayDraft}${char}`.slice(0, 80)
    setDisplayDraft(next)
    patchTypography({ displayOverride: next.trim() || null, layoutId: "custom-only" })
  }

  const handleGenerate = async () => {
    const themeId = vibe.trim() ? themeRefFromVibe(vibe) : selectedTheme
    if (vibe.trim()) onThemeSelect(themeId)
    const nextTypography: BoutiqueTitleTypography = {
      ...titleTypography,
      displayOverride: displayDraft.trim() || null,
      layoutId: displayDraft.trim() ? "custom-only" : titleTypography.layoutId,
    }
    onTitleTypographyChange(nextTypography)
    await onGenerate({ vibe: vibe.trim(), themeId, titleTypography: nextTypography })
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-personalize-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-6 p-6 pt-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300/90">
              Affisell AI · {STOREFRONT_THEME_COUNT.toLocaleString()} designs
            </p>
            <h2 id="ai-personalize-title" className="mt-1 text-xl font-bold tracking-tight">
              Personalize your store with AI
            </h2>
            <p className="mt-1 text-sm text-zinc-400">/boutique/{storeSlug}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Title preview
            </p>
            <div className="pointer-events-none scale-[0.72] origin-left sm:scale-90">
              <BoutiqueStoreTitle storeLabel={storeLabel} typography={titleTypography} />
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">Describe your brand vibe</span>
            <input
              type="text"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder="luxury tech store for gamers"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Type className="size-4 text-cyan-300" aria-hidden />
              Fonts & special characters
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FEATURED_FONTS.map((fontId) => {
                const preset = BOUTIQUE_TITLE_FONTS.find((f) => f.id === fontId)!
                const active = titleTypography.fontId === fontId
                return (
                  <button
                    key={fontId}
                    type="button"
                    onClick={() => patchTypography({ fontId })}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-xs transition",
                      active
                        ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20"
                    )}
                    style={{ fontFamily: preset.family, fontWeight: preset.weight }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BOUTIQUE_TITLE_ORNAMENTS.filter((o) => o.id !== "none").map((ornament) => {
                const active = titleTypography.ornamentId === ornament.id
                return (
                  <button
                    key={ornament.id}
                    type="button"
                    onClick={() =>
                      patchTypography({
                        ornamentId: ornament.id as BoutiqueTitleOrnamentId,
                        layoutId: "boutique-accent",
                        displayOverride: null,
                      })
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-violet-400/60 bg-violet-500/15 text-violet-100"
                        : "border-white/10 text-zinc-400 hover:border-white/25"
                    )}
                  >
                    {ornament.sample}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-1">
              {BOUTIQUE_TITLE_CHAR_PALETTE.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => insertChar(char)}
                  className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-zinc-200 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
                  aria-label={`Insert ${char}`}
                >
                  {char}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={displayDraft}
              onChange={(e) => {
                const v = e.target.value.slice(0, 80)
                setDisplayDraft(v)
                patchTypography({
                  displayOverride: v.trim() || null,
                  layoutId: v.trim() ? "custom-only" : titleTypography.layoutId,
                })
              }}
              placeholder={`Custom title e.g. ✦ ${storeLabel} ✦`}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
            />

            <div className="flex flex-wrap gap-2">
              {BOUTIQUE_TITLE_LAYOUT_IDS.map((layoutId) => (
                <button
                  key={layoutId}
                  type="button"
                  onClick={() => patchTypography({ layoutId: layoutId as BoutiqueTitleLayoutId })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide transition",
                    titleTypography.layoutId === layoutId
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {layoutId.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-zinc-200">Featured palettes</span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {featuredThemes.map((theme) => {
                const active = selectedTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onThemeSelect(theme.id)}
                    className={cn(
                      "overflow-hidden rounded-2xl border p-2 text-left transition duration-300",
                      active
                        ? "border-violet-400 ring-2 ring-violet-400/40"
                        : "border-white/10 hover:border-white/25"
                    )}
                  >
                    <div
                      className="h-14 rounded-xl border border-white/10"
                      style={{ background: theme.previewBg }}
                    >
                      <div
                        className="mx-2 mt-3 h-5 rounded-md"
                        style={{ background: theme.previewAccent }}
                      />
                    </div>
                    <p className="mt-2 px-1 text-[11px] font-semibold text-zinc-200">{theme.label}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-teal-500 text-sm font-semibold text-white transition hover:from-violet-700 hover:to-teal-600 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {generating ? "Generating…" : "Generate with AI ✨"}
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={() => void onRegenerateDescription()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCw className={cn("size-4", generating && "animate-spin")} aria-hidden />
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
