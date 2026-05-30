"use client"

import { useCallback, useId, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { ImagePlus, Layers, Loader2, Sparkles, X } from "lucide-react"
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
import {
  type DescriptionImagePlacement,
  IMAGE_ROLE_LABELS,
  parseDescriptionSections,
} from "@/lib/description-structure"
import { isRawProductFeatureDump } from "@/lib/supplier-generate-description"
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
    return "Trop d'images pour la génération (max. 4). Gardez au plus 3 illustrations, ou retirez des photos galerie."
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
  /** Category spec fields filled by supplier — primary facts for AI copy */
  productSpecs?: Array<{ label: string; value: string }>
  disabled?: boolean
}

function isDataImageUrl(u: string): boolean {
  return /^data:image\//i.test(u)
}

function isHttpsImageUrl(u: string): boolean {
  return /^https?:\/\//i.test(u.trim())
}

function DescriptionStructurePreview({ text }: { text: string }) {
  const sections = useMemo(() => parseDescriptionSections(text), [text])
  if (sections.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700/90 dark:text-cyan-300">
        <Layers className="size-3.5" aria-hidden />
        Structure SEO
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {sections.map((s) => (
          <div
            key={s.key}
            className={cn(
              "rounded-xl border px-2.5 py-2 text-left",
              s.body.length > 20
                ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                : "border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/40"
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {s.title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              {s.body || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImageStrategyBoard({
  images,
  placements,
}: {
  images: string[]
  placements: DescriptionImagePlacement[]
}) {
  if (images.length === 0) return null

  return (
    <div className="space-y-2 border-t border-violet-200/40 pt-3 dark:border-violet-900/40">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fuchsia-700/90 dark:text-fuchsia-300">
        Placement stratégique des visuels
      </p>
      <div className="flex flex-wrap gap-2">
        {images.map((url, index) => {
          const placement = placements.find((p) => p.imageIndex === index)
          const role = placement?.role && placement.role in IMAGE_ROLE_LABELS ? placement.role : "detail"
          return (
            <div
              key={`${index}-${url.slice(0, 24)}`}
              className="relative w-[calc(50%-0.25rem)] min-w-[140px] max-w-[200px] overflow-hidden rounded-xl border border-white/20 bg-zinc-900/80 shadow-lg sm:w-auto sm:flex-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="aspect-[4/3] w-full object-cover opacity-95" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-200">
                  {IMAGE_ROLE_LABELS[role]}
                </p>
                {placement?.section ? (
                  <p className="text-[10px] font-medium text-white">{placement.section}</p>
                ) : null}
                {placement?.caption ? (
                  <p className="line-clamp-2 text-[9px] text-white/75">{placement.caption}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
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
  productSpecs = [],
  disabled = false,
}: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [imagePlacements, setImagePlacements] = useState<DescriptionImagePlacement[]>([])
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
      setImagePlacements((prev) => prev.filter((p) => p.imageIndex !== index))
    },
    [illustrationImages, onIllustrationImagesChange]
  )

  const handleGenerateDescription = useCallback(async () => {
    const title = productTitle.trim()
    const rawNotes = description.trim()
    const notes =
      rawNotes && !isRawProductFeatureDump(rawNotes, title) ? rawNotes : ""
    const bullets = descriptionBullets.map((s) => s.trim()).filter(Boolean)
    const specs = productSpecs.filter((s) => s.label.trim() && s.value.trim())

    if (
      title.length < 2 &&
      notes.length < 10 &&
      bullets.length === 0 &&
      specs.length === 0 &&
      productGalleryImages.length === 0
    ) {
      toast.error("Ajoutez un titre, des specs, des points clés ou des photos produit.")
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
          productSpecs: specs,
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
        imagePlacements?: DescriptionImagePlacement[]
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

      if (Array.isArray(data.imagePlacements) && data.imagePlacements.length > 0) {
        setImagePlacements(data.imagePlacements)
      }

      const source = data.illustrationSource ?? "none"
      const sourceLabel =
        source === "kept_user"
          ? "vos images"
          : source === "from_gallery"
            ? "galerie produit"
            : source === "generated_hf"
              ? "visuel généré"
              : null

      toast.success(
        sourceLabel
          ? `Description structurée · visuels : ${sourceLabel}`
          : "Description structurée générée"
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Service indisponible")
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
    productSpecs,
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
          <Label htmlFor="p-desc" className="mb-0 text-zinc-800 dark:text-zinc-100">
            Description
          </Label>
          <Button
            type="button"
            size="sm"
            disabled={composerDisabled}
            onClick={() => void handleGenerateDescription()}
            className="gap-1.5 border-0 bg-gradient-to-r from-cyan-600 via-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20 hover:opacity-95 disabled:opacity-50"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {aiLoading ? "Génération…" : "Générer la description"}
          </Button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Studio copy : titre + specs + visuels → fiche SEO structurée (ACCROCHE, POINTS FORTS…). Les listes
          brutes du titre ne sont pas recopiées ; la catégorie ne modifie pas le contenu.
        </p>

        <div
          className={cn(
            "relative mt-2 overflow-hidden rounded-2xl border shadow-sm",
            "border-violet-200/50 bg-gradient-to-br from-zinc-950/[0.02] via-white to-violet-50/30",
            "dark:border-violet-900/40 dark:from-zinc-950 dark:via-zinc-950/90 dark:to-violet-950/20"
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 0%, rgba(34,211,238,0.12), transparent 45%), radial-gradient(circle at 80% 100%, rgba(192,38,211,0.1), transparent 40%)",
            }}
            aria-hidden
          />

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
              "relative m-2 overflow-hidden rounded-xl border transition",
              dragOver
                ? "border-cyan-400 ring-2 ring-cyan-400/30"
                : "border-zinc-200/80 dark:border-zinc-700",
              "focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20"
            )}
          >
            {illustrationImages.length > 0 && (
              <div className="border-b border-zinc-200/60 bg-zinc-900/95 p-2.5 dark:border-zinc-700">
                <ImageStrategyBoard images={illustrationImages} placements={imagePlacements} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {illustrationImages.map((url, index) => (
                    <div
                      key={`${index}-${url.slice(0, 32)}`}
                      className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        disabled={composerDisabled}
                        onClick={() => removeIllustrationAt(index)}
                        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                        aria-label="Retirer"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              id="p-desc"
              className={cn(
                "min-h-[180px] w-full resize-y bg-transparent px-3 py-3 font-mono text-[13px] leading-relaxed outline-none",
                "text-zinc-800 placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              )}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              placeholder={`ACCROCHE\n…\n\nPOUR QUI ?\n…\n\nPOINTS FORTS\n…\n\n(Ctrl+V ou glissez une image)`}
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

            <p className="flex flex-wrap items-center gap-1.5 border-t border-zinc-200/60 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <button
                type="button"
                disabled={composerDisabled || illustrationImages.length >= DESCRIPTION_ILLUSTRATION_MAX}
                onClick={openFilePicker}
                className="inline-flex items-center gap-1 rounded-md font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/50"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                Parcourir
              </button>
              <span>
                · Ctrl+V · max. {DESCRIPTION_ILLUSTRATION_MAX} · min. {DESCRIPTION_ILLUSTRATION_MIN_W}×
                {DESCRIPTION_ILLUSTRATION_MIN_H} px
              </span>
            </p>
          </div>

          {description.trim().length > 40 ? (
            <div className="relative border-t border-violet-200/30 px-3 py-3 dark:border-violet-900/30">
              <DescriptionStructurePreview text={description} />
            </div>
          ) : null}
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
