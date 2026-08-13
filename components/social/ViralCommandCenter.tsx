"use client"

import { AlertTriangle, Copy, ExternalLink, Sparkles, Zap } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { BubbleProductCard, type BubbleProductCardProduct } from "@/components/product/BubbleProductCard"
import { LiveProfitCalculator } from "@/components/product/LiveProfitCalculator"
import { CreateStoreButton } from "@/components/store/CreateStoreButton"
import { ViralAssetCard } from "@/components/social/ViralAssetCard"
import { ViralCarousel } from "@/components/social/ViralCarousel"
import type { SocialAssetsBundle } from "@/lib/social/bubble-product-types"
import {
  downloadViralVideoBlob,
  previewViralVideoBlob,
  recordViralCarouselVideo,
} from "@/lib/social/generate-video"
import { previewViralGifBlob, recordViralBubbleGif } from "@/lib/social/generate-gif"
import { downloadViralLaunchKit } from "@/lib/social/viral-kit-zip"
import { computeViralPulse } from "@/lib/social/viral-pulse"
import { copyTextReliable, shareOrDownloadFile } from "@/lib/social/viral-share"
import { parseSocialAssetKey } from "@/lib/social/platform-keys"
import { getFallbackSocialAssetsBundle } from "@/lib/social/social-assets-fallback"
import type { ViralMedia } from "@/types/product"

type BundlePayload = SocialAssetsBundle & {
  failedKeys?: string[]
  okCount?: number
  fallback?: boolean
}

type Props = {
  product: BubbleProductCardProduct & {
    bubbleUrl: string
    costPrice?: number | null
    medias?: ViralMedia[]
    listingId?: string | null
    storeSlug?: string | null
    storeName?: string | null
    boutiqueUrl?: string | null
    boutiqueHostLabel?: string | null
  }
  /** Deep-link from BubbleShareBar — e.g. story_1080x1920 or story */
  initialFormat?: string | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function rewriteCaptionsForPrice(
  captions: SocialAssetsBundle["captions"],
  oldPrice: number,
  newPrice: number
): SocialAssetsBundle["captions"] {
  const from = `${oldPrice.toFixed(0)}€`
  const to = `${newPrice.toFixed(0)}€`
  const swap = (s: string) => s.replaceAll(from, to)
  return {
    moneyHook: swap(captions.moneyHook),
    problemHook: swap(captions.problemHook),
    trendHook: swap(captions.trendHook),
  }
}

function pulseRingClass(band: "ignition" | "charged" | "launch") {
  if (band === "launch") return "from-emerald-400 via-cyan-400 to-violet-500"
  if (band === "charged") return "from-violet-500 via-fuchsia-500 to-amber-400"
  return "from-zinc-400 via-zinc-500 to-violet-400"
}

export function ViralCommandCenter({ product, initialFormat = null }: Props) {
  const cost =
    product.costPrice ?? Math.max(0, product.salePrice - (product.marginEuro ?? 0))
  const [livePrice, setLivePrice] = useState(product.salePrice)
  const [bundle, setBundle] = useState<BundlePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanding, setExpanding] = useState(false)
  const [aiPaused, setAiPaused] = useState(false)
  const [exportingVideo, setExportingVideo] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportingGif, setExportingGif] = useState(false)
  const [gifProgress, setGifProgress] = useState(0)
  const [kitBusy, setKitBusy] = useState(false)
  const [kitProgress, setKitProgress] = useState(0)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState({
    instagram: true,
    tiktok: true,
    pinterest: true,
    facebook: true,
  })
  const deepLinkHandled = useRef(false)

  const medias: ViralMedia[] = useMemo(() => {
    if (product.medias && product.medias.length > 0) return product.medias
    if (product.imageUrl) return [{ type: "image", url: product.imageUrl, duration: 1200 }]
    return []
  }, [product.medias, product.imageUrl])

  const liveProduct: BubbleProductCardProduct & { bubbleUrl: string } = {
    ...product,
    salePrice: livePrice,
    marginEuro: Math.max(0, Math.round((livePrice - cost) * 100) / 100),
    costPrice: cost,
  }

  const applyFallback = useCallback(
    (reason: string) => {
      const fallback = getFallbackSocialAssetsBundle({
        id: product.id,
        title: product.title,
        imageUrl: product.imageUrl,
        salePrice: livePrice,
        costPrice: cost,
        marginEuro: Math.max(0, Math.round((livePrice - cost) * 100) / 100),
        bubbleUrl: product.bubbleUrl,
      })
      console.error("[SOCIAL_ASSETS_ERROR]", { productId: product.id, reason, fallback: true })
      setBundle(fallback)
      setAiPaused(true)
      return fallback
    },
    [product, livePrice, cost]
  )

  const fetchBundle = useCallback(
    async (priorityOnly: boolean): Promise<BundlePayload> => {
      const qs = priorityOnly ? "?priority=1" : ""
      let lastError: Error | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(
            `/api/products/${encodeURIComponent(product.id)}/social-assets${qs}`
          )
          const data = (await res.json().catch(() => null)) as
            | (BundlePayload & { error?: string; message?: string })
            | null
          if (!res.ok || !data || data.error) {
            const detail = data?.message || data?.error || `http_${res.status}`
            throw new Error(detail)
          }
          if (!Array.isArray(data.assets) || data.assets.length === 0) {
            throw new Error("empty_bundle")
          }
          return data
        } catch (err) {
          lastError = err instanceof Error ? err : new Error("generate_failed")
          console.error("[SOCIAL_ASSETS_ERROR]", {
            productId: product.id,
            attempt: attempt + 1,
            error: lastError.message,
          })
          if (attempt < 2) await sleep(400 * 2 ** attempt)
        }
      }

      throw lastError ?? new Error("generate_failed")
    },
    [product.id]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setAiPaused(false)
    setExpanding(false)
    try {
      const priority = await fetchBundle(true)
      setBundle(priority)
      setAiPaused(Boolean(priority.fallback))
      setLoading(false)
      console.log("[viral-command]", {
        event: "priority_assets_ready",
        productId: product.id,
        count: priority.assets.length,
        mediaCount: medias.length,
        fallback: priority.fallback ?? false,
      })

      if (priority.fallback) return

      setExpanding(true)
      try {
        const full = await fetchBundle(false)
        setBundle(full)
        setAiPaused(Boolean(full.fallback))
        console.log("[viral-command]", {
          event: "full_assets_ready",
          productId: product.id,
          okCount: full.okCount,
          failedKeys: full.failedKeys,
        })
      } catch (expandErr) {
        console.error("[viral-command]", {
          event: "expand_failed",
          error: expandErr instanceof Error ? expandErr.message : "expand_failed",
        })
      } finally {
        setExpanding(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "generate_failed"
      console.error("[viral-command]", { event: "generate_failed", error: message })
      applyFallback(message)
      setLoading(false)
    }
  }, [fetchBundle, product.id, applyFallback, medias.length])

  useEffect(() => {
    void load()
  }, [load])

  const liveCaptions = useMemo(() => {
    if (!bundle) return null
    return rewriteCaptionsForPrice(bundle.captions, product.salePrice, livePrice)
  }, [bundle, product.salePrice, livePrice])

  const captionsTxt = useMemo(() => {
    if (!bundle || !liveCaptions) return ""
    return [
      "=== Hook argent ===",
      liveCaptions.moneyHook,
      "",
      "=== Hook problème ===",
      liveCaptions.problemHook,
      "",
      "=== Hook trend ===",
      liveCaptions.trendHook,
      "",
      `=== Lien bubble ===`,
      product.bubbleUrl,
      "",
      "=== Par asset ===",
      ...bundle.assets.map((a) => {
        const cap = a.caption.replaceAll(`${product.salePrice.toFixed(0)}€`, `${livePrice.toFixed(0)}€`)
        return `[${a.key}]\n${cap}\n`
      }),
    ].join("\n")
  }, [bundle, liveCaptions, product.salePrice, livePrice, product.bubbleUrl])

  const netMargin = Math.max(0, Math.round((livePrice - cost) * 100) / 100)

  const pulse = useMemo(
    () =>
      computeViralPulse({
        mediaCount: medias.length,
        assetCount: bundle?.assets.length ?? 0,
        captionChars: captionsTxt.length,
        salePrice: livePrice,
        netMarginEuro: netMargin,
        aiPaused,
      }),
    [medias.length, bundle?.assets.length, captionsTxt.length, livePrice, netMargin, aiPaused]
  )

  useEffect(() => {
    if (!bundle || loading || deepLinkHandled.current) return
    const raw = initialFormat?.trim()
    if (!raw) return
    const key = parseSocialAssetKey(raw)
    if (!key) return
    const found = bundle.assets.some((a) => a.key === key)
    if (!found) return
    deepLinkHandled.current = true
    setHighlightKey(key)
    window.requestAnimationFrame(() => {
      document.getElementById(`viral-asset-${key}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    })
    toast.message("Format ciblé", { description: key.replaceAll("_", " ") })
    console.log("[viral-command]", { event: "format_deeplink", productId: product.id, key })
  }, [bundle, loading, initialFormat, product.id])

  const copyCaption = async (text: string) => {
    const ok = await copyTextReliable(text)
    if (ok) toast.success("Caption copiée")
    else toast.error("Impossible de copier — sélectionne le texte manuellement")
  }

  const exportReel = async () => {
    if (medias.length === 0 || exportingVideo || exportingGif || kitBusy) return
    setExportingVideo(true)
    setExportProgress(0)
    try {
      await fetch(`/api/social/generate?productId=${encodeURIComponent(product.id)}`).catch(
        () => null
      )
      const result = await recordViralCarouselVideo({
        medias,
        width: 1080,
        height: 1920,
        fps: 30,
        onProgress: setExportProgress,
      })
      downloadViralVideoBlob(result.blob, `${product.id}-reel`, result.ext)
      previewViralVideoBlob(result.blob)
      toast.success("Reel H.264 prêt", { description: "Fichier MP4 téléchargé" })
      console.log("[viral-command]", {
        event: "reel_exported_h264",
        productId: product.id,
        bytes: result.bytes,
        codec: result.codec,
        ext: result.ext,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "export_failed"
      console.error("[viral-command]", { event: "reel_export_failed", error: message })
      const friendly =
        message === "h264_unavailable"
          ? "Ton navigateur ne peut pas encoder H.264. Ouvre Chrome / Edge / Safari récents."
          : message.includes("image_load_failed") || message.includes("Security")
            ? "Export bloqué (CORS image). Réessaie — on fetch les médias en CORS."
            : message === "invalid_mp4_container"
              ? "Fichier MP4 invalide (garde-fou). Réessaie l’export."
              : `Export vidéo échoué: ${message}`
      toast.error(friendly)
    } finally {
      setExportingVideo(false)
      setExportProgress(0)
    }
  }

  const exportGif = async () => {
    if (medias.length === 0 || exportingGif || exportingVideo || kitBusy) return
    setExportingGif(true)
    setGifProgress(0)
    try {
      const result = await recordViralBubbleGif({
        medias,
        title: product.title,
        salePrice: livePrice,
        width: 540,
        height: 960,
        fps: 10,
        onProgress: setGifProgress,
      })
      const shareResult = await shareOrDownloadFile({
        blob: result.blob,
        filename: `${product.id}-bubble.gif`,
        title: product.title,
        text: `${liveCaptions?.moneyHook ?? product.title}\n${product.bubbleUrl}`,
        mimeType: "image/gif",
      })
      if (shareResult === "downloaded") {
        previewViralGifBlob(result.blob)
        toast.success("GIF prêt", { description: "Téléchargé — ouvre WhatsApp et joins le fichier" })
      } else if (shareResult === "shared") {
        toast.success("Partagé", { description: "Feuille native · WhatsApp / Messages / Fichiers" })
      }
      console.log("[viral-command]", {
        event: "gif_exported",
        productId: product.id,
        bytes: result.bytes,
        frames: result.frames,
        shareResult,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "gif_failed"
      console.error("[viral-command]", { event: "gif_export_failed", error: message })
      toast.error(
        message.includes("image_load_failed")
          ? "GIF bloqué (CORS image)."
          : `Export GIF échoué: ${message}`
      )
    } finally {
      setExportingGif(false)
      setGifProgress(0)
    }
  }

  const downloadKit = async () => {
    if (!bundle || kitBusy) return
    const selected = Object.entries(platforms)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (selected.length === 0) {
      toast.error("Sélectionne au moins un réseau")
      return
    }
    setKitBusy(true)
    setKitProgress(0)
    try {
      await fetch(`/api/products/${encodeURIComponent(product.id)}/social-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: selected }),
      }).catch(() => null)

      const result = await downloadViralLaunchKit({
        productId: product.id,
        assets: bundle.assets,
        platforms: selected,
        captionsTxt,
        onProgress: (p) => setKitProgress(p.ratio),
      })
      toast.success("Kit viral téléchargé", {
        description: `${result.fileCount} fichiers · captions + README`,
      })
      console.log("[viral-command]", {
        event: "launch_kit_ready",
        productId: product.id,
        platforms: selected,
        keys: result.keys,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "kit_failed"
      console.error("[viral-command]", { event: "kit_failed", error: message })
      toast.error(message === "empty_kit" ? "Aucun asset sélectionné" : `Kit échoué: ${message}`)
    } finally {
      setKitBusy(false)
      setKitProgress(0)
    }
  }

  const runPulseAction = () => {
    if (pulse.nextAction === "price") {
      document.getElementById("viral-profit")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    if (pulse.nextAction === "gif") void exportGif()
    else if (pulse.nextAction === "reel") void exportReel()
    else void downloadKit()
  }

  const copyBoutiqueUrl = useCallback(async () => {
    const url = product.boutiqueUrl?.trim()
    if (!url) {
      toast.error("Liste d'abord ce produit pour générer ta boutique checkout.")
      return
    }
    const ok = await copyTextReliable(url)
    if (ok) {
      toast.success("Lien boutique copié", { description: product.boutiqueHostLabel ?? url })
    } else {
      toast.error("Copie impossible", { description: "Copiez le lien manuellement." })
    }
  }, [product.boutiqueHostLabel, product.boutiqueUrl])

  return (
    <div className="relative mx-auto max-w-5xl space-y-10 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_55%)]"
      />

      <header className="flex flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200">
            <Sparkles className="size-3" aria-hidden />
            Viral Autopilot
          </p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
            Rendre viral
          </h1>
          <p className="mx-auto max-w-md text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Gagnez du temps, des millions de vues, et de l&apos;argent — pack prêt à poster, marge
            jamais exposée.
          </p>
        </div>

        <div
          className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-8"
          aria-live="polite"
        >
          <div className="relative">
            <div
              className={`absolute -inset-1 rounded-full bg-gradient-to-br ${pulseRingClass(pulse.band)} opacity-80 blur-[2px]`}
            />
            <div className="relative flex size-[88px] flex-col items-center justify-center rounded-full bg-zinc-950 text-white shadow-xl ring-2 ring-white/10">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Pulse
              </span>
              <span className="text-2xl font-black tabular-nums">{pulse.score}</span>
              <span className="text-[10px] font-medium text-zinc-400">{pulse.label}</span>
            </div>
          </div>
          <div className="max-w-xs text-left text-xs text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-white">Prochaine action</p>
            <p className="mt-0.5">{pulse.nextLabel}</p>
            <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
              {pulse.signals.slice(0, 3).map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={runPulseAction}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-500/25"
            >
              <Zap className="size-3.5" aria-hidden />
              Autopilot
            </button>
          </div>
        </div>

        {medias.length > 0 ? (
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl ring-1 ring-violet-500/30">
            <ViralCarousel medias={medias} autoPlay shape="rect" className="absolute inset-0 rounded-[2rem]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-16 text-left">
              <p className="line-clamp-2 text-sm font-semibold text-white">{product.title}</p>
              <p className="mt-1 text-lg font-black text-white">{livePrice.toFixed(0)}€</p>
            </div>
          </div>
        ) : (
          <BubbleProductCard
            product={liveProduct}
            variant="bubble-card"
            showShareBar
            audience="client"
          />
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={exportingGif || exportingVideo || kitBusy || medias.length === 0}
            onClick={() => void exportGif()}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {exportingGif
              ? `GIF animé… ${Math.round(gifProgress * 100)}%`
              : "Partager GIF · WhatsApp"}
          </button>
          <button
            type="button"
            disabled={exportingVideo || exportingGif || kitBusy || medias.length === 0}
            onClick={() => void exportReel()}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {exportingVideo
              ? `Encodage H.264… ${Math.round(exportProgress * 100)}%`
              : "Exporter Reel · H.264"}
          </button>
          <BubbleProductCard
            product={liveProduct}
            variant="bubble-mini"
            showShareBar={false}
            audience="client"
            className="!h-16 !w-16"
          />
        </div>
        <p className="max-w-md text-center text-[11px] text-zinc-500">
          GIF = share sheet native (autoplay DM). MP4 = TikTok / Reels / QuickTime. PNG = couverture
          fixe.
        </p>
      </header>

      <section id="viral-profit" className="mx-auto max-w-md scroll-mt-24">
        <h2 className="mb-3 text-lg font-bold text-zinc-900 dark:text-white">
          Prix &amp; bénéfice net
        </h2>
        <LiveProfitCalculator
          cost={cost}
          suggestedPrice={product.salePrice}
          onPriceChange={setLivePrice}
        />
        {product.listingId ? (
          <div className="mt-4 rounded-2xl border border-violet-200/70 bg-violet-50/80 p-4 dark:border-violet-800/50 dark:bg-violet-950/30">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200">
              Boutique checkout 1-clic
            </p>
            {product.boutiqueHostLabel ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-violet-200/80 bg-white/90 px-3 py-2 dark:border-violet-900/60 dark:bg-zinc-950/80">
                <code className="min-w-0 flex-1 truncate text-xs font-semibold text-violet-900 dark:text-violet-100">
                  {product.boutiqueHostLabel}?productId={product.listingId}
                </code>
                <button
                  type="button"
                  onClick={() => void copyBoutiqueUrl()}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950"
                  aria-label="Copier le lien boutique"
                >
                  <Copy className="size-3.5" aria-hidden />
                </button>
                {product.boutiqueUrl ? (
                  <a
                    href={product.boutiqueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950"
                    aria-label="Ouvrir la boutique"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-violet-800 dark:text-violet-200">
                Configure le slug de ta boutique dans Brand Studio pour activer le lien public.
              </p>
            )}
            <div className="mt-3">
              <CreateStoreButton
                productId={product.listingId}
                defaultSlug={product.storeSlug}
                defaultStoreName={product.storeName}
                variant="compact"
                className="w-full"
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            Publie ce produit dans ton catalogue pour débloquer la boutique checkout.
          </p>
        )}
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Zone privée — le slider met à jour le prix client des captions, jamais ta marge sur les
          PNG / Reel.
        </p>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Assets générés auto</h2>
          {expanding ? (
            <p className="text-xs font-medium text-violet-600 dark:text-violet-300">
              Pack complet en cours… {bundle?.assets.length ?? 0}/12
            </p>
          ) : null}
        </div>

        {aiPaused ? (
          <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-100">Génération IA en pause</p>
              <p className="text-sm text-amber-700 dark:text-amber-200/90">
                On affiche les templates de base (prix client uniquement). Ta marge reste privée.
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 text-sm font-semibold text-amber-900 underline underline-offset-2 dark:text-amber-100"
              >
                Réessayer
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-white p-6 dark:border-violet-900/40 dark:from-violet-950/40 dark:to-zinc-950">
              <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                Génération du pack viral…
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Story · Feed · TikTok d&apos;abord — carrousel ciné sur chaque carte.
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="aspect-video animate-pulse bg-zinc-100 dark:bg-zinc-900" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-8 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {bundle && !loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.assets.map((asset) => (
              <ViralAssetCard
                key={asset.key}
                asset={asset}
                medias={medias}
                productId={product.id}
                productTitle={product.title}
                livePrice={livePrice}
                baseSalePrice={product.salePrice}
                fallback={Boolean(bundle.fallback)}
                highlighted={highlightKey === asset.key}
                onCopyCaption={(text) => void copyCaption(text)}
              />
            ))}
          </div>
        ) : null}
        {bundle?.failedKeys && bundle.failedKeys.length > 0 && !bundle.fallback ? (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {bundle.failedKeys.length} format(s) non générés — le reste est prêt.
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-violet-50/40 p-6 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/20">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Kit de lancement</h2>
          <span className="rounded-full bg-zinc-900/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-white dark:text-zinc-900">
            1-clic
          </span>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          ZIP prêt à poster (PNG sélectionnés + captions + README). Publication OAuth native = P1 —
          aujourd&apos;hui tu gagnes le temps Amazon Influencer.
        </p>
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          {(Object.keys(platforms) as Array<keyof typeof platforms>).map((p) => (
            <label key={p} className="inline-flex items-center gap-2 capitalize">
              <input
                type="checkbox"
                checked={platforms[p]}
                onChange={(e) => setPlatforms((prev) => ({ ...prev, [p]: e.target.checked }))}
              />
              {p}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={kitBusy || !bundle || loading}
          onClick={() => void downloadKit()}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {kitBusy
            ? `Packaging… ${Math.round(kitProgress * 100)}%`
            : `Télécharger le kit · ${Object.values(platforms).filter(Boolean).length} réseaux`}
        </button>
        {liveCaptions ? (
          <div className="mt-6 space-y-3 text-left text-sm text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-white">Captions AI</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-white/80 p-3 text-xs dark:bg-zinc-900/80">
              {liveCaptions.moneyHook}
            </pre>
            <button
              type="button"
              className="text-xs font-semibold underline"
              onClick={() => void copyCaption(captionsTxt)}
            >
              Copier les 3 hooks + lien bubble
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
