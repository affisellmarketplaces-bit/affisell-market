"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"

import { BubbleProductCard, type BubbleProductCardProduct } from "@/components/product/BubbleProductCard"
import { LiveProfitCalculator } from "@/components/product/LiveProfitCalculator"
import type { SocialAssetsBundle } from "@/lib/social/bubble-product-types"

type BundlePayload = SocialAssetsBundle & {
  failedKeys?: string[]
  okCount?: number
}

type Props = {
  product: BubbleProductCardProduct & { bubbleUrl: string; costPrice?: number | null }
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

export function ViralCommandCenter({ product }: Props) {
  const cost =
    product.costPrice ?? Math.max(0, product.salePrice - (product.marginEuro ?? 0))
  const [livePrice, setLivePrice] = useState(product.salePrice)
  const [bundle, setBundle] = useState<BundlePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanding, setExpanding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platforms, setPlatforms] = useState({
    instagram: true,
    tiktok: true,
    pinterest: true,
    facebook: true,
  })

  const liveProduct: BubbleProductCardProduct & { bubbleUrl: string } = {
    ...product,
    salePrice: livePrice,
    marginEuro: Math.max(0, Math.round((livePrice - cost) * 100) / 100),
    costPrice: cost,
  }

  const fetchBundle = useCallback(async (priorityOnly: boolean): Promise<BundlePayload> => {
    const qs = priorityOnly ? "?priority=1" : ""
    const res = await fetch(`/api/products/${encodeURIComponent(product.id)}/social-assets${qs}`)
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
  }, [product.id])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setExpanding(false)
    try {
      // Fast path: 4 hero formats first → perceived success in ~1–2s
      const priority = await fetchBundle(true)
      setBundle(priority)
      setLoading(false)
      console.log("[viral-command]", {
        event: "priority_assets_ready",
        productId: product.id,
        count: priority.assets.length,
      })

      // Expand to full 12-pack without blocking the UI
      setExpanding(true)
      try {
        const full = await fetchBundle(false)
        setBundle(full)
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
        // Keep priority pack — still usable
      } finally {
        setExpanding(false)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "generate_failed"
      console.error("[viral-command]", { event: "generate_failed", error: message })
      setError("Impossible de générer les assets.")
      setBundle(null)
      setLoading(false)
    }
  }, [fetchBundle, product.id])

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
      "=== Par asset ===",
      ...bundle.assets.map((a) => {
        const cap = a.caption.replaceAll(`${product.salePrice.toFixed(0)}€`, `${livePrice.toFixed(0)}€`)
        return `[${a.key}]\n${cap}\n`
      }),
    ].join("\n")
  }, [bundle, liveCaptions, product.salePrice, livePrice])

  const copyCaption = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  const downloadCaptionsFile = () => {
    const blob = new Blob([captionsTxt], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${product.id}-captions.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const publishStub = async () => {
    const selected = Object.entries(platforms)
      .filter(([, v]) => v)
      .map(([k]) => k)
    await fetch(`/api/products/${encodeURIComponent(product.id)}/social-assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms: selected }),
    })
    downloadCaptionsFile()
    alert("P0: captions.txt téléchargé + images régénérées. OAuth publication = P1.")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10">
      <header className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Rendre viral</h1>
        <BubbleProductCard product={liveProduct} variant="bubble-card" showShareBar />
      </header>

      <section className="mx-auto max-w-md">
        <h2 className="mb-3 text-lg font-bold text-zinc-900 dark:text-white">Prix & bénéfice net</h2>
        <LiveProfitCalculator
          cost={cost}
          suggestedPrice={product.salePrice}
          onPriceChange={setLivePrice}
        />
        <p className="mt-2 text-center text-[11px] text-zinc-500">
          Le slider met à jour la bulle + captions (prix). Régénère les PNG après choix final.
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
        {loading ? (
          <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-white p-6 dark:border-violet-900/40 dark:from-violet-950/40 dark:to-zinc-950">
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
              Génération du pack viral…
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Story · Feed · TikTok · Pinterest d&apos;abord, puis le reste.
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
            <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400">
              Les templates OG ont été reforgés (Satori-safe). Un clic suffit.
            </p>
            <button
              type="button"
              className="mt-3 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
              onClick={() => void load()}
            >
              Réessayer
            </button>
          </div>
        ) : null}
        {bundle ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.assets.map((asset) => (
              <article
                key={asset.key}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900">
                  <Image
                    src={asset.publicUrl}
                    alt=""
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    {livePrice.toFixed(0)}€
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <p className="text-xs font-mono text-zinc-500">{asset.key}</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/api/products/${encodeURIComponent(product.id)}/social-assets/download?format=${encodeURIComponent(asset.key)}`}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Télécharger
                    </a>
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold dark:border-zinc-700"
                      onClick={() =>
                        void copyCaption(
                          asset.caption.replaceAll(
                            `${product.salePrice.toFixed(0)}€`,
                            `${livePrice.toFixed(0)}€`
                          )
                        )
                      }
                    >
                      Copier caption
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {bundle?.failedKeys && bundle.failedKeys.length > 0 ? (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {bundle.failedKeys.length} format(s) non générés — le reste est prêt.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-3 text-lg font-bold">Publier partout en 1-clic (P1 OAuth)</h2>
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
          onClick={() => void publishStub()}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-zinc-900"
        >
          Publier sur {Object.values(platforms).filter(Boolean).length} réseaux → (P0: zip captions)
        </button>
        {liveCaptions ? (
          <div className="mt-6 space-y-3 text-left text-sm text-zinc-600 dark:text-zinc-300">
            <p className="font-semibold text-zinc-900 dark:text-white">Captions live</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
              {liveCaptions.moneyHook}
            </pre>
            <button
              type="button"
              className="text-xs font-semibold underline"
              onClick={() => void copyCaption(captionsTxt)}
            >
              Copier les 3 hooks
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
