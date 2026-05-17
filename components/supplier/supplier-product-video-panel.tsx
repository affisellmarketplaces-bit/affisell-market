"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Film, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type VideoRow = {
  id: string
  jobId: string | null
  status: string
  format: string
  videoUrl: string | null
  thumbnailUrl: string | null
  prompt: string
  createdAt: string
}

type Props = {
  productId: string
  productName: string
}

const FORMATS = ["9:16", "1:1", "16:9"] as const

export function SupplierProductVideoPanel({ productId, productName }: Props) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("Pub TikTok, unboxing, montre le titane")
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("9:16")
  const [generating, setGenerating] = useState(false)
  const [videos, setVideos] = useState<VideoRow[]>([])
  const [polling, setPolling] = useState(false)

  const loadVideos = useCallback(async () => {
    const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}/videos`, {
      credentials: "include",
      cache: "no-store",
    })
    if (!res.ok) return
    const data = (await res.json()) as { videos?: VideoRow[] }
    setVideos(Array.isArray(data.videos) ? data.videos : [])
  }, [productId])

  useEffect(() => {
    void loadVideos()
  }, [loadVideos])

  useEffect(() => {
    const processing = videos.some((v) => v.status === "PROCESSING")
    if (!processing) {
      setPolling(false)
      return
    }
    setPolling(true)
    const t = window.setInterval(() => {
      void loadVideos()
    }, 4_000)
    return () => window.clearInterval(t)
  }, [videos, loadVideos])

  async function handleGenerate() {
    if (prompt.trim().length < 8) {
      toast.error("Décrivez la pub en au moins 8 caractères.")
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}/generate-video`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), format }),
      })
      const data = (await res.json()) as { error?: string; jobId?: string; video?: VideoRow }
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      toast.success("Génération lancée — la vidéo sera prête dans quelques instants.")
      setOpen(false)
      if (data.video) setVideos((prev) => [data.video!, ...prev.filter((v) => v.id !== data.video!.id)])
      void loadVideos()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la génération")
    } finally {
      setGenerating(false)
    }
  }

  const latestDone = videos.find((v) => v.status === "DONE" && v.videoUrl)

  return (
    <section className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:to-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            <Film className="h-5 w-5 text-violet-600" aria-hidden />
            Vidéo pub Meta AI
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Créez une vidéo verticale ou carrée pour TikTok / Meta Ads à partir de « {productName} ».
          </p>
        </div>
        <Button type="button" className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => setOpen(true)}>
          <Sparkles className="h-4 w-4" aria-hidden />
          Générer vidéo IA
        </Button>
      </div>

      {polling ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Génération en cours…
        </p>
      ) : null}

      {latestDone?.videoUrl ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-black/5 dark:border-zinc-700">
          <video
            src={latestDone.videoUrl}
            poster={latestDone.thumbnailUrl ?? undefined}
            controls
            playsInline
            className="aspect-[9/16] max-h-[420px] w-full bg-black object-contain sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-2 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <a
              href={latestDone.videoUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-violet-700 underline dark:text-violet-300"
            >
              Télécharger la vidéo
            </a>
            <span className="text-xs text-zinc-500">{latestDone.format}</span>
          </div>
        </div>
      ) : videos.some((v) => v.status === "FAILED") ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          La dernière génération a échoué. Réessayez avec un autre prompt.
        </p>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="video-gen-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
            <h3 id="video-gen-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Générer une vidéo pub
            </h3>
            <p className="mt-1 text-sm text-zinc-500">Meta AI · {productName}</p>

            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="video-prompt">Prompt créatif</Label>
                <textarea
                  id="video-prompt"
                  className="mt-1.5 min-h-[100px] w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Pub TikTok, unboxing, montre le titane"
                />
              </div>
              <div>
                <Label htmlFor="video-format">Format</Label>
                <select
                  id="video-format"
                  className="mt-1.5 flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as (typeof FORMATS)[number])}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f === "9:16" ? "9:16 (TikTok / Reels)" : f === "1:1" ? "1:1 (Feed)" : "16:9 (YouTube)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={generating}>
                Annuler
              </Button>
              <Button
                type="button"
                className="gap-2 bg-violet-600 hover:bg-violet-700"
                disabled={generating}
                onClick={() => void handleGenerate()}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-zinc-500">
        <Link href={`/dashboard/supplier/products/new?edit=${productId}`} className="underline">
          Modifier la fiche produit
        </Link>
      </p>
    </section>
  )
}
