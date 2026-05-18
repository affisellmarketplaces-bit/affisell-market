"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { clearSupplierAddProductDraftCache } from "@/lib/supplier-add-product-draft-cache"
import { cn } from "@/lib/utils"

type Props = {
  productId: string
  productName?: string
  variant?: "icon" | "button"
  className?: string
  onDeleted?: () => void
  /** When set, navigates here after a successful delete. */
  redirectTo?: string
}

export function SupplierDeleteDraftButton({
  productId,
  productName,
  variant = "button",
  className,
  onDeleted,
  redirectTo,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    const label = productName?.trim() || "ce brouillon"
    if (!window.confirm(`Supprimer « ${label} » ? Cette action est irréversible.`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      })
      if (res.status === 409) {
        toast.error("Impossible de supprimer : ce produit a déjà des commandes.")
        return
      }
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(typeof data.error === "string" ? data.error : "Suppression impossible.")
        return
      }

      clearSupplierAddProductDraftCache()
      toast.success("Brouillon supprimé.")
      onDeleted?.()
      if (redirectTo) {
        router.push(redirectTo)
        router.refresh()
      } else {
        router.refresh()
      }
    } catch {
      toast.error("Erreur réseau — réessayez.")
    } finally {
      setLoading(false)
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={(e) => void handleDelete(e)}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-900/60 dark:hover:bg-red-950/40 dark:hover:text-red-400",
          className
        )}
        aria-label="Supprimer le brouillon"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={(e) => void handleDelete(e)}
      className={cn(
        "gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40",
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
      Supprimer le brouillon
    </Button>
  )
}
