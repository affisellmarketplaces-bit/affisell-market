"use client"

import { Loader2, Upload, X } from "lucide-react"
import type { ChangeEvent, CSSProperties } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { measureImageFile, processProductImageToDataUrl } from "@/lib/product-image-upload"
import { cn } from "@/lib/utils"

const SLOT_COUNT = 9 /** cover + 8 thumbnails */

type Props = {
  onImagesChange: (urls: string[]) => void
  initialUrls?: string[]
}

function slotsToOrderedUrls(slots: (string | null)[]): string[] {
  return slots.reduce<string[]>((acc, u) => {
    if (u) acc.push(u)
    return acc
  }, [])
}

const MAX_HTTP_IMAGE_URL_LEN = 8000
const MAX_DATA_IMAGE_URL_LEN = 5_000_000

function normalizePastedUrl(raw: string): string {
  let u = raw
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^['"<]+|['">]+$/g, "")
  const md = u.match(/\]\((https?:\/\/[^)\s]+|\/\/[^)\s]+)\)/i)
  if (md) u = md[1]
  return u.trim().replace(/[\)\]]+$/g, "")
}

const BLOCKED_NON_IMAGE = /\.(pdf|zip|7z|rar|tar|gz|html?|json|csv|txt|docx?|xlsx?|pptx?|exe|dmg|pkg)(\?|#|$)/i

function resolveImageLinkUrl(raw: string): string | null {
  const n = normalizePastedUrl(raw)
  if (n.startsWith("data:image/")) {
    if (n.length > MAX_DATA_IMAGE_URL_LEN) return null
    if (n.includes(";base64,") || /^data:image\/svg\+xml[,;]/i.test(n)) return n
    return null
  }

  let u = n.replace(/\r?\n/g, "").trim()
  if (!u) return null

  if (u.startsWith("//")) u = `https:${u}`
  else if (/^www\./i.test(u)) u = `https://${u}`
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) {
    const hostPart = u.split("/")[0]?.split("?")[0] ?? ""
    const domainLike =
      /^([a-z0-9]([a-z0-9-]*\.)+[a-z]{2,})(:\d+)?$/i.test(hostPart) || /^localhost(:\d+)?$/i.test(hostPart)
    if (domainLike) u = `https://${u}`
  }

  if (u.length > MAX_HTTP_IMAGE_URL_LEN) return null

  try {
    const parsed = new URL(u)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    if (!parsed.hostname) return null
    const full = `${parsed.pathname}${parsed.search}`.toLowerCase()
    if (BLOCKED_NON_IMAGE.test(full)) return null
    return parsed.href
  } catch {
    return null
  }
}

function BoxPlaceholder({ variant }: { variant: number }) {
  const stroke = "stroke-zinc-400 dark:stroke-zinc-500"
  const common = cn("h-9 w-9 shrink-0", stroke)
  switch (variant % 8) {
    case 0:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M8 14h24v20H8zM8 14l12-6 12 6" />
          <path d="M20 8v26" />
        </svg>
      )
    case 1:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M10 28L22 10l12 8-10 14z" />
          <path d="M22 10v22" />
        </svg>
      )
    case 2:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M6 16h28v18H6z" />
          <path d="M6 16l14-8 14 8" />
          <path d="M12 16v4h16" />
        </svg>
      )
    case 3:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M10 12h20v22H10z" />
          <path d="M10 18h20M10 24h12" />
        </svg>
      )
    case 4:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M14 10h16v22H8V16z" />
          <path d="M14 10v6h16" />
        </svg>
      )
    case 5:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <ellipse cx="20" cy="22" rx="14" ry="6" />
          <path d="M8 22V14l12-6 12 6v8" />
        </svg>
      )
    case 6:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <circle cx="22" cy="16" r="7" />
          <path d="M12 30c2-6 8-10 16-10" />
          <path d="M8 14h24v20H8z" opacity="0.35" />
        </svg>
      )
    default:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M8 14h24v20H8z" />
          <path d="M10 32V18M16 32V18M22 32V18M28 32V18" />
          <path d="M6 34h28" />
        </svg>
      )
  }
}

export function SupplierProductImageUpload({ onImagesChange, initialUrls }: Props) {
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => initialUrls?.[i] ?? null)
  )
  const [busySlot, setBusySlot] = useState<number | null>(null)
  const [imageUrlDraft, setImageUrlDraft] = useState("")

  useEffect(() => {
    const seed = initialUrls?.filter(Boolean) ?? []
    if (seed.length === 0) return
    const next = Array.from({ length: SLOT_COUNT }, (_, i) => initialUrls?.[i] ?? null)
    setSlots(next)
    queueMicrotask(() => onImagesChange(slotsToOrderedUrls(next)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrls?.join("|")])

  const handleFileForSlot = async (slotIndex: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setBusySlot(slotIndex)
    try {
      const dimensions = await measureImageFile(file)
      if (dimensions.width < 800 || dimensions.height < 800) {
        toast.error(`${file.name}: images must be at least 800×800 px.`)
        return
      }
      const processed = await processProductImageToDataUrl(file)
      setSlots((prev) => {
        const next = [...prev]
        next[slotIndex] = processed
        queueMicrotask(() => onImagesChange(slotsToOrderedUrls(next)))
        return next
      })
      toast.success(`Added ${file.name}`)
    } catch {
      toast.error("Could not process this image.")
    } finally {
      setBusySlot(null)
    }
  }

  const removeAt = (slotIndex: number) => {
    setSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = null
      queueMicrotask(() => onImagesChange(slotsToOrderedUrls(next)))
      return next
    })
  }

  const applyImageUrl = () => {
    const resolved = resolveImageLinkUrl(imageUrlDraft)
    if (!resolved) {
      toast.error("Enter a valid http(s) image link.")
      return
    }
    setSlots((prev) => {
      const emptyIdx = prev.findIndex((s) => !s)
      if (emptyIdx < 0) {
        queueMicrotask(() => toast.error("All slots are full. Remove an image first."))
        return prev
      }
      const next = [...prev]
      next[emptyIdx] = resolved
      const urls = slotsToOrderedUrls(next)
      queueMicrotask(() => {
        onImagesChange(urls)
        setImageUrlDraft("")
        toast.success("Image added from link.")
      })
      return next
    })
  }

  const cellVars: CSSProperties = {
    ["--cell" as string]: "min(5.25rem, 22vw)",
    ["--g" as string]: "0.5rem",
    ["--main" as string]: "calc(2 * var(--cell) + var(--g))",
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3" style={cellVars}>
      {/* Cover image: height matches two thumbnail rows */}
      <div
        className="relative shrink-0"
        style={{ width: "var(--main)", height: "var(--main)", minWidth: "var(--main)" }}
      >
        {slots[0] ? (
          <div className="relative h-full w-full overflow-hidden rounded-lg border border-zinc-200 bg-[#f4f4f5] dark:border-zinc-700 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slots[0]} alt="" className="h-full w-full object-contain p-2" />
            <button
              type="button"
              onClick={() => removeAt(0)}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
              aria-label="Remove cover image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50/90 transition hover:border-violet-400 hover:bg-violet-50/60 dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:border-violet-500">
            {busySlot === 0 ? (
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
            ) : (
              <>
                <Upload className="h-8 w-8 text-zinc-400" aria-hidden />
                <span className="px-2 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Import cover image
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busySlot !== null}
              onChange={(e) => void handleFileForSlot(0, e)}
            />
          </label>
        )}
      </div>

      <div
        className="grid shrink-0 grid-cols-4 grid-rows-2 gap-2"
        style={{
          width: "calc(4 * var(--cell) + 3 * var(--g))",
          height: "var(--main)",
          gridTemplateColumns: "repeat(4, var(--cell))",
          gridTemplateRows: "repeat(2, var(--cell))",
        }}
      >
        {Array.from({ length: 8 }, (_, idx) => {
          const slotIndex = idx + 1
          const url = slots[slotIndex]
          return (
            <div key={slotIndex} className="relative min-h-0 min-w-0">
              {url ? (
                <div className="relative h-full w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => removeAt(slotIndex)}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-md bg-zinc-100 transition hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80">
                  {busySlot === slotIndex ? (
                    <Loader2 className="h-5 w-5 animate-spin text-violet-600" aria-hidden />
                  ) : (
                    <BoxPlaceholder variant={idx} />
                  )}
                  <span className="sr-only">Add image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busySlot !== null}
                    onChange={(e) => void handleFileForSlot(slotIndex, e)}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50">
        <Label htmlFor="supplier-image-url" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Image URL
        </Label>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Uses the next empty slot.</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="supplier-image-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://cdn.example.com/photo.jpg"
            value={imageUrlDraft}
            onChange={(e) => setImageUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyImageUrl()
              }
            }}
            className="sm:flex-1"
          />
          <Button type="button" variant="secondary" className="shrink-0 sm:w-auto" onClick={() => applyImageUrl()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
