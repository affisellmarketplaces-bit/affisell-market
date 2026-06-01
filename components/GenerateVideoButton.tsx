"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { AttachProductVideoActions } from "@/components/attach-product-video-actions"
import {
  CreativeReferenceAssets,
  referencesToApiPayload,
  type CreativeReferenceAsset,
} from "@/components/CreativeReferenceAssets"
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

export const CUSTOM_STYLE_VALUE = "__custom__" as const
const MIN_STYLE_LENGTH = 8
const MAX_STYLE_LENGTH = 500

export type VideoQuotaInfo = {
  videoCount: number
  videoLimit: number
  remaining: number
  isPro: boolean
  paywallBypass?: boolean
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
  /** Images produit — sélection rapide comme référence visuelle */
  productImages?: string[]
  className?: string
}

function isPresetStyle(value: string): value is (typeof VIDEO_STYLE_OPTIONS)[number] {
  return (VIDEO_STYLE_OPTIONS as readonly string[]).includes(value)
}

function resolveInitialStyle(initialStyle?: string | null) {
  const trimmed = initialStyle?.trim() ?? ""
  if (trimmed && isPresetStyle(trimmed)) {
    return { mode: "preset" as const, preset: trimmed, custom: "" }
  }
  if (trimmed) {
    return { mode: "custom" as const, preset: VIDEO_STYLE_OPTIONS[1], custom: trimmed }
  }
  return { mode: "preset" as const, preset: VIDEO_STYLE_OPTIONS[1], custom: "" }
}

export function GenerateVideoButton({
  productId,
  productName,
  quota: initialQuota,
  initialVideoUrl,
  initialStyle,
  productImages = [],
  className,
}: Props) {
  const initial = useMemo(() => resolveInitialStyle(initialStyle), [initialStyle])
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [paywall, setPaywall] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl ?? null)
  const [styleMode, setStyleMode] = useState<"preset" | "custom">(initial.mode)
  const [selectedPreset, setSelectedPreset] = useState<string>(initial.preset)
  const [customStyle, setCustomStyle] = useState(initial.custom)
  const [quota, setQuota] = useState(initialQuota)
  const [references, setReferences] = useState<CreativeReferenceAsset[]>([])

  const selectValue = styleMode === "custom" ? CUSTOM_STYLE_VALUE : selectedPreset

  const effectiveStyle =
    styleMode === "custom" ? customStyle.trim() : selectedPreset.trim()

  const styleValid =
    effectiveStyle.length >= MIN_STYLE_LENGTH && effectiveStyle.length <= MAX_STYLE_LENGTH

  const quotaReached =
    paywall || (!quota.paywallBypass && !quota.isPro && quota.remaining <= 0)
  const showRegenerate = Boolean(videoUrl)

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/user/quota", { credentials: "include", cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as VideoQuotaInfo
      setQuota(data)
      setPaywall(!data.paywallBypass && !data.isPro && data.remaining <= 0)
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
    paywallBypass?: boolean
    videoUsed?: number
    videoQuota?: number
  }) {
    const count = data.videoCount ?? data.videoUsed
    if (typeof count !== "number") return
    const limit = data.videoLimit ?? data.videoQuota ?? FREE_VIDEO_LIMIT
    const remaining = data.remaining ?? Math.max(0, limit - count)
    setQuota({
      videoCount: count,
      videoLimit: limit,
      remaining,
      isPro: Boolean(data.isPro),
      paywallBypass: Boolean(data.paywallBypass),
    })
    setPaywall(!data.paywallBypass && !data.isPro && remaining <= 0)
  }

  async function runGenerate(regenerate: boolean) {
    if (!productId.trim() || !productName.trim()) {
      toast.error("Produit requis.")
      return
    }

    if (!effectiveStyle) {
      toast.error("Choisissez un style ou décrivez votre pub.")
      return
    }

    if (effectiveStyle.length < MIN_STYLE_LENGTH) {
      toast.error(`Décrivez votre pub en au moins ${MIN_STYLE_LENGTH} caractères.`)
      return
    }

    if (effectiveStyle.length > MAX_STYLE_LENGTH) {
      toast.error(`Maximum ${MAX_STYLE_LENGTH} caractères.`)
      return
    }

    if (quotaReached) {
      toast.error("Quota atteint. Upgrade Pro.")
      return
    }

    setLoading(true)
    if (regenerate) setVideoUrl(null)

    const body: Record<string, unknown> = {
      productId: productId.trim(),
      productName: productName.trim(),
      regenerate,
    }

    if (styleMode === "custom") {
      body.customPrompt = effectiveStyle
    } else {
      body.style = effectiveStyle
    }

    Object.assign(body, referencesToApiPayload(references))

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        router.replace(`${pathname}?upgrade=paywall`)
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
        {quota.paywallBypass ? (
          <span className="font-medium text-amber-800 dark:text-amber-300">
            Mode test — générations illimitées
          </span>
        ) : quota.isPro ? (
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
          Direction créative
        </label>
        <Select
          value={selectValue}
          onValueChange={(value) => {
            if (!value) return
            if (value === CUSTOM_STYLE_VALUE) {
              setStyleMode("custom")
              return
            }
            setStyleMode("preset")
            setSelectedPreset(value)
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
            <SelectItem value={CUSTOM_STYLE_VALUE}>Personnalisé…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {styleMode === "custom" ? (
        <div className="relative max-w-2xl overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 p-4 shadow-xl sm:p-5">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-fuchsia-600/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl"
            aria-hidden
          />

          <div className="relative space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/50">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Studio créatif personnalisé</p>
                <p className="text-[11px] text-zinc-400">
                  Prompt + références visuelles pour guider Veo
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="video-custom-style" className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                Votre prompt
              </label>
              <textarea
                id="video-custom-style"
                className="min-h-[110px] w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                disabled={loading || quotaReached}
                placeholder="Ex : slow motion sur fond noir, voix off française, ambiance premium, macro sur le produit…"
                maxLength={MAX_STYLE_LENGTH}
              />
              <p
                className={cn(
                  "text-xs",
                  styleValid ? "text-zinc-500" : "text-amber-400"
                )}
              >
                {effectiveStyle.length}/{MAX_STYLE_LENGTH} caractères
                {effectiveStyle.length > 0 && effectiveStyle.length < MIN_STYLE_LENGTH
                  ? ` — minimum ${MIN_STYLE_LENGTH}`
                  : null}
              </p>
            </div>

            <CreativeReferenceAssets
              variant="studio"
              productImages={productImages}
              references={references}
              onChange={setReferences}
              disabled={loading || quotaReached}
            />
          </div>
        </div>
      ) : (
        <CreativeReferenceAssets
          productImages={productImages}
          references={references}
          onChange={setReferences}
          disabled={loading || quotaReached}
        />
      )}

      {showRegenerate ? (
        <p className="text-xs text-muted-foreground">
          Pour appliquer un nouveau style, modifiez la direction puis cliquez sur Régénérer.
        </p>
      ) : null}

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
            disabled={loading || checkoutLoading || !styleValid}
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
            disabled={loading || checkoutLoading || !styleValid}
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
        <>
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
          <AttachProductVideoActions productId={productId} videoUrl={videoUrl} />
        </>
      ) : null}
    </div>
  )
}
