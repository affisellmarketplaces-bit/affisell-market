"use client"

import { useCallback, useState } from "react"
import { ImagePlus, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { SupplierDescriptionIllustrationFields } from "@/components/supplier/supplier-description-illustration-fields"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const MAX_GALLERY_DATA_FOR_AI = 4

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
      const productImageUrls = productGalleryImages.filter(isHttpsImageUrl).slice(0, MAX_GALLERY_DATA_FOR_AI)
      const productImageDataUrls = productGalleryImages
        .filter(isDataImageUrl)
        .slice(0, MAX_GALLERY_DATA_FOR_AI)

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
          illustrationDataUrls: illustrationImages,
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
        throw new Error(data.error ?? "Génération impossible")
      }

      if (data.description?.trim()) {
        onDescriptionChange(data.description.trim())
      }

      if (Array.isArray(data.bulletPoints) && data.bulletPoints.length > 0 && onBulletPointsGenerated) {
        onBulletPointsGenerated(data.bulletPoints)
      }

      if (Array.isArray(data.illustrationImages) && data.illustrationImages.length > 0) {
        onIllustrationImagesChange(data.illustrationImages.slice(0, 4))
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
            disabled={disabled || aiLoading}
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
          Saisissez vos notes et ajoutez des images ci-dessous — l’IA structure le texte (SEO) et choisit ou génère
          des visuels d’illustration à partir de vos photos produit.
        </p>
        <textarea
          id="p-desc"
          className={cn(
            "mt-1.5 min-h-[160px] w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm outline-none transition",
            "focus:border-violet-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900/50 dark:focus:border-violet-600"
          )}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Notes, bénéfices, matériaux, public cible… L’IA transformera ceci en description structurée."
          disabled={disabled || aiLoading}
        />
      </div>

      <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 px-3 py-2.5 dark:border-violet-900/40 dark:bg-violet-950/20">
        <p className="flex items-center gap-2 text-xs font-medium text-violet-900 dark:text-violet-200">
          <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Images dans la description (affichées sous le texte sur la fiche produit)
        </p>
      </div>

      <SupplierDescriptionIllustrationFields
        images={illustrationImages}
        onImagesChange={onIllustrationImagesChange}
        videos={illustrationVideos}
        onVideosChange={onIllustrationVideosChange}
      />
    </div>
  )
}
