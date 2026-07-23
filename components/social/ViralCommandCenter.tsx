"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"

import { BubbleProductCard, type BubbleProductCardProduct } from "@/components/product/BubbleProductCard"
import { LiveProfitCalculator } from "@/components/product/LiveProfitCalculator"
import type { SocialAssetsBundle } from "@/lib/social/bubble-product-types"

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
  const [bundle, setBundle] = useState<SocialAssetsBundle | null>(null)
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(product.id)}/social-assets`)
      if (!res.ok) throw new Error("generate_failed")
      const data = (await res.json()) as SocialAssetsBundle
      setBundle(data)
    } catch {
      setError("Impossible de générer les assets.")
    } finally {
      setLoading(false)
    }
  }, [product.id])

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
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-white">Assets générés auto</h2>
        {loading ? <p className="text-sm text-zinc-500">Génération des 12 formats bulle…</p> : null}
        {error ? (
          <p className="text-sm text-red-600">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Réessayer
            </button>
          </p>
        ) : null}
        {bundle ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.assets.map((asset) => (
              <article
                key={asset.key}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-900">
                  <Image src={asset.publicUrl} alt="" fill className="object-contain" unoptimized />
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
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="mb-3 text-lg font-bold">Publier partout en 1-clic (P1 OAuth)</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(platforms) as (keyof typeof platforms)[]).map((key) => (
            <label key={key} className="flex items-center gap-2 capitalize">
              <input
                type="checkbox"
                checked={platforms[key]}
                onChange={(e) => setPlatforms((p) => ({ ...p, [key]: e.target.checked }))}
              />
              {key}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void publishStub()}
          className="mt-4 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white dark:bg-violet-600"
        >
          Publier sur {Object.values(platforms).filter(Boolean).length} réseaux → (P0: zip captions)
        </button>
      </section>

      {bundle && liveCaptions ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Caption virale IA</h2>
          {(
            [
              ["Hook argent", liveCaptions.moneyHook],
              ["Hook problème", liveCaptions.problemHook],
              ["Hook trend", liveCaptions.trendHook],
            ] as const
          ).map(([label, text]) => (
            <div key={label} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-bold uppercase text-violet-600">{label}</p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{text}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-violet-600 underline"
                onClick={() => void copyCaption(text)}
              >
                Copier
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={downloadCaptionsFile}
            className="text-sm font-semibold text-violet-600 underline"
          >
            Télécharger captions.txt (tous formats)
          </button>
        </section>
      ) : null}
    </div>
  )
}
