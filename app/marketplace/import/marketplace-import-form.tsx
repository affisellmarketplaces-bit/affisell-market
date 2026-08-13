"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"
import { Loader2, Sparkles, Link2, CheckCircle2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ImportPhase = "idle" | "scraping" | "ai" | "success" | "error"

type ImportSuccess = {
  productId: string
  listingId: string
  slug: string
  previewUrl: string
  adminProductUrl: string
  title: string
  imageUrl: string | null
  isShoeProduct: boolean
  sellingPriceEur: number
  method: string
  warnings: string[]
}

const GLASS =
  "w-full rounded-2xl border border-violet-200/50 dark:border-violet-800/30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl p-5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)]"

export function MarketplaceImportForm() {
  const [url, setUrl] = useState("")
  const [phase, setPhase] = useState<ImportPhase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportSuccess | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAiTimer = useCallback(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
      aiTimerRef.current = null
    }
  }, [])

  const handleImport = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError("Colle une URL AliExpress produit.")
      setPhase("error")
      return
    }

    setError(null)
    setResult(null)
    setPublishedUrl(null)
    setPhase("scraping")
    clearAiTimer()
    aiTimerRef.current = setTimeout(() => setPhase("ai"), 2200)

    try {
      const res = await fetch("/api/marketplace/import-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = (await res.json().catch(() => ({}))) as ImportSuccess & {
        error?: string
        retry_after_sec?: number
      }

      clearAiTimer()

      if (!res.ok) {
        const msg =
          data.error ??
          (res.status === 429
            ? `Limite atteinte — réessayez dans ${data.retry_after_sec ?? 60} s.`
            : "Import échoué.")
        setError(msg)
        setPhase("error")
        return
      }

      setResult(data)
      setPhase("success")
    } catch (e) {
      clearAiTimer()
      setError(e instanceof Error ? e.message : "Erreur réseau")
      setPhase("error")
    }
  }

  const handlePublish = async () => {
    if (!result) return
    setPublishing(true)
    setError(null)
    try {
      const res = await fetch("/api/marketplace/import-from-url/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: result.listingId, productId: result.productId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        previewUrl?: string
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? "Publication échouée")
        setPhase("error")
        return
      }
      setPublishedUrl(data.previewUrl ?? result.previewUrl.replace("?preview=affiliate", ""))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
      setPhase("error")
    } finally {
      setPublishing(false)
    }
  }

  const isLoading = phase === "scraping" || phase === "ai"

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 md:py-14">
      <div className={GLASS}>
        <div className="mb-5 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60">
            <Sparkles className="size-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Import AliExpress 1-clic
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              URL produit → fiche FR optimisée SEO → brouillon marketplace (DRAFT).
            </p>
          </div>
        </div>

        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          URL AliExpress
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.aliexpress.com/item/1005012670002032.html"
              className="h-11 pl-10"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading) void handleImport()
              }}
            />
          </div>
          <Button
            type="button"
            className="h-11 shrink-0 bg-violet-600 hover:bg-violet-700"
            disabled={isLoading || !url.trim()}
            onClick={() => void handleImport()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Import…
              </>
            ) : (
              "Importer"
            )}
          </Button>
        </div>

        {isLoading ? (
          <div
            className="mt-5 flex items-center gap-3 rounded-xl border border-violet-200/40 bg-violet-50/60 px-4 py-3 dark:border-violet-800/30 dark:bg-violet-950/30"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="size-4 shrink-0 animate-spin text-violet-600" />
            <span className="text-sm font-medium text-violet-900 dark:text-violet-100">
              {phase === "scraping" ? "Scraping…" : "Génération IA…"}
            </span>
          </div>
        ) : null}

        {phase === "success" && result ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
              <span className="font-semibold">Créé !</span>
              {result.isShoeProduct ? (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  Chaussures
                </span>
              ) : null}
            </div>

            <div
              className={cn(
                GLASS,
                "flex flex-col gap-4 sm:flex-row sm:items-center border-emerald-200/40 dark:border-emerald-900/30"
              )}
            >
              {result.imageUrl ? (
                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  <Image
                    src={result.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="96px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800">
                  Sans image
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-50">
                  {result.title}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {result.sellingPriceEur.toFixed(2)} € · {result.method} · brouillon
                </p>
                {result.warnings.length > 0 ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    {result.warnings[0]}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={publishedUrl ?? result.adminProductUrl}>
                    {publishedUrl ? "Voir fiche" : "Voir brouillon admin"}
                  </Link>
                </Button>
                {!publishedUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={publishing}
                    onClick={() => void handlePublish()}
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Publication…
                      </>
                    ) : (
                      "Publier"
                    )}
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-emerald-600">Publié ✓</span>
                )}
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              Admin :{" "}
              <Link href={result.adminProductUrl} className="underline hover:text-zinc-700">
                {result.adminProductUrl}
              </Link>
            </p>
          </div>
        ) : null}

        {phase === "error" && error ? (
          <div
            className="mt-5 flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
