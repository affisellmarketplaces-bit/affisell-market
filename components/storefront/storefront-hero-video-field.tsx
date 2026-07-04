"use client"

import { Loader2, Sparkles, Video } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import type { StorefrontHeroStyle } from "@/lib/storefront-theme-shared"
type Props = {
  heroStyle: StorefrontHeroStyle
  heroVideoUrl: string
  storeName: string
  onHeroStyle: (style: StorefrontHeroStyle) => void
  onHeroVideoUrl: (url: string) => void
}

export function StorefrontHeroVideoField({
  heroStyle,
  heroVideoUrl,
  storeName,
  onHeroStyle,
  onHeroVideoUrl,
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
      console.log("[storefront-hero-video]", { storeName, result: "generated" })
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("generateFailed"))
    } finally {
      setGenerating(false)
    }
  }, [onHeroStyle, onHeroVideoUrl, storeName, t])

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
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <video
            src={heroVideoUrl.trim()}
            className="aspect-video w-full bg-zinc-950 object-cover"
            controls
            muted
            playsInline
            preload="metadata"
          />
        </div>
      ) : null}

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
