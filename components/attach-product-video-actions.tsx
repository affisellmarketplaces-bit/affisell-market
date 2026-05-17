"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AttachVideoPlacement } from "@/lib/attach-generated-product-video"

type AttachResult = {
  placement: AttachVideoPlacement
  descriptionIllustrationVideos: string[]
  videoAdUrl: string | null
  inDescription: boolean
  onGallery: boolean
}

type AttachStatus = {
  generatedVideoUrl: string | null
  inDescription: boolean
  onGallery: boolean
  activePlacement: AttachVideoPlacement | null
  editUrl?: string
}

type Props = {
  productId: string
  videoUrl?: string | null
  className?: string
  /** Sync formulaire édition après publication (évite qu’un save écrase la BDD). */
  onAttached?: (result: AttachResult) => void
}

export function AttachProductVideoActions({
  productId,
  videoUrl: videoUrlProp,
  className,
  onAttached,
}: Props) {
  const [status, setStatus] = useState<AttachStatus | null>(null)
  const [loadingPlacement, setLoadingPlacement] = useState<AttachVideoPlacement | null>(null)

  const effectiveVideoUrl = videoUrlProp?.trim() || status?.generatedVideoUrl?.trim() || null

  const refreshStatus = useCallback(async () => {
    if (!productId.trim()) return
    try {
      const res = await fetch(
        `/api/supplier/products/${encodeURIComponent(productId)}/attach-generated-video`,
        { credentials: "include", cache: "no-store" }
      )
      if (!res.ok) return
      const data = (await res.json()) as AttachStatus
      setStatus(data)
    } catch {
      /* ignore */
    }
  }, [productId])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus, videoUrlProp])

  async function publish(placement: AttachVideoPlacement) {
    if (!effectiveVideoUrl) {
      toast.error("Générez d'abord une vidéo.")
      return
    }
    setLoadingPlacement(placement)
    try {
      const res = await fetch(
        `/api/supplier/products/${encodeURIComponent(productId)}/attach-generated-video`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placement, videoUrl: effectiveVideoUrl }),
        }
      )
      const data = (await res.json()) as AttachResult & {
        error?: string
        message?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Impossible de publier la vidéo")
      }

      setStatus((prev) => ({
        generatedVideoUrl: effectiveVideoUrl,
        inDescription: data.inDescription,
        onGallery: data.onGallery,
        activePlacement: placement,
        editUrl: prev?.editUrl,
      }))

      onAttached?.({
        placement: data.placement,
        descriptionIllustrationVideos: data.descriptionIllustrationVideos,
        videoAdUrl: data.videoAdUrl ?? null,
        inDescription: data.inDescription,
        onGallery: data.onGallery,
      })

      toast.success(
        placement === "description"
          ? "Vidéo publiée dans la description"
          : "Vidéo publiée après les photos produit"
      )
      await refreshStatus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec")
    } finally {
      setLoadingPlacement(null)
    }
  }

  if (!videoUrlProp && status === null) return null

  if (!effectiveVideoUrl) {
    return (
      <p className={cn("text-xs text-zinc-500 dark:text-zinc-400", className)}>
        <Link
          href={`/dashboard/supplier/products/${encodeURIComponent(productId)}`}
          className="font-medium text-violet-700 underline dark:text-violet-400"
        >
          Générer une vidéo
        </Link>{" "}
        pour la publier sur la fiche.
      </p>
    )
  }

  const active = status?.activePlacement ?? null

  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50", className)}>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Publier</p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Choisissez où afficher la vidéo sur la fiche marketplace.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={active === "description" ? "secondary" : "bentoAccent"}
          size="sm"
          className="flex-1 justify-center gap-2"
          disabled={loadingPlacement !== null}
          onClick={() => void publish("description")}
        >
          {loadingPlacement === "description" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : active === "description" ? (
            <Check className="h-4 w-4" />
          ) : null}
          Description
        </Button>

        <Button
          type="button"
          variant={active === "afterGallery" ? "secondary" : "outline"}
          size="sm"
          className="flex-1 justify-center gap-2"
          disabled={loadingPlacement !== null}
          onClick={() => void publish("afterGallery")}
        >
          {loadingPlacement === "afterGallery" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : active === "afterGallery" ? (
            <Check className="h-4 w-4" />
          ) : null}
          Après les photos
        </Button>
      </div>

      {active === "description" ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          Visible sous le texte descriptif (section Photos &amp; vidéos).
        </p>
      ) : null}
      {active === "afterGallery" ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
          Visible sous la galerie photos principale.
        </p>
      ) : null}
    </div>
  )
}
