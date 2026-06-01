"use client"

import { Loader2, Trash2, Upload, Video } from "lucide-react"
import type { ChangeEvent } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { resolveImageLinkUrl } from "@/components/supplier/supplier-product-image-upload"
import { SupplierVariantVideoField } from "@/components/supplier/supplier-variant-video-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DESCRIPTION_ILLUSTRATION_MAX,
  DESCRIPTION_ILLUSTRATION_MIN_H,
  DESCRIPTION_ILLUSTRATION_MIN_W,
  DescriptionIllustrationSizeError,
  processDescriptionIllustrationFile,
} from "@/lib/description-illustration-image"
import { cn } from "@/lib/utils"

const IMAGE_SLOTS = DESCRIPTION_ILLUSTRATION_MAX
const MIN_W = DESCRIPTION_ILLUSTRATION_MIN_W
const MIN_H = DESCRIPTION_ILLUSTRATION_MIN_H
const MAX_VIDEOS = 2

type Props = {
  images: string[]
  onImagesChange: (urls: string[]) => void
  videos: string[]
  onVideosChange: (urls: string[]) => void
  /** When true, only video URL fields are shown (images managed in description composer). */
  hideImageGrid?: boolean
}

function slotsFrom(urls: string[]): (string | null)[] {
  return Array.from({ length: IMAGE_SLOTS }, (_, i) => urls[i] ?? null)
}

function orderedFromSlots(slots: (string | null)[]): string[] {
  return slots.reduce<string[]>((acc, u) => {
    if (u) acc.push(u)
    return acc
  }, [])
}

export function SupplierDescriptionIllustrationFields({
  images,
  onImagesChange,
  videos,
  onVideosChange,
  hideImageGrid = false,
}: Props) {
  const [slots, setSlots] = useState<(string | null)[]>(() => slotsFrom(images))
  const [busy, setBusy] = useState<number | null>(null)
  const [pasteUrl, setPasteUrl] = useState("")

  useEffect(() => {
    const trimmed = images.slice(0, IMAGE_SLOTS)
    setSlots(slotsFrom(trimmed))
    if (trimmed.length !== images.length) {
      onImagesChange(trimmed)
    }
  }, [images, onImagesChange])

  const syncSlots = (next: (string | null)[]) => {
    setSlots(next)
    onImagesChange(orderedFromSlots(next).slice(0, IMAGE_SLOTS))
  }

  const onFile = async (slot: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(slot)
    try {
      const dataUrl = await processDescriptionIllustrationFile(file)
      const next = [...slots]
      next[slot] = dataUrl
      syncSlots(next)
      toast.success("Image ajoutée")
    } catch (e) {
      if (e instanceof DescriptionIllustrationSizeError) {
        toast.error(`${e.fileName} : min. ${e.minW}×${e.minH} px.`)
      } else {
        toast.error("Impossible de traiter cette image.")
      }
    } finally {
      setBusy(null)
    }
  }

  const applyPaste = () => {
    const resolved = resolveImageLinkUrl(pasteUrl)
    if (!resolved) {
      toast.error("Paste a valid http(s) image URL.")
      return
    }
    const empty = slots.findIndex((s) => !s)
    if (empty < 0) {
      toast.error("All illustration slots are full.")
      return
    }
    const next = [...slots]
    next[empty] = resolved
    syncSlots(next)
    setPasteUrl("")
    toast.success("Image link added")
  }

  const clearSlot = (slot: number) => {
    const next = [...slots]
    next[slot] = null
    syncSlots(next)
  }

  const setVideoAt = (index: number, value: string) => {
    const next0 = index === 0 ? value : (videos[0] ?? "")
    const next1 = index === 1 ? value : (videos[1] ?? "")
    const out = [next0, next1].map((s) => s.trim()).filter(Boolean)
    onVideosChange(out.slice(0, MAX_VIDEOS))
  }

  const v0 = videos[0] ?? ""
  const v1 = videos[1] ?? ""

  return (
    <div
      className={cn(
        "space-y-6",
        !hideImageGrid && "border-t border-zinc-100 pt-5 dark:border-zinc-800"
      )}
    >
      {!hideImageGrid && (
      <div>
        <Label className="text-zinc-800 dark:text-zinc-100">Illustration photos (description)</Label>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Optional lifestyle or detail shots shown under the long text on the product page (not the main gallery).
          Up to {IMAGE_SLOTS} images, min. {MIN_W}×{MIN_H}px.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.map((url, slot) => (
            <div
              key={slot}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40",
                url && "border-solid"
              )}
            >
              {url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => clearSlot(slot)}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                    aria-label="Remove illustration"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 p-2 text-center">
                  {busy === slot ? (
                    <Loader2 className="h-6 w-6 animate-spin text-violet-600" aria-hidden />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-zinc-400" aria-hidden />
                      <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Add photo</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busy !== null}
                    onChange={(e) => void onFile(slot, e)}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="Or paste an image URL (https://…)"
              className="h-10"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={applyPaste}>
            Add from link
          </Button>
        </div>
      </div>
      )}

      <div>
        <Label className="inline-flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <Video className="h-4 w-4 text-zinc-500" aria-hidden />
          {hideImageGrid ? "Vidéos illustratives" : "Illustrative videos"}
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          YouTube, Vimeo, lien <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.mp4</code> ou import
          fichier (MP4, WebM, MOV — max 48 Mo) — {MAX_VIDEOS} vidéos max.
        </p>
        <div className="mt-2 space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Vidéo 1</p>
            <SupplierVariantVideoField
              value={v0 || null}
              onChange={(url) => setVideoAt(0, url ?? "")}
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Vidéo 2</p>
            <SupplierVariantVideoField
              value={v1 || null}
              onChange={(url) => setVideoAt(1, url ?? "")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
