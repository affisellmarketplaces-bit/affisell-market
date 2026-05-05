"use client"

import { Camera, Loader2, Search, Upload, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import type { VisualSearchResult } from "@/lib/visual-search-types"

type Props = {
  open: boolean
  onClose: () => void
}

export function VisualSearchModal({ open, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<VisualSearchResult[]>([])

  useEffect(() => {
    if (!open) return
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  function resetFiles() {
    setPreview((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      return null
    })
    setFile(null)
    setResults([])
    setError(null)
    if (uploadInputRef.current) uploadInputRef.current.value = ""
    if (captureInputRef.current) captureInputRef.current.value = ""
  }

  function handleClose() {
    resetFiles()
    setLoading(false)
    onClose()
  }

  function attachImage(next: File) {
    if (!next.type.startsWith("image/") && next.type !== "" && next.type !== "application/octet-stream") {
      setError("Please choose an image file.")
      return
    }
    setError(null)
    setResults([])
    setFile(next)
    setPreview((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      return URL.createObjectURL(next)
    })
  }

  function handleDrop(ev: React.DragEvent) {
    ev.preventDefault()
    ev.stopPropagation()
    setDragOver(false)
    const f = ev.dataTransfer.files?.[0]
    if (f) attachImage(f)
  }

  async function runSearch() {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set("image", file)
      const res = await fetch("/api/search/visual", { method: "POST", body: fd })
      const data = (await res.json()) as { results?: VisualSearchResult[]; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Search failed.")
        setResults([])
        return
      }
      setResults(data.results ?? [])
    } catch {
      setError("Network error. Try again.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) handleClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visual-search-title"
        className="flex max-h-[min(90vh,800px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
              <Camera className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 id="visual-search-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                AI visual search
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Find similar products instantly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {!preview ? (
            <div
              onDragEnter={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 transition-colors ${
                dragOver
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                  : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/60"
              }`}
            >
              <Upload className="mb-3 h-10 w-10 text-zinc-400" aria-hidden />
              <p className="text-center text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Drop a product photo here
              </p>
              <p className="mt-1 text-center text-xs text-zinc-500">or upload / use your camera</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload photo
                </button>
                <button
                  type="button"
                  onClick={() => captureInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Camera className="h-4 w-4" />
                  Take photo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative mx-auto aspect-square max-h-[200px] w-full max-w-[200px] overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="h-full w-full object-contain p-2" />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="text-sm font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
                >
                  Choose different photo
                </button>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void runSearch()}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-violet-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing image…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Find similar products
                  </>
                )}
              </button>
            </div>
          )}

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) attachImage(f)
            }}
          />
          <input
            ref={captureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) attachImage(f)
            }}
          />

          {error ? <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          {results.length > 0 ? (
            <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Visual matches</p>
              <ul className="mt-3 space-y-3">
                {results.map((r) => (
                  <li key={r.listingId}>
                    <Link
                      href={`/marketplace/${r.listingId}`}
                      onClick={handleClose}
                      className="flex gap-3 rounded-xl border border-zinc-100 p-2 transition hover:border-violet-200 hover:bg-violet-50/50 dark:border-zinc-700 dark:hover:border-violet-800 dark:hover:bg-violet-950/30"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white dark:bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.imageUrl}
                          alt=""
                          className="h-full w-full object-contain p-1"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.title}</p>
                          <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            {r.matchScore}% match
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{r.priceDisplay}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
