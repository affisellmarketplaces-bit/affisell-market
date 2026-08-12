"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, PackageX, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { clearSupplierAddProductDraftCache } from "@/lib/supplier-add-product-draft-cache"
import { SUPPLIER_PRODUCT_REMOVE_CODE } from "@/lib/supplier-product-remove-shared"
import { cn } from "@/lib/utils"

type Props = {
  ownerUserId?: string
  productId: string
  productName?: string
  isDraft: boolean
  partnersListed: number
  variant?: "icon" | "button"
  className?: string
  onDone?: () => void
  redirectTo?: string
}

export function SupplierProductRemoveActions({
  ownerUserId,
  productId,
  productName,
  isDraft,
  partnersListed,
  variant = "button",
  className,
  onDone,
  redirectTo,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const label = productName?.trim() || "ce produit"
  const requiresRecall = !isDraft && partnersListed > 0

  const finish = () => {
    onDone?.()
    if (redirectTo) {
      router.push(redirectTo)
    }
    router.refresh()
  }

  const handleDelete = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (requiresRecall) {
      toast.error(
        `${partnersListed} revendeur${partnersListed === 1 ? "" : "s"} en vitrine — utilisez le rappel produit.`
      )
      return
    }

    const confirmMsg = isDraft
      ? `Supprimer « ${label} » ? Cette action est irréversible.`
      : `Supprimer définitivement « ${label} » ? Aucun revendeur ne l'affiche actuellement.`

    if (!window.confirm(confirmMsg)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}`, {
        method: "DELETE",
      })
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          code?: string
          listedAffiliateCount?: number
        }
        if (data.code === SUPPLIER_PRODUCT_REMOVE_CODE.REQUIRES_RECALL) {
          const n = data.listedAffiliateCount ?? partnersListed
          toast.error(
            `${n} revendeur${n === 1 ? "" : "s"} en vitrine — lancez un rappel produit à la place.`
          )
          return
        }
        toast.error(
          typeof data.error === "string"
            ? data.error
            : "Impossible de supprimer : ce produit a déjà des commandes."
        )
        return
      }
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(typeof data.error === "string" ? data.error : "Suppression impossible.")
        return
      }

      clearSupplierAddProductDraftCache(ownerUserId)
      toast.success(isDraft ? "Brouillon supprimé." : "Produit supprimé.")
      finish()
    } catch {
      toast.error("Erreur réseau — réessayez.")
    } finally {
      setLoading(false)
    }
  }

  const handleRecall = async (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (
      !window.confirm(
        `Rappel produit pour « ${label} » ?\n\n` +
          `${partnersListed} vitrine${partnersListed === 1 ? "" : "s"} partenaire seront retirées. ` +
          `Les revendeurs seront notifiés. Le SKU passera en pause (brouillon).`
      )
    ) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${encodeURIComponent(productId)}/recall`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        listedAffiliatesUnlisted?: number
      }
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Rappel impossible.")
        return
      }

      const n = data.listedAffiliatesUnlisted ?? partnersListed
      toast.success(
        n > 0
          ? `Produit rappelé — ${n} vitrine${n === 1 ? "" : "s"} partenaire retirée${n === 1 ? "" : "s"}.`
          : "Produit retiré du catalogue partenaires."
      )
      finish()
    } catch {
      toast.error("Erreur réseau — réessayez.")
    } finally {
      setLoading(false)
    }
  }

  const onClick = requiresRecall ? handleRecall : handleDelete
  const ariaLabel = requiresRecall ? "Rappel produit" : isDraft ? "Supprimer le brouillon" : "Supprimer le produit"
  const Icon = requiresRecall ? PackageX : Trash2
  const buttonLabel = requiresRecall
    ? "Rappel produit"
    : isDraft
      ? "Supprimer le brouillon"
      : "Supprimer"

  if (variant === "icon") {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={(e) => void onClick(e)}
        className={cn(
          requiresRecall
            ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
            : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-900/60 dark:hover:bg-red-950/40 dark:hover:text-red-400",
          className
        )}
        aria-label={ariaLabel}
        title={buttonLabel}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Icon className="h-4 w-4" aria-hidden />
        )}
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={(e) => void onClick(e)}
      className={cn(
        requiresRecall
          ? "gap-1.5 border-amber-200 text-amber-900 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-950/40"
          : "gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="h-4 w-4" aria-hidden />
      )}
      {buttonLabel}
    </Button>
  )
}
