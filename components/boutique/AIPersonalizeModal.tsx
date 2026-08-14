"use client"

import { RefreshCw, Sparkles, X } from "lucide-react"
import { useMemo, useState } from "react"

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
  selectedTheme: StorefrontTheme
  onThemeSelect: (themeId: StorefrontTheme) => void
  onGenerate: (input: { vibe: string; themeId: StorefrontTheme }) => Promise<void>
  onRegenerateDescription: () => Promise<void>
  generating?: boolean
}

export function AIPersonalizeModal({
  open,
  onClose,
  storeSlug,
  selectedTheme,
  onThemeSelect,
  onGenerate,
  onRegenerateDescription,
  generating = false,
}: Props) {
  const [vibe, setVibe] = useState("")

  const featuredThemes = useMemo(
    () => FEATURED_THEME_INDICES.map((index) => getStorefrontThemeByIndex(index)),
    []
  )

  if (!open) return null

  const handleGenerate = async () => {
    const themeId = vibe.trim() ? themeRefFromVibe(vibe) : selectedTheme
    if (vibe.trim()) onThemeSelect(themeId)
    await onGenerate({ vibe: vibe.trim(), themeId })
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
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 text-white shadow-2xl"
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

        <div className="space-y-5 p-6 pt-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300/90">
              Affisell AI · {STOREFRONT_THEME_COUNT.toLocaleString()} designs
            </p>
            <h2 id="ai-personalize-title" className="mt-1 text-xl font-bold tracking-tight">
              Personalize your store with AI
            </h2>
            <p className="mt-1 text-sm text-zinc-400">/boutique/{storeSlug}</p>
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
            <p className="text-xs text-zinc-500">
              Your vibe maps to a unique palette among {STOREFRONT_THEME_COUNT.toLocaleString()} composed themes.
            </p>
          </label>

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
              <Sparkles className="size-4" aria-hidden />
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
