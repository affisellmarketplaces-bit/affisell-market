"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export const VIDEO_STYLE_OPTIONS = [
  "TikTok unboxing, energetic",
  "Luxury cinematic, Parisian",
  "UGC style, handheld",
  "Studio product 360",
] as const

export type VideoQuotaInfo = {
  videoQuota: number
  videoUsed: number
  isPro: boolean
}

type Props = {
  productId: string
  productName: string
  quota: VideoQuotaInfo
  initialVideoUrl?: string | null
  initialStyle?: string | null
  className?: string
}

export function GenerateVideoButton({
  productId,
  productName,
  quota: initialQuota,
  initialVideoUrl,
  initialStyle,
  className,
}: Props) {
  const defaultStyle = VIDEO_STYLE_OPTIONS.includes(
    (initialStyle ?? "") as (typeof VIDEO_STYLE_OPTIONS)[number]
  )
    ? (initialStyle as (typeof VIDEO_STYLE_OPTIONS)[number])
    : VIDEO_STYLE_OPTIONS[1]

  const [loading, setLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null)
  const [selectedStyle, setSelectedStyle] = useState<string>(defaultStyle)
  const [quota, setQuota] = useState(initialQuota)

  const remaining = Math.max(0, quota.videoQuota - quota.videoUsed)
  const quotaReached = !quota.isPro && quota.videoUsed >= quota.videoQuota
  const showRegenerate = Boolean(videoUrl)

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/user/quota", { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as VideoQuotaInfo
      setQuota(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  async function runGenerate(regenerate: boolean) {
    if (!productId.trim() || !productName.trim() || !selectedStyle.trim()) {
      toast.error("Produit et style requis.")
      return
    }

    if (quotaReached) {
      toast.error("Quota atteint. Upgrade Pro.")
      return
    }

    setLoading(true)
    if (regenerate) setVideoUrl(null)

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productId.trim(),
          productName: productName.trim(),
          style: selectedStyle.trim(),
          regenerate,
        }),
      })

      const data = (await res.json()) as {
        error?: string
        videoUrl?: string
        cached?: boolean
        videoQuota?: number
        videoUsed?: number
        isPro?: boolean
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Video generation failed")
      }

      if (!data.videoUrl) {
        throw new Error("No video URL returned")
      }

      setVideoUrl(data.videoUrl)
      if (typeof data.videoQuota === "number" && typeof data.videoUsed === "number") {
        setQuota({
          videoQuota: data.videoQuota,
          videoUsed: data.videoUsed,
          isPro: Boolean(data.isPro),
        })
      } else {
        await refreshQuota()
      }

      if (data.cached) {
        toast.success("Vidéo existante chargée")
      } else if (regenerate) {
        toast.success("Vidéo régénérée!")
      } else {
        toast.success("Vidéo générée!")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la génération")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground">
        {quota.isPro ? (
          <span className="font-medium text-violet-700 dark:text-violet-300">Pro — vidéos illimitées</span>
        ) : (
          <>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{remaining}</span>
            /{quota.videoQuota} vidéos restantes
          </>
        )}
      </p>

      <div className="space-y-2">
        <label htmlFor="video-style" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Style vidéo
        </label>
        <Select
          value={selectedStyle}
          onValueChange={(value) => {
            if (value) setSelectedStyle(value)
          }}
          disabled={loading}
        >
          <SelectTrigger id="video-style" className="w-full max-w-md">
            <SelectValue placeholder="Choisir un style" />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {quotaReached ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Quota atteint. Passez à Pro pour continuer à générer des vidéos.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!showRegenerate ? (
          <Button
            type="button"
            variant="bentoAccent"
            disabled={loading || quotaReached}
            onClick={() => void runGenerate(false)}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Génération…
              </>
            ) : (
              <>
                <Sparkles />
                Générer la vidéo
              </>
            )}
          </Button>
        ) : null}

        {showRegenerate ? (
          <Button
            type="button"
            variant="outline"
            disabled={loading || quotaReached}
            onClick={() => void runGenerate(true)}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Régénération…
              </>
            ) : (
              <>
                <RefreshCw />
                Régénérer
              </>
            )}
          </Button>
        ) : null}
      </div>

      {videoUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <video
            src={videoUrl}
            controls
            playsInline
            className="aspect-[9/16] max-h-[480px] w-full bg-black object-contain"
          />
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Ouvrir la vidéo
            </a>
          </p>
        </div>
      ) : null}
    </div>
  )
}
