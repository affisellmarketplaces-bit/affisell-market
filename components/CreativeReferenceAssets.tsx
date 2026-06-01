"use client"

import Image from "next/image"
import { useCallback, useRef, useState } from "react"
import {
  Film,
  ImagePlus,
  Loader2,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { isSupplierVideoFile } from "@/lib/supplier-variant-video-upload"

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
  /** Full futuristic layout — used in creative custom mode */
  variant?: "default" | "studio"
}

export function CreativeReferenceAssets({
  productImages = [],
  references,
  onChange,
  disabled,
  variant = "default",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const imageCount = references.filter((r) => r.kind === "image").length
  const videoCount = references.filter((r) => r.kind === "video").length
  const atImageLimit = imageCount >= MAX_IMAGES
  const atVideoLimit = videoCount >= MAX_VIDEOS

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

  async function uploadFile(file: File) {
    const isImage = file.type.startsWith("image/")
    const isVideo = isSupplierVideoFile(file)
    if (!isImage && !isVideo) {
      toast.error(`${file.name} : format non supporté`)
      return
    }
    if (isImage && atImageLimit) {
      toast.error(`Maximum ${MAX_IMAGES} photos`)
      return
    }
    if (isVideo && atVideoLimit) {
      toast.error(`Maximum ${MAX_VIDEOS} vidéo`)
      return
    }

    const form = new FormData()
    form.append("file", file)
    form.append("subfolder", "video-refs")

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

  async function handleFiles(files: FileList | null) {
    if (!files?.length || disabled) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file)
      }
      if (files.length > 0) {
        toast.success("Référence ajoutée")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload échoué")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    void handleFiles(e.dataTransfer.files)
  }

  const galleryAvailable = productImages.filter(
    (url) => url.trim() && !references.some((r) => r.url === url)
  )

  const isStudio = variant === "studio"

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        isStudio
          ? "rounded-2xl border border-violet-500/25 bg-zinc-950/90 p-4 shadow-[0_0_60px_-12px_rgba(139,92,246,0.45)] backdrop-blur-sm sm:p-5"
          : "space-y-3 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 via-white to-cyan-50/40 p-4 dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-cyan-950/20"
      )}
    >
      {isStudio ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(139,92,246,0.22),transparent)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_85%)]"
            aria-hidden
          />
        </>
      ) : null}

      <div className={cn("relative", isStudio ? "space-y-4" : "space-y-3")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p
              className={cn(
                "inline-flex items-center gap-2 font-semibold",
                isStudio
                  ? "text-sm text-white"
                  : "text-sm text-violet-950 dark:text-violet-100"
              )}
            >
              {isStudio ? (
                <ScanLine className="h-4 w-4 text-cyan-400" aria-hidden />
              ) : (
                <Video className="h-4 w-4 text-violet-600" aria-hidden />
              )}
              Références visuelles
            </p>
            <p
              className={cn(
                "mt-1 max-w-md text-xs leading-relaxed",
                isStudio ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"
              )}
            >
              {isStudio
                ? "Calibrez Veo sur votre produit réel : photos, mouvement caméra, éclairage. Import fichier ou galerie."
                : "Photos ou vidéos pour un rendu photoréaliste (produit, lumière, mouvement caméra)."}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
              isStudio
                ? "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                : "bg-violet-600/10 text-violet-800 dark:text-violet-200"
            )}
          >
            {isStudio ? "Studio IA" : "Optionnel"}
          </span>
        </div>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            if (!disabled) setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragOver(false)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={cn(
            "relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300",
            isStudio
              ? cn(
                  "border-violet-500/35 bg-violet-500/5 px-4 py-5",
                  dragOver && "border-cyan-400/60 bg-cyan-500/10 scale-[1.01]",
                  !dragOver && "hover:border-violet-400/50 hover:bg-violet-500/10"
                )
              : cn(
                  "border-violet-300/80 bg-white/60 px-4 py-6 dark:border-violet-800 dark:bg-zinc-950/40",
                  dragOver && "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                )
          )}
        >
          {references.length > 0 ? (
            <ul className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {references.map((ref) => (
                <ReferenceTile
                  key={ref.id}
                  refAsset={ref}
                  studio={isStudio}
                  disabled={disabled}
                  onRemove={() => removeRef(ref.id)}
                />
              ))}
              {references.length < MAX_IMAGES + MAX_VIDEOS ? (
                <li
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl border border-dashed",
                    isStudio
                      ? "border-white/10 bg-white/5 text-zinc-500"
                      : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
                  )}
                >
                  <PlusSlot uploading={uploading} studio={isStudio} />
                </li>
              ) : null}
            </ul>
          ) : (
            <div className="py-4 text-center">
              {uploading ? (
                <Loader2
                  className={cn(
                    "mx-auto h-10 w-10 animate-spin",
                    isStudio ? "text-violet-400" : "text-violet-600"
                  )}
                  aria-hidden
                />
              ) : (
                <ImagePlus
                  className={cn(
                    "mx-auto h-10 w-10",
                    isStudio ? "text-violet-400/80" : "text-violet-500/70"
                  )}
                  aria-hidden
                />
              )}
              <p
                className={cn(
                  "mt-2 text-sm font-medium",
                  isStudio ? "text-zinc-200" : "text-zinc-700 dark:text-zinc-300"
                )}
              >
                Glisser-déposer ou cliquer
              </p>
              <p className={cn("mt-1 text-xs", isStudio ? "text-zinc-500" : "text-zinc-500")}>
                JPG, PNG, WebP · MP4, WebM, MOV (48 Mo max)
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            multiple
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => void handleFiles(e.target.files)}
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition",
                isStudio
                  ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 text-white shadow-lg shadow-violet-900/40 hover:brightness-110 disabled:opacity-50"
                  : "bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              Importer photo / vidéo
            </button>
          </div>
        </div>

        {galleryAvailable.length > 0 ? (
          <div
            className={cn(
              "space-y-2 border-t pt-3",
              isStudio ? "border-white/10" : "border-violet-200/60 dark:border-violet-900/40"
            )}
          >
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.14em]",
                isStudio ? "text-zinc-500" : "text-zinc-500"
              )}
            >
              Depuis la fiche produit
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {galleryAvailable.slice(0, 10).map((url) => (
                <button
                  key={url}
                  type="button"
                  disabled={disabled || atImageLimit}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-transparent transition",
                    isStudio
                      ? "hover:ring-cyan-400/70 hover:shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]"
                      : "hover:ring-violet-400",
                    "disabled:opacity-40"
                  )}
                  onClick={() => addReference({ url, kind: "image", source: "gallery" })}
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="64px" unoptimized />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill studio={isStudio} label={`${imageCount}/${MAX_IMAGES} photos`} />
          <StatusPill studio={isStudio} label={`${videoCount}/${MAX_VIDEOS} vidéo`} />
          {isStudio && references.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90">
              <Sparkles className="h-3 w-3" aria-hidden />
              Envoyées à Veo avec votre prompt
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ studio, label }: { studio: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        studio
          ? "border border-white/10 bg-white/5 text-zinc-400"
          : "text-zinc-500"
      )}
    >
      {label}
    </span>
  )
}

function PlusSlot({ uploading, studio }: { uploading: boolean; studio: boolean }) {
  if (uploading) {
    return <Loader2 className="h-6 w-6 animate-spin text-violet-500" aria-hidden />
  }
  return <span className={cn("text-2xl font-light", studio ? "text-zinc-600" : "text-zinc-400")}>+</span>
}

function ReferenceTile({
  refAsset,
  studio,
  disabled,
  onRemove,
}: {
  refAsset: CreativeReferenceAsset
  studio: boolean
  disabled?: boolean
  onRemove: () => void
}) {
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-xl ring-1 transition",
        studio
          ? "ring-white/10 bg-zinc-900 hover:ring-violet-500/50 hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.5)]"
          : "border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      )}
    >
      {refAsset.kind === "image" ? (
        <div className="relative aspect-square">
          <Image
            src={refAsset.url}
            alt=""
            fill
            className="object-cover"
            sizes="120px"
            unoptimized
          />
        </div>
      ) : (
        <div className="relative aspect-square bg-black">
          <video
            src={refAsset.url}
            className="h-full w-full object-cover"
            muted
            playsInline
            loop
            preload="metadata"
            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-t from-black/70 via-transparent to-transparent">
            <Film className="h-6 w-6 text-white/90" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">
              Vidéo
            </span>
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label="Retirer la référence"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

export function referencesToApiPayload(refs: CreativeReferenceAsset[]) {
  return {
    referenceImageUrls: refs.filter((r) => r.kind === "image").map((r) => r.url),
    referenceVideoUrls: refs.filter((r) => r.kind === "video").map((r) => r.url),
  }
}
