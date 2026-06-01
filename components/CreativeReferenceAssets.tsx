"use client"

import Image from "next/image"
import { useCallback, useRef, useState } from "react"
import { Film, ImagePlus, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

export type CreativeReferenceAsset = {
  id: string
  url: string
  kind: "image" | "video"
  source: "upload" | "gallery"
}

const MAX_IMAGES = 4
const MAX_VIDEOS = 1

type Props = {
  productImages?: string[]
  references: CreativeReferenceAsset[]
  onChange: (next: CreativeReferenceAsset[]) => void
  disabled?: boolean
}

export function CreativeReferenceAssets({
  productImages = [],
  references,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const imageCount = references.filter((r) => r.kind === "image").length
  const videoCount = references.filter((r) => r.kind === "video").length

  const removeRef = useCallback(
    (id: string) => {
      onChange(references.filter((r) => r.id !== id))
    },
    [onChange, references]
  )

  const addReference = useCallback(
    (asset: Omit<CreativeReferenceAsset, "id">) => {
      if (asset.kind === "image" && imageCount >= MAX_IMAGES) {
        toast.error(`Maximum ${MAX_IMAGES} photos de référence`)
        return
      }
      if (asset.kind === "video" && videoCount >= MAX_VIDEOS) {
        toast.error(`Maximum ${MAX_VIDEOS} vidéo de référence`)
        return
      }
      if (references.some((r) => r.url === asset.url)) return
      onChange([...references, { ...asset, id: crypto.randomUUID() }])
    },
    [imageCount, onChange, references, videoCount]
  )

  async function handleFiles(files: FileList | null) {
    if (!files?.length || disabled) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/")
        const isVideo = file.type.startsWith("video/")
        if (!isImage && !isVideo) {
          toast.error(`${file.name} : format non supporté`)
          continue
        }
        if (isImage && imageCount >= MAX_IMAGES) break
        if (isVideo && videoCount >= MAX_VIDEOS) break

        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/supplier/upload-media", {
          method: "POST",
          credentials: "include",
          body: form,
        })
        const data = (await res.json()) as { url?: string; kind?: "image" | "video"; error?: string }
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? "Upload échoué")
        }
        addReference({
          url: data.url,
          kind: data.kind ?? (isVideo ? "video" : "image"),
          source: "upload",
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload échoué")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const galleryAvailable = productImages.filter(
    (url) => url.trim() && !references.some((r) => r.url === url)
  )

  return (
    <div className="space-y-3 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-cyan-50/40 p-4 dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-cyan-950/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
            Références visuelles
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Photos ou vidéos pour un rendu photoréaliste (produit, lumière, mouvement caméra).
          </p>
        </div>
        <span className="rounded-full bg-violet-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200">
          Optionnel
        </span>
      </div>

      {references.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {references.map((ref) => (
            <li
              key={ref.id}
              className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {ref.kind === "image" ? (
                <div className="relative aspect-square">
                  <Image
                    src={ref.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="120px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 bg-zinc-900 text-white">
                  <Film className="h-8 w-8 opacity-80" aria-hidden />
                  <span className="px-1 text-[9px] font-medium uppercase tracking-wide">Vidéo</span>
                </div>
              )}
              <button
                type="button"
                disabled={disabled}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                onClick={() => removeRef(ref.id)}
                aria-label="Retirer la référence"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-violet-300/80 bg-white/60 px-4 py-6 text-center dark:border-violet-800 dark:bg-zinc-950/40">
          <ImagePlus className="mx-auto h-8 w-8 text-violet-500/70" aria-hidden />
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Ajoutez des refs pour caler le rendu sur votre produit réel
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        multiple
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          )}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden />
          )}
          Ajouter photo / vidéo
        </button>
      </div>

      {galleryAvailable.length > 0 ? (
        <div className="space-y-2 border-t border-violet-200/60 pt-3 dark:border-violet-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Depuis la fiche produit
          </p>
          <div className="flex flex-wrap gap-2">
            {galleryAvailable.slice(0, 8).map((url) => (
              <button
                key={url}
                type="button"
                disabled={disabled || imageCount >= MAX_IMAGES}
                className="relative h-14 w-14 overflow-hidden rounded-lg ring-2 ring-transparent transition hover:ring-violet-400 disabled:opacity-40"
                onClick={() =>
                  addReference({ url, kind: "image", source: "gallery" })
                }
              >
                <Image src={url} alt="" fill className="object-cover" sizes="56px" unoptimized />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-zinc-500">
        {imageCount}/{MAX_IMAGES} photos · {videoCount}/{MAX_VIDEOS} vidéo · JPG/PNG/WebP ou MP4
      </p>
    </div>
  )
}

export function referencesToApiPayload(refs: CreativeReferenceAsset[]) {
  return {
    referenceImageUrls: refs.filter((r) => r.kind === "image").map((r) => r.url),
    referenceVideoUrls: refs.filter((r) => r.kind === "video").map((r) => r.url),
  }
}
