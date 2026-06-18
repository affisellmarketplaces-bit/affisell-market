"use client"

import { Loader2, Plus, Trash2, Upload, Video } from "lucide-react"
import type { ChangeEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

import { resolveImageLinkUrl } from "@/components/supplier/supplier-product-image-upload"
import { SupplierVariantVideoField } from "@/components/supplier/supplier-variant-video-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DESCRIPTION_ILLUSTRATION_MIN_H,
  DESCRIPTION_ILLUSTRATION_MIN_W,
  DESCRIPTION_ILLUSTRATION_SERVER_MAX,
  DESCRIPTION_VIDEO_SERVER_MAX,
  DescriptionIllustrationSizeError,
  processDescriptionIllustrationFile,
} from "@/lib/description-illustration-image"
import { cn } from "@/lib/utils"

const MIN_W = DESCRIPTION_ILLUSTRATION_MIN_W
const MIN_H = DESCRIPTION_ILLUSTRATION_MIN_H

type Props = {
  images: string[]
  onImagesChange: (urls: string[]) => void
  videos: string[]
  onVideosChange: (urls: string[]) => void
  /** When true, only video URL fields are shown (images managed in description composer). */
  hideImageGrid?: boolean
}

export function SupplierDescriptionIllustrationFields({
  images,
  onImagesChange,
  videos,
  onVideosChange,
  hideImageGrid = false,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [pasteUrl, setPasteUrl] = useState("")

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (images.length >= DESCRIPTION_ILLUSTRATION_SERVER_MAX) {
      toast.error(`Maximum ${DESCRIPTION_ILLUSTRATION_SERVER_MAX} images.`)
      return
    }
    setBusy(true)
    try {
      const dataUrl = await processDescriptionIllustrationFile(file)
      onImagesChange([...images, dataUrl])
      toast.success("Image ajoutée")
    } catch (err) {
      if (err instanceof DescriptionIllustrationSizeError) {
        toast.error(`${err.fileName} : min. ${err.minW}×${err.minH} px.`)
      } else {
        toast.error("Impossible de traiter cette image.")
      }
    } finally {
      setBusy(false)
    }
  }

  const applyPaste = () => {
    const resolved = resolveImageLinkUrl(pasteUrl)
    if (!resolved) {
      toast.error("Collez une URL image valide (https://…).")
      return
    }
    if (images.length >= DESCRIPTION_ILLUSTRATION_SERVER_MAX) {
      toast.error(`Maximum ${DESCRIPTION_ILLUSTRATION_SERVER_MAX} images.`)
      return
    }
    onImagesChange([...images, resolved])
    setPasteUrl("")
    toast.success("Image ajoutée")
  }

  const removeImageAt = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index))
  }

  const setVideoAt = (index: number, value: string) => {
    const next = [...videos]
    if (value.trim()) {
      next[index] = value.trim()
    } else {
      next.splice(index, 1)
    }
    onVideosChange(next.filter(Boolean).slice(0, DESCRIPTION_VIDEO_SERVER_MAX))
  }

  const addVideoSlot = () => {
    if (videos.length >= DESCRIPTION_VIDEO_SERVER_MAX) {
      toast.error(`Maximum ${DESCRIPTION_VIDEO_SERVER_MAX} vidéos.`)
      return
    }
    onVideosChange([...videos, ""])
  }

  return (
    <div
      className={cn(
        "space-y-6",
        !hideImageGrid && "border-t border-zinc-100 pt-5 dark:border-zinc-800"
      )}
    >
      {!hideImageGrid && (
        <div>
          <Label className="text-zinc-800 dark:text-zinc-100">Photos illustratives (description)</Label>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Visuels détail / lifestyle affichés dans la fiche produit. Ajoutez autant que nécessaire (min.{" "}
            {MIN_W}×{MIN_H} px).
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {images.map((url, index) => (
              <div
                key={`${index}-${url.slice(0, 24)}`}
                className="relative aspect-square h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-contain p-1" />
                <button
                  type="button"
                  onClick={() => removeImageAt(index)}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
                  aria-label="Retirer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {images.length < DESCRIPTION_ILLUSTRATION_SERVER_MAX ? (
              <label className="flex aspect-square h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-2 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                {busy ? (
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" aria-hidden />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-zinc-400" aria-hidden />
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Ajouter</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => void onFile(e)}
                />
              </label>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="Ou collez une URL image (https://…)"
                className="h-10"
              />
            </div>
            <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={applyPaste}>
              Ajouter le lien
            </Button>
          </div>
        </div>
      )}

      <div>
        <Label className="inline-flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <Video className="h-4 w-4 text-zinc-500" aria-hidden />
          {hideImageGrid ? "Vidéos illustratives" : "Vidéos illustratives"}
        </Label>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          YouTube, Vimeo, lien <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.mp4</code> ou import
          fichier (MP4, WebM, MOV — max 48 Mo).
        </p>
        <div className="mt-2 space-y-3">
          {(videos.length > 0 ? videos : [""]).map((url, index) => (
            <div key={index}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Vidéo {index + 1}
              </p>
              <SupplierVariantVideoField value={url || null} onChange={(v) => setVideoAt(index, v ?? "")} />
            </div>
          ))}
          {videos.length < DESCRIPTION_VIDEO_SERVER_MAX ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addVideoSlot}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Ajouter une vidéo
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
