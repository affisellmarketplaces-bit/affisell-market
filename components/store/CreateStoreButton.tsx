"use client"

import { Loader2, Rocket, Sparkles } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

type CreateStoreButtonProps = {
  productId: string
  /** Pre-filled slug (affiliate store) — skips name prompt when set. */
  defaultSlug?: string | null
  /** Label for prompt default / toast. */
  defaultStoreName?: string | null
  variant?: "default" | "compact"
  className?: string
}

type CreateStoreResponse = {
  success?: boolean
  url?: string
  slug?: string
  listingValid?: boolean | null
  error?: string
}

export function CreateStoreButton({
  productId,
  defaultSlug,
  defaultStoreName,
  variant = "default",
  className,
}: CreateStoreButtonProps) {
  const [busy, setBusy] = useState(false)

  const handleClick = useCallback(async () => {
    if (!productId.trim()) {
      toast.error("Listing introuvable", { description: "Sélectionnez un produit listé." })
      return
    }

    const slug = defaultSlug?.trim() || null
    let storeName: string | undefined
    if (!slug) {
      const suggested = defaultStoreName?.trim() || "ma-boutique"
      const name = window.prompt("Nom de ta boutique reseller ?", suggested)
      if (!name?.trim()) return
      storeName = name.trim()
    }

    setBusy(true)
    try {
      const res = await fetch("/api/store/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: slug ? undefined : storeName,
          slug: slug ?? undefined,
          productId,
        }),
      })
      const data = (await res.json()) as CreateStoreResponse
      if (!res.ok || !data.url) {
        toast.error("Impossible de créer la boutique", {
          description: data.error ?? "Réessayez dans un instant.",
        })
        return
      }
      if (data.listingValid === false) {
        toast.warning("Boutique créée — produit non trouvé", {
          description: "Vérifiez que le listing est bien publié (isListed).",
        })
      } else {
        toast.success("Boutique prête", {
          description: data.slug ? `/${data.slug}` : undefined,
        })
      }
      window.open(data.url, "_blank", "noopener,noreferrer")
    } catch {
      toast.error("Erreur réseau", { description: "Vérifiez votre connexion." })
    } finally {
      setBusy(false)
    }
  }, [defaultSlug, defaultStoreName, productId])

  const isCompact = variant === "compact"

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleClick()}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition",
        "bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600 shadow-md",
        "hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
        isCompact ? "h-10 px-3 text-xs" : "h-12 px-6 text-sm",
        className
      )}
    >
      {busy ? (
        <Loader2 className={cn("animate-spin", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
      ) : isCompact ? (
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Rocket className="h-4 w-4" aria-hidden />
      )}
      {isCompact ? "Boutique 1-clic" : "Créer ma boutique reseller"}
    </button>
  )
}
