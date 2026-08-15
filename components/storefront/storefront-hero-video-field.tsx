"use client"

import { Loader2, Sparkles, Video } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { StorefrontHeroVideoNameOverlay } from "@/components/storefront/storefront-hero-video-name-overlay"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StorefrontHeaderBrandAlign, StorefrontHeroStyle } from "@/lib/storefront-theme-shared"
import type { StoreNameBadgeStyle } from "@/lib/store-name-badge-styles"
import { cn } from "@/lib/utils"

type Props = {
  heroStyle: StorefrontHeroStyle
  heroVideoUrl: string
  heroVideoShowStoreName: boolean
  storeName: string
  nameBadge: StoreNameBadgeStyle
  accent: string
  primary: string
  headerBrandAlign: StorefrontHeaderBrandAlign
  onHeroStyle: (style: StorefrontHeroStyle) => void
  onHeroVideoUrl: (url: string) => void
  onHeroVideoShowStoreName: (show: boolean) => void
}

export function StorefrontHeroVideoField({
  heroStyle,
  heroVideoUrl,
  heroVideoShowStoreName,
  storeName,
  nameBadge,
  accent,
  primary,
  headerBrandAlign,
  onHeroStyle,
  onHeroVideoUrl,
  onHeroVideoShowStoreName,
}: Props) {
  const t = useTranslations("storefront.brandStudio.heroVideo")
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch("/api/store/generate-hero-video", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
      const json = (await res.json()) as { error?: string; videoUrl?: string }
      if (!res.ok) throw new Error(json.error ?? t("generateFailed"))
      if (!json.videoUrl) throw new Error(t("generateFailed"))
      onHeroVideoUrl(json.videoUrl)
      onHeroStyle("video")
      onHeroVideoShowStoreName(true)
      console.log("[storefront-hero-video]", { storeName, result: "generated" })
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("generateFailed"))
    } finally {
      setGenerating(false)
    }
  }, [onHeroStyle, onHeroVideoShowStoreName, onHeroVideoUrl, storeName, t])

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border p-4 transition",
        heroStyle === "video"
          ? "border-violet-300/70 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20"
          : "border-gray-200 dark:border-zinc-800"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 text-violet-700 dark:text-violet-300">
          <Video className="size-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("title")}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("hint")}</p>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
          {t("urlLabel")}
        </span>
        <Input
          value={heroVideoUrl}
          onChange={(e) => onHeroVideoUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
        />
      </label>

      {heroVideoUrl.trim() ? (
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <video
            src={heroVideoUrl.trim()}
            className="aspect-video w-full bg-zinc-950 object-cover"
            controls
            muted
            playsInline
            preload="metadata"
          />
          {heroVideoShowStoreName ? (
            <StorefrontHeroVideoNameOverlay
              storeName={storeName}
              nameBadge={nameBadge}
              accent={accent}
              primary={primary}
              align={headerBrandAlign}
            />
          ) : null}
        </div>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200/80 bg-white/60 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          checked={heroVideoShowStoreName}
          onChange={(e) => onHeroVideoShowStoreName(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("showStoreName")}
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
            {t("showStoreNameHint")}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void handleGenerate()} disabled={generating}>
          {generating ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          {generating ? t("generating") : t("generate")}
        </Button>
        {heroVideoUrl.trim() ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onHeroStyle("video")}
            disabled={heroStyle === "video"}
          >
            {t("useAsHero")}
          </Button>
        ) : null}
      </div>

      {genError ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {genError}
        </p>
      ) : null}
    </div>
  )
}
