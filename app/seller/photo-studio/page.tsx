"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ImageIcon,
  Layers3,
  Sparkles,
  UploadCloud,
  Wand2,
} from "lucide-react"

type StudioMode = "remove-bg" | "enhance-pro" | "lifestyle" | "erase-text"
type StudioItem = {
  id: string
  file: File
  originalUrl: string
  processedUrl: string | null
  uploadedUrl: string | null
  progress: number
  status: "idle" | "processing" | "done" | "error"
  error?: string
}

const DAILY_LIMIT_FREE = 5
const STORAGE_KEY = "affisellStudioProcessedImages"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function canvasFromImage(src: string, filters = "none"): Promise<HTMLCanvasElement> {
  const img = await loadImage(src)
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  ctx.filter = filters
  ctx.drawImage(img, 0, 0)
  return canvas
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  return canvas.toDataURL("image/jpeg", quality)
}

async function localInpaintFromMask(sourceUrl: string, maskUrl: string): Promise<string> {
  const sourceImg = await loadImage(sourceUrl)
  const maskImg = await loadImage(maskUrl)

  const workCanvas = document.createElement("canvas")
  workCanvas.width = sourceImg.naturalWidth
  workCanvas.height = sourceImg.naturalHeight
  const workCtx = workCanvas.getContext("2d")
  if (!workCtx) return sourceUrl

  workCtx.drawImage(sourceImg, 0, 0)

  const maskCanvas = document.createElement("canvas")
  maskCanvas.width = workCanvas.width
  maskCanvas.height = workCanvas.height
  const maskCtx = maskCanvas.getContext("2d")
  if (!maskCtx) return sourceUrl
  maskCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height)

  // Step 1: erase masked zone from image.
  workCtx.save()
  workCtx.globalCompositeOperation = "destination-out"
  workCtx.drawImage(maskCanvas, 0, 0)
  workCtx.restore()

  const originalCanvas = await canvasFromImage(sourceUrl)
  const originalCtx = originalCanvas.getContext("2d")
  if (!originalCtx) return sourceUrl
  const originalData = originalCtx.getImageData(0, 0, workCanvas.width, workCanvas.height)
  const filledData = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height)
  const maskData = maskCtx.getImageData(0, 0, workCanvas.width, workCanvas.height)

  const width = workCanvas.width
  const height = workCanvas.height
  const radius = 10

  // Step 2: fill erased pixels with local neighborhood average.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (maskData.data[idx + 3] < 12) continue

      let rs = 0
      let gs = 0
      let bs = 0
      let count = 0

      for (let oy = -radius; oy <= radius; oy++) {
        const ny = y + oy
        if (ny < 0 || ny >= height) continue
        for (let ox = -radius; ox <= radius; ox++) {
          const nx = x + ox
          if (nx < 0 || nx >= width) continue
          const dist = ox * ox + oy * oy
          if (dist > radius * radius) continue
          const nIdx = (ny * width + nx) * 4
          if (maskData.data[nIdx + 3] >= 12) continue
          rs += originalData.data[nIdx]
          gs += originalData.data[nIdx + 1]
          bs += originalData.data[nIdx + 2]
          count++
        }
      }

      if (count > 0) {
        filledData.data[idx] = Math.round(rs / count)
        filledData.data[idx + 1] = Math.round(gs / count)
        filledData.data[idx + 2] = Math.round(bs / count)
        filledData.data[idx + 3] = 255
      }
    }
  }

  workCtx.putImageData(filledData, 0, 0)

  // Step 3: blur only masked area for softer transitions.
  const blurCanvas = document.createElement("canvas")
  blurCanvas.width = workCanvas.width
  blurCanvas.height = workCanvas.height
  const blurCtx = blurCanvas.getContext("2d")
  if (!blurCtx) return canvasToDataUrl(workCanvas, 0.95)
  blurCtx.filter = "blur(2px)"
  blurCtx.drawImage(workCanvas, 0, 0)
  const blurData = blurCtx.getImageData(0, 0, blurCanvas.width, blurCanvas.height)
  const finalData = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height)

  for (let i = 0; i < maskData.data.length; i += 4) {
    if (maskData.data[i + 3] < 12) continue
    finalData.data[i] = blurData.data[i]
    finalData.data[i + 1] = blurData.data[i + 1]
    finalData.data[i + 2] = blurData.data[i + 2]
    finalData.data[i + 3] = 255
  }

  workCtx.putImageData(finalData, 0, 0)
  return canvasToDataUrl(workCanvas, 0.95)
}

function getTodayUsage() {
  if (typeof window === "undefined") return 0
  const key = `affisellStudioUsage:${new Date().toISOString().slice(0, 10)}`
  return Number(localStorage.getItem(key) || "0")
}

function incrementTodayUsage() {
  const key = `affisellStudioUsage:${new Date().toISOString().slice(0, 10)}`
  const current = Number(localStorage.getItem(key) || "0")
  localStorage.setItem(key, String(current + 1))
}

export default function PhotoStudioPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawBoxRef = useRef<HTMLDivElement>(null)
  const isDrawingRef = useRef(false)
  const [mode, setMode] = useState<StudioMode>("remove-bg")
  const [items, setItems] = useState<StudioItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [slider, setSlider] = useState(50)
  const [busy, setBusy] = useState(false)
  const [brushSize, setBrushSize] = useState(24)
  const [masksById, setMasksById] = useState<Record<string, string>>({})

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? items[0], [items, selectedId])
  const todayUsage = getTodayUsage()
  const freeLeft = Math.max(0, DAILY_LIMIT_FREE - todayUsage)
  const isEraseMode = mode === "erase-text"

  useEffect(() => {
    if (!isEraseMode || !selected || !drawBoxRef.current || !maskCanvasRef.current) return
    const canvas = maskCanvasRef.current
    const rect = drawBoxRef.current.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    const maskData = masksById[selected.id]
    if (!maskData) return
    void loadImage(maskData).then((img) => {
      const redrawCtx = canvas.getContext("2d")
      if (!redrawCtx) return
      redrawCtx.clearRect(0, 0, width, height)
      redrawCtx.drawImage(img, 0, 0, width, height)
    })
  }, [isEraseMode, selected, masksById])

  function paintAt(clientX: number, clientY: number) {
    const canvas = maskCanvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!canvas || !rect) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const x = clientX - rect.left
    const y = clientY - rect.top
    ctx.globalCompositeOperation = "source-over"
    ctx.fillStyle = "rgba(255, 55, 55, 0.38)"
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  function commitMask() {
    if (!selected || !maskCanvasRef.current) return
    const dataUrl = maskCanvasRef.current.toDataURL("image/png")
    setMasksById((prev) => ({ ...prev, [selected.id]: dataUrl }))
  }

  function addFiles(files: File[]) {
    const next = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        originalUrl: URL.createObjectURL(file),
        processedUrl: null,
        uploadedUrl: null,
        progress: 0,
        status: "idle" as const,
      }))
    setItems((prev) => {
      const merged = [...prev, ...next]
      if (!selectedId && merged[0]) setSelectedId(merged[0].id)
      return merged
    })
  }

  async function processOne(item: StudioItem) {
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "processing", progress: 8 } : p)))
    const timer = window.setInterval(() => {
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, progress: Math.min(92, p.progress + Math.random() * 12) } : p))
      )
    }, 220)
    try {
      const sourceUrl = await fileToDataUrl(item.file)
      let result = sourceUrl

      if (mode === "remove-bg") {
        const mod = await import("@imgly/background-removal")
        const cutoutBlob = await mod.removeBackground(item.file)
        const transparentUrl = URL.createObjectURL(cutoutBlob)
        const whiteBgCanvas = await canvasFromImage(transparentUrl)
        const ctx = whiteBgCanvas.getContext("2d")
        if (ctx) {
          ctx.globalCompositeOperation = "destination-over"
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, whiteBgCanvas.width, whiteBgCanvas.height)
        }
        result = canvasToDataUrl(whiteBgCanvas)
        URL.revokeObjectURL(transparentUrl)
      }

      if (mode === "enhance-pro") {
        const enhanced = await canvasFromImage(sourceUrl, "brightness(1.08) contrast(1.1) saturate(1.12)")
        result = canvasToDataUrl(enhanced, 0.94)
      }

      if (mode === "lifestyle") {
        const product = await loadImage(sourceUrl)
        const canvas = document.createElement("canvas")
        canvas.width = 1600
        canvas.height = 1200
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
          g.addColorStop(0, "#f8fafc")
          g.addColorStop(1, "#e2e8f0")
          ctx.fillStyle = g
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(140, 240, 1320, 760)
          ctx.shadowColor = "rgba(15, 23, 42, 0.18)"
          ctx.shadowBlur = 34
          ctx.drawImage(product, 340, 290, 920, 620)
        }
        result = canvasToDataUrl(canvas, 0.95)
      }

      if (mode === "erase-text") {
        const mask = masksById[item.id]
        if (!mask) throw new Error("Paint over text/watermark first.")
        result = await localInpaintFromMask(sourceUrl, mask)
      }

      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, processedUrl: result, status: "processing", progress: 94 } : p))
      )

      const uploadRes = await fetch("/api/upload/processed-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: result,
          filename: item.file.name,
        }),
      })
      const uploadJson = (await uploadRes.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!uploadRes.ok || !uploadJson.url) {
        throw new Error(uploadJson.error ?? "Upload failed")
      }

      const uploadedUrl: string = uploadJson.url

      incrementTodayUsage()
      setItems((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? { ...p, processedUrl: result, uploadedUrl, status: "done", progress: 100 }
            : p
        )
      )
    } catch (e) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === item.id ? { ...p, status: "error", progress: 0, error: e instanceof Error ? e.message : "Failed" } : p
        )
      )
    } finally {
      window.clearInterval(timer)
    }
  }

  async function processAll() {
    if (!items.length || busy) return
    if (freeLeft <= 0) return
    setBusy(true)
    try {
      for (const item of items) {
        if (item.status === "done" && item.processedUrl) continue
        if (getTodayUsage() >= DAILY_LIMIT_FREE) break
        // eslint-disable-next-line no-await-in-loop
        await processOne(item)
      }
    } finally {
      setBusy(false)
    }
  }

  function useForProduct() {
    const urls = items.map((i) => i.uploadedUrl).filter((u): u is string => Boolean(u)).slice(0, 10)
    if (!urls.length) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(urls))
    window.location.href = "/supplier/products/new?fromStudio=1"
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300">Affisell Studio</p>
            <h1 className="mt-1 text-3xl font-semibold">AI Photo Studio for Sellers</h1>
            <p className="mt-1 text-sm text-zinc-400">Upload, enhance, and publish product visuals in minutes.</p>
          </div>
          <Link href="/supplier/products/new" className="text-sm text-zinc-300 hover:text-white">
            Back to product wizard
          </Link>
        </div>

        <div className="grid gap-4 xl:grid-cols-[300px_1fr_320px]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900 px-4 py-8 text-center hover:border-violet-400/60"
            >
              <UploadCloud className="h-8 w-8 text-violet-300" />
              <p className="mt-3 text-sm font-medium">Drag & drop or click to upload</p>
              <p className="text-xs text-zinc-500">Multiple images supported</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(Array.from(e.target.files || []))}
            />

            <div className="mt-4 space-y-2">
              {([
                ["remove-bg", "Remove Background", Wand2],
                ["enhance-pro", "Enhance Pro", Sparkles],
                ["lifestyle", "Lifestyle Mockup", Layers3],
                ["erase-text", "Erase Text", Wand2],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    mode === key ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {isEraseMode ? (
              <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
                <p className="text-xs font-medium text-zinc-300">Brush size</p>
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="mt-2 w-full accent-violet-400"
                />
                <p className="mt-1 text-xs text-zinc-500">{brushSize}px</p>
                <button
                  type="button"
                  onClick={() => {
                    if (!selected || !maskCanvasRef.current) return
                    const canvas = maskCanvasRef.current
                    const ctx = canvas.getContext("2d")
                    if (!ctx) return
                    ctx.clearRect(0, 0, canvas.width, canvas.height)
                    setMasksById((prev) => {
                      const next = { ...prev }
                      delete next[selected.id]
                      return next
                    })
                  }}
                  className="mt-2 w-full rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  Clear mask
                </button>
              </div>
            ) : null}

            <button
              onClick={processAll}
              disabled={busy || !items.length || freeLeft <= 0}
              className="mt-4 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-50"
            >
              {busy ? "Processing..." : "Process all uploaded"}
            </button>
            <p className="mt-2 text-xs text-zinc-400">
              Free: {freeLeft} image{freeLeft === 1 ? "" : "s"} left today · Pro unlimited
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Before / After</p>
              {selected?.status === "processing" ? <p className="text-xs text-violet-300">Enhancing...</p> : null}
            </div>
            <div ref={drawBoxRef} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-950">
              {selected ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.originalUrl} alt="" className="h-full w-full object-contain" />
                  {selected.processedUrl ? (
                    <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selected.processedUrl} alt="" className="h-full w-full object-contain" />
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute inset-y-0 border-l border-white/70" style={{ left: `${slider}%` }} />
                  {isEraseMode ? (
                    <canvas
                      ref={maskCanvasRef}
                      className="absolute inset-0 z-20 h-full w-full cursor-crosshair"
                      onPointerDown={(e) => {
                        isDrawingRef.current = true
                        paintAt(e.clientX, e.clientY)
                      }}
                      onPointerMove={(e) => {
                        if (!isDrawingRef.current) return
                        paintAt(e.clientX, e.clientY)
                      }}
                      onPointerUp={() => {
                        isDrawingRef.current = false
                        commitMask()
                      }}
                      onPointerLeave={() => {
                        if (!isDrawingRef.current) return
                        isDrawingRef.current = false
                        commitMask()
                      }}
                    />
                  ) : null}
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">
                  <ImageIcon className="mr-2 h-5 w-5" /> Upload images to start
                </div>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="mt-3 w-full accent-violet-500"
            />
            {isEraseMode ? (
              <p className="mt-2 text-xs text-rose-300">
                Paint over text/watermarks in red, then click Process for instant local content-aware fill.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`relative aspect-square overflow-hidden rounded-lg border ${
                    selected?.id === item.id ? "border-violet-400" : "border-zinc-700"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.processedUrl || item.originalUrl} alt="" className="h-full w-full object-cover" />
                  {item.status === "processing" ? (
                    <motion.div
                      className="absolute bottom-0 left-0 h-1 bg-violet-400"
                      animate={{ width: `${item.progress}%` }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <h2 className="text-sm font-medium text-zinc-200">Export & Publish</h2>
            <p className="mt-1 text-xs text-zinc-400">Processed images are ready for your product listing.</p>

            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                  <p className="truncate text-xs text-zinc-300">{item.file.name}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {item.status === "done"
                      ? "Ready"
                      : item.status === "processing"
                        ? `Processing ${Math.round(item.progress)}%`
                        : item.status === "error"
                          ? "Failed"
                          : "Waiting"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2">
              {selected?.processedUrl ? (
                <a
                  href={selected.processedUrl}
                  download={`affisell-studio-${selected.file.name.replace(/\.[^/.]+$/, "")}.jpg`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm hover:bg-zinc-900"
                >
                  <Download className="h-4 w-4" /> Download selected
                </a>
              ) : null}
              <button
                onClick={useForProduct}
                disabled={!items.some((i) => i.uploadedUrl)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save to Product <ArrowRight className="h-4 w-4" />
              </button>
              <p className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Auto-fills image fields in product wizard
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
