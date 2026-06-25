"use client"

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react"
import type { ChangeEvent, CSSProperties, DragEvent } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isLikelyImageFile, processProductGalleryImageFiles } from "@/lib/product-image-upload"
import { persistSupplierGalleryImages } from "@/lib/supplier-gallery-image-persist"
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

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
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

export function resolveImageLinkUrl(raw: string): string | null {
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

function RemoveImageButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "absolute z-10 flex items-center justify-center rounded-lg",
        "bg-zinc-900/50 text-white opacity-0 backdrop-blur-md transition-all duration-200",
        "hover:bg-zinc-900/70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        className
      )}
      aria-label={label}
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  )
}

export function SupplierProductImageUpload({ onImagesChange, initialUrls }: Props) {
  const t = useTranslations("supplier.images")
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => initialUrls?.[i] ?? null)
  )
  const [processingSlots, setProcessingSlots] = useState<Set<number>>(() => new Set())
  const [isBatchUploading, setIsBatchUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [imageUrlDraft, setImageUrlDraft] = useState("")

  const emit = useCallback(
    (next: (string | null)[]) => {
      queueMicrotask(() => onImagesChange(slotsToOrderedUrls(next)))
    },
    [onImagesChange]
  )

  useEffect(() => {
    const seed = initialUrls?.filter(Boolean) ?? []
    if (seed.length === 0) return
    const next = Array.from({ length: SLOT_COUNT }, (_, i) => initialUrls?.[i] ?? null)
    setSlots(next)
    emit(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrls?.join("|")])

  const emptySlotIndices = useCallback(
    () =>
      slots
        .map((s, i) => (s || processingSlots.has(i) ? null : i))
        .filter((i): i is number => i !== null),
    [slots, processingSlots]
  )

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(isLikelyImageFile)
      if (files.length === 0) {
        toast.error(t("errNoImages"))
        return
      }

      const targets = emptySlotIndices()
      if (targets.length === 0) {
        toast.error(t("errSlotsFull"))
        return
      }

      const batch = files.slice(0, targets.length)
      if (files.length > batch.length) {
        toast.info(t("errSlotsPartial", { count: batch.length }))
      }

      setIsBatchUploading(true)
      const slotByFile = new Map<File, number>()
      batch.forEach((file, i) => slotByFile.set(file, targets[i]!))

      setSlots((prev) => {
        const next = [...prev]
        for (const file of batch) {
          const idx = slotByFile.get(file)!
          revokeIfBlob(next[idx])
          next[idx] = URL.createObjectURL(file)
        }
        emit(next)
        return next
      })

      setProcessingSlots((prev) => {
        const s = new Set(prev)
        for (const idx of targets.slice(0, batch.length)) s.add(idx)
        return s
      })

      try {
        const results = await processProductGalleryImageFiles(batch)
        const okResults = results.filter(
          (r): r is { ok: true; file: File; dataUrl: string } => r.ok
        )

        const persistedUrls =
          okResults.length > 0
            ? await persistSupplierGalleryImages(
                okResults.map((r) => ({ dataUrl: r.dataUrl, filename: r.file.name }))
              )
            : []

        let added = 0
        let persistIdx = 0
        setSlots((prev) => {
          const next = [...prev]
          for (const r of results) {
            const slotIndex = slotByFile.get(r.file)
            if (slotIndex === undefined) continue
            revokeIfBlob(next[slotIndex])
            if (r.ok) {
              next[slotIndex] = persistedUrls[persistIdx] ?? r.dataUrl
              persistIdx += 1
              added += 1
            } else {
              next[slotIndex] = null
              if (r.reason === "min_dimension") {
                toast.error(
                  t("errMinDimension", {
                    name: r.file.name,
                    width: r.width ?? "?",
                    height: r.height ?? "?",
                  })
                )
              } else {
                toast.error(t("errProcess", { name: r.file.name }))
              }
            }
          }
          emit(next)
          return next
        })
        if (added > 0) {
          toast.success(added === 1 ? t("addedOne") : t("addedMany", { count: added }))
        }
      } finally {
        setProcessingSlots(new Set())
        setIsBatchUploading(false)
      }
    },
    [emptySlotIndices, emit, t]
  )

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    e.target.value = ""
    if (list?.length) void ingestFiles(list)
  }

  const openFilePicker = () => {
    if (busy || remaining === 0) return
    fileInputRef.current?.click()
  }

  const removeAt = (slotIndex: number) => {
    setSlots((prev) => {
      const next = [...prev]
      revokeIfBlob(next[slotIndex])
      next[slotIndex] = null
      emit(next)
      return next
    })
    setProcessingSlots((prev) => {
      const s = new Set(prev)
      s.delete(slotIndex)
      return s
    })
  }

  const applyImageUrl = () => {
    const resolved = resolveImageLinkUrl(imageUrlDraft)
    if (!resolved) {
      toast.error(t("errInvalidUrl"))
      return
    }
    setSlots((prev) => {
      const emptyIdx = prev.findIndex((s, i) => !s && !processingSlots.has(i))
      if (emptyIdx < 0) {
        queueMicrotask(() => toast.error(t("errUrlSlotsFull")))
        return prev
      }
      const next = [...prev]
      next[emptyIdx] = resolved
      const urls = slotsToOrderedUrls(next)
      queueMicrotask(() => {
        onImagesChange(urls)
        setImageUrlDraft("")
        toast.success(t("addedFromUrl"))
      })
      return next
    })
  }

  const onDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isBatchUploading) setDragActive(true)
  }

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (isBatchUploading) return
    const files = e.dataTransfer.files
    if (files?.length) void ingestFiles(files)
  }

  const busy = isBatchUploading || processingSlots.size > 0
  const remaining = emptySlotIndices().length

  const cellVars: CSSProperties = {
    ["--cell" as string]: "min(5.25rem, 22vw)",
    ["--g" as string]: "0.5rem",
    ["--main" as string]: "calc(2 * var(--cell) + var(--g))",
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="sr-only"
          disabled={busy || remaining === 0}
          onChange={handleFileInput}
        />
        <Button
          type="button"
          variant="default"
          size="sm"
          className="gap-2 rounded-full bg-violet-600 shadow-sm hover:bg-violet-700"
          disabled={busy || remaining === 0}
          onClick={() => fileInputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          {t("addPhotos")}
          {remaining > 0 && remaining < SLOT_COUNT ? (
            <span className="text-violet-200">{t("photosLeft", { count: remaining })}</span>
          ) : null}
        </Button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("selectDropHint")}</p>
      </div>

      <div
        className={cn(
          "relative rounded-xl transition-[box-shadow,ring]",
          dragActive && "ring-2 ring-violet-400/80 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950"
        )}
        style={cellVars}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragActive ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-violet-500/10 backdrop-blur-[2px]"
            aria-hidden
          >
            <p className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-violet-800 shadow-sm dark:bg-zinc-900/90 dark:text-violet-200">
              {t("dropToUpload")}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-3">
          <div
            className="group relative shrink-0"
            style={{ width: "var(--main)", height: "var(--main)", minWidth: "var(--main)" }}
          >
            {slots[0] ? (
              <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-200/90 bg-[#f4f4f5] shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slots[0]} alt="" className="h-full w-full object-contain p-2" />
                {processingSlots.has(0) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-950/50">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                  </div>
                ) : null}
                <RemoveImageButton
                  label={t("removeCover")}
                  onClick={() => removeAt(0)}
                  className="right-2 top-2 h-9 w-9"
                />
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || remaining === 0}
                onClick={openFilePicker}
                className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300/90 bg-zinc-50/90 transition hover:border-violet-400 hover:bg-violet-50/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:border-violet-500"
              >
                {processingSlots.has(0) ? (
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-zinc-400" aria-hidden />
                    <span className="px-2 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {t("coverPhoto")}
                    </span>
                  </>
                )}
              </button>
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
              const processing = processingSlots.has(slotIndex)
              return (
                <div key={slotIndex} className="group relative min-h-0 min-w-0">
                  {url ? (
                    <div className="relative h-full w-full overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-100 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-contain p-1" />
                      {processing ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/55 dark:bg-zinc-950/45">
                          <Loader2 className="h-5 w-5 animate-spin text-violet-600" aria-hidden />
                        </div>
                      ) : null}
                      <RemoveImageButton
                        label="Remove image"
                        onClick={() => removeAt(slotIndex)}
                        className="right-1 top-1 h-7 w-7"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || remaining === 0}
                      onClick={openFilePicker}
                      className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-transparent bg-zinc-100/90 transition hover:border-zinc-300 hover:bg-zinc-200/80 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800/90 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/80"
                    >
                      {processing ? (
                        <Loader2 className="h-5 w-5 animate-spin text-violet-600" aria-hidden />
                      ) : (
                        <BoxPlaceholder variant={idx} />
                      )}
                      <span className="sr-only">{t("addPhotos")}</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
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
