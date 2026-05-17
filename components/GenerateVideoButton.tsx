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
import { FREE_VIDEO_LIMIT } from "@/lib/video-quota-constants"

export const VIDEO_STYLE_OPTIONS = [
  "TikTok unboxing, energetic",
  "Luxury cinematic, Parisian",
  "UGC style, handheld",
  "Studio product 360",
] as const

export type VideoQuotaInfo = {
  videoCount: number
  videoLimit: number
  remaining: number
  isPro: boolean
  /** @deprecated use videoCount */
  videoQuota?: number
  /** @deprecated use videoCount */
  videoUsed?: number
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
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null)
  const [selectedStyle, setSelectedStyle] = useState<string>(defaultStyle)
  const [quota, setQuota] = useState(initialQuota)

  const videoLimit = quota.isPro ? quota.videoLimit : FREE_VIDEO_LIMIT
  const remaining = quota.isPro ? Infinity : Math.max(0, videoLimit - quota.videoCount)
  const quotaReached = paywall || (!quota.isPro && quota.videoCount >= FREE_VIDEO_LIMIT)
  const showRegenerate = Boolean(videoUrl)

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/user/quota", { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as VideoQuotaInfo
      setQuota(data)
      setPaywall(!data.isPro && data.videoCount >= FREE_VIDEO_LIMIT)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  async function handleUpgradePro() {
    setCheckoutLoading(true)
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Impossible de démarrer le paiement")
      }
      window.location.href = data.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du checkout Pro")
      setCheckoutLoading(false)
    }
  }

  function applyQuotaFromResponse(data: {
    videoCount?: number
    videoLimit?: number
    remaining?: number
    isPro?: boolean
    videoUsed?: number
    videoQuota?: number
  }) {
    const count = data.videoCount ?? data.videoUsed
    if (typeof count !== "number") return
    const limit = data.videoLimit ?? data.videoQuota ?? FREE_VIDEO_LIMIT
    setQuota({
      videoCount: count,
      videoLimit: limit,
      remaining: data.remaining ?? Math.max(0, limit - count),
      isPro: Boolean(data.isPro),
    })
    setPaywall(!data.isPro && count >= FREE_VIDEO_LIMIT)
  }

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
        paywall?: boolean
        videoUrl?: string
        cached?: boolean
        videoCount?: number
        videoLimit?: number
        remaining?: number
        isPro?: boolean
        videoUsed?: number
        videoQuota?: number
      }

      if (res.status === 402 || data.paywall) {
        setPaywall(true)
        applyQuotaFromResponse(data)
        toast.error(data.error ?? "Quota atteint")
        return
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Video generation failed")
      }

      if (!data.videoUrl) {
        throw new Error("No video URL returned")
      }

      setVideoUrl(data.videoUrl)
      applyQuotaFromResponse(data)
      await refreshQuota()

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
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {Math.max(0, FREE_VIDEO_LIMIT - quota.videoCount)}
            </span>
            /{FREE_VIDEO_LIMIT} vidéos restantes
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
          disabled={loading || quotaReached}
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

      {quotaReached && !quota.isPro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Quota atteint. Passez à Pro pour des vidéos illimitées.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {quotaReached && !quota.isPro ? (
          <Button
            type="button"
            variant="bentoAccent"
            disabled={checkoutLoading || loading}
            onClick={() => void handleUpgradePro()}
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Redirection…
              </>
            ) : (
              <>Passer Pro — 29€/mois</>
            )}
          </Button>
        ) : null}

        {!showRegenerate && !(quotaReached && !quota.isPro) ? (
          <Button
            type="button"
            variant="bentoAccent"
            disabled={loading || checkoutLoading}
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

        {showRegenerate && !(quotaReached && !quota.isPro) ? (
          <Button
            type="button"
            variant="outline"
            disabled={loading || checkoutLoading}
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
