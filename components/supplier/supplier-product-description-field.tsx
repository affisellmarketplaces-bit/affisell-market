"use client"

import { useCallback, useId, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { SupplierDescriptionIllustrationFields } from "@/components/supplier/supplier-description-illustration-fields"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DESCRIPTION_ILLUSTRATION_MAX,
  DESCRIPTION_ILLUSTRATION_MIN_H,
  DESCRIPTION_ILLUSTRATION_MIN_W,
  DescriptionIllustrationSizeError,
  imageFilesFromDataTransfer,
  processDescriptionIllustrationFile,
} from "@/lib/description-illustration-image"
import { cn } from "@/lib/utils"

const MAX_GALLERY_FOR_AI = 2
const MAX_ILLUSTRATIONS_FOR_AI = 3

function parseGenerateDescriptionError(raw: string): string {
  const trimmed = raw.trim()
  try {
    const outer = JSON.parse(trimmed) as { error?: { message?: string } | string; message?: string }
    const inner =
      typeof outer.error === "object" && outer.error?.message
        ? outer.error.message
        : typeof outer.error === "string"
          ? outer.error
          : outer.message
    if (inner) return parseGenerateDescriptionError(inner)
  } catch {
    /* plain text */
  }
  if (/too many images/i.test(trimmed)) {
    return "Trop d'images pour l'IA (max. 4). Gardez au plus 3 illustrations, ou retirez des photos galerie."
  }
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed
}

type Props = {
  description: string
  onDescriptionChange: (value: string) => void
  illustrationImages: string[]
  onIllustrationImagesChange: (urls: string[]) => void
  illustrationVideos: string[]
  onIllustrationVideosChange: (urls: string[]) => void
  productTitle: string
  productGalleryImages: string[]
  descriptionBullets: string[]
  onBulletPointsGenerated?: (bullets: string[]) => void
  categoryPathLabel: string
  disabled?: boolean
}

function isDataImageUrl(u: string): boolean {
  return /^data:image\//i.test(u)
}

function isHttpsImageUrl(u: string): boolean {
  return /^https?:\/\//i.test(u.trim())
}

export function SupplierProductDescriptionField({
  description,
  onDescriptionChange,
  illustrationImages,
  onIllustrationImagesChange,
  illustrationVideos,
  onIllustrationVideosChange,
  productTitle,
  productGalleryImages,
  descriptionBullets,
  onBulletPointsGenerated,
  categoryPathLabel,
  disabled = false,
}: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const composerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputId = useId()

  const ingestImageFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      if (disabled || aiLoading || imageBusy) return

      const remaining = DESCRIPTION_ILLUSTRATION_MAX - illustrationImages.length
      if (remaining <= 0) {
        toast.error(`Maximum ${DESCRIPTION_ILLUSTRATION_MAX} images dans la description.`)
        return
      }

      setImageBusy(true)
      const added: string[] = []
      try {
        for (const file of files.slice(0, remaining)) {
          try {
            added.push(await processDescriptionIllustrationFile(file))
          } catch (e) {
            if (e instanceof DescriptionIllustrationSizeError) {
              toast.error(
                `${e.fileName} : image trop petite (min. ${e.minW}×${e.minH} px).`
              )
            } else {
              toast.error(`Impossible de traiter ${file.name}.`)
            }
          }
        }
        if (added.length > 0) {
          onIllustrationImagesChange([...illustrationImages, ...added].slice(0, DESCRIPTION_ILLUSTRATION_MAX))
          toast.success(
            added.length === 1 ? "Image ajoutée à la description" : `${added.length} images ajoutées`
          )
        }
      } finally {
        setImageBusy(false)
      }
    },
    [aiLoading, disabled, illustrationImages, imageBusy, onIllustrationImagesChange]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = imageFilesFromDataTransfer(e.clipboardData)
      if (files.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      void ingestImageFiles(files)
    },
    [ingestImageFiles]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const files = imageFilesFromDataTransfer(e.dataTransfer)
      if (files.length === 0) return
      void ingestImageFiles(files)
    },
    [ingestImageFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (imageFilesFromDataTransfer(e.dataTransfer).length === 0) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      e.target.value = ""
      if (files.length > 0) void ingestImageFiles(files)
    },
    [ingestImageFiles]
  )

  const removeIllustrationAt = useCallback(
    (index: number) => {
      onIllustrationImagesChange(illustrationImages.filter((_, i) => i !== index))
    },
    [illustrationImages, onIllustrationImagesChange]
  )

  const handleGenerateDescription = useCallback(async () => {
    const title = productTitle.trim()
    const notes = description.trim()
    const bullets = descriptionBullets.map((s) => s.trim()).filter(Boolean)

    if (title.length < 2 && notes.length < 10 && bullets.length === 0 && productGalleryImages.length === 0) {
      toast.error("Ajoutez un titre, du texte dans la description, des points clés ou des photos produit.")
      return
    }

    setAiLoading(true)
    try {
      const productImageUrls = productGalleryImages.filter(isHttpsImageUrl).slice(0, MAX_GALLERY_FOR_AI)
      const productImageDataUrls = productGalleryImages
        .filter(isDataImageUrl)
        .slice(0, MAX_GALLERY_FOR_AI)
      const illustrationForAi = illustrationImages.slice(0, MAX_ILLUSTRATIONS_FOR_AI)

      const res = await fetch("/api/supplier/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          notes,
          bullets,
          categoryPath: categoryPathLabel,
          productImageUrls,
          productImageDataUrls,
          illustrationDataUrls: illustrationForAi,
          generateMissingIllustrations: true,
        }),
      })

      const data = (await res.json()) as {
        error?: string
        description?: string
        bulletPoints?: string[]
        illustrationImages?: string[]
        illustrationSource?: string
      }

      if (!res.ok) {
        throw new Error(parseGenerateDescriptionError(data.error ?? "Génération impossible"))
      }

      if (data.description?.trim()) {
        onDescriptionChange(data.description.trim())
      }

      if (Array.isArray(data.bulletPoints) && data.bulletPoints.length > 0 && onBulletPointsGenerated) {
        onBulletPointsGenerated(data.bulletPoints)
      }

      if (Array.isArray(data.illustrationImages) && data.illustrationImages.length > 0) {
        onIllustrationImagesChange(data.illustrationImages.slice(0, DESCRIPTION_ILLUSTRATION_MAX))
      }

      const source = data.illustrationSource ?? "none"
      const sourceLabel =
        source === "kept_user"
          ? "vos images d'illustration"
          : source === "from_gallery"
            ? "photos produit"
            : source === "generated_hf"
              ? "image IA"
              : null

      toast.success(
        sourceLabel
          ? `Description SEO générée · illustrations : ${sourceLabel}`
          : "Description SEO générée"
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "IA indisponible")
    } finally {
      setAiLoading(false)
    }
  }, [
    categoryPathLabel,
    description,
    descriptionBullets,
    illustrationImages,
    onBulletPointsGenerated,
    onDescriptionChange,
    onIllustrationImagesChange,
    productGalleryImages,
    productTitle,
  ])

  const composerDisabled = disabled || aiLoading || imageBusy

  const openFilePicker = useCallback(() => {
    if (composerDisabled) return
    fileInputRef.current?.click()
  }, [composerDisabled])

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="p-desc" className="mb-0">
            Description
          </Label>
          <Button
            type="button"
            size="sm"
            disabled={composerDisabled}
            onClick={() => void handleGenerateDescription()}
            className="gap-1.5 bg-violet-600 text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:opacity-60"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {aiLoading ? "Génération..." : "Générer description IA"}
          </Button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Saisissez vos notes, collez ou déposez des images directement dans la zone ci-dessous — l’IA structure le
          texte (SEO) et peut illustrer à partir de vos visuels.
        </p>

        <div
          ref={composerRef}
          onPasteCapture={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={(e) => {
            if (!composerRef.current?.contains(e.relatedTarget as Node)) {
              setDragOver(false)
            }
          }}
          className={cn(
            "relative mt-1.5 overflow-hidden rounded-xl border bg-zinc-50/50 transition dark:bg-zinc-900/50",
            dragOver
              ? "border-violet-400 ring-2 ring-violet-400/25 dark:border-violet-500"
              : "border-zinc-200 dark:border-zinc-700",
            "focus-within:border-violet-400 focus-within:bg-white dark:focus-within:border-violet-600"
          )}
        >
          {illustrationImages.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-zinc-200/80 bg-white/60 p-2.5 dark:border-zinc-700 dark:bg-zinc-900/60">
              {illustrationImages.map((url, index) => (
                <div
                  key={`${index}-${url.slice(0, 32)}`}
                  className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    disabled={composerDisabled}
                    onClick={() => removeIllustrationAt(index)}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-90 shadow hover:bg-red-600 disabled:opacity-50"
                    aria-label="Retirer l'image"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              {imageBusy && (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-violet-300 bg-violet-50/80 dark:border-violet-700 dark:bg-violet-950/40">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" aria-hidden />
                </div>
              )}
            </div>
          )}

          {imageBusy && illustrationImages.length === 0 && (
            <div className="flex items-center gap-2 border-b border-zinc-200/80 px-3 py-2 text-xs text-violet-700 dark:border-zinc-700 dark:text-violet-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Traitement de l’image…
            </div>
          )}

          <textarea
            id="p-desc"
            className={cn(
              "min-h-[160px] w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none",
              "placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            )}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            placeholder="Notes, bénéfices, matériaux, public cible… Collez une image (Ctrl+V) ou glissez-la ici."
            disabled={composerDisabled}
          />

          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={composerDisabled}
            onChange={handleFileInputChange}
          />

          <p className="flex flex-wrap items-center gap-1.5 border-t border-zinc-200/60 px-3 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-700/80 dark:text-zinc-400">
            <button
              type="button"
              disabled={composerDisabled || illustrationImages.length >= DESCRIPTION_ILLUSTRATION_MAX}
              onClick={openFilePicker}
              className="inline-flex shrink-0 items-center gap-1 rounded-md text-violet-600 transition hover:bg-violet-50 hover:text-violet-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-950/50"
              aria-label="Ajouter une image depuis vos fichiers"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              <span className="font-medium underline decoration-dotted underline-offset-2">
                Parcourir
              </span>
            </button>
            <span>
              · Ctrl+V ou glisser-déposer · max. {DESCRIPTION_ILLUSTRATION_MAX} images · min.{" "}
              {DESCRIPTION_ILLUSTRATION_MIN_W}×{DESCRIPTION_ILLUSTRATION_MIN_H} px
            </span>
            {illustrationImages.length > 0 && (
              <span className="text-violet-600 dark:text-violet-400">
                · {illustrationImages.length}/{DESCRIPTION_ILLUSTRATION_MAX}
              </span>
            )}
          </p>
        </div>
      </div>

      <SupplierDescriptionIllustrationFields
        images={illustrationImages}
        onImagesChange={onIllustrationImagesChange}
        videos={illustrationVideos}
        onVideosChange={onIllustrationVideosChange}
        hideImageGrid
      />
    </div>
  )
}
