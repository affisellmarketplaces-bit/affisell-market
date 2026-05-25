"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, Zap } from "lucide-react"
import { toast } from "sonner"

import type { ProductCommissionOpportunity } from "@/lib/supplier-product-opportunity-shared"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  opportunity: ProductCommissionOpportunity
  className?: string
}

export function SupplierOpportunityBoostButton({ opportunity, className }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const alreadyBoosted = opportunity.currentCommissionPct >= opportunity.suggestedCommissionPct

  async function handleBoost() {
    if (alreadyBoosted || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${opportunity.productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission: opportunity.suggestedCommissionPct }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Mise à jour impossible")
      }
      toast.success(
        `Commission passée à ${opportunity.suggestedCommissionPct}% sur « ${opportunity.productName} »`
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      disabled={alreadyBoosted || loading}
      onClick={() => void handleBoost()}
      className={cn(
        buttonVariants({ size: "sm" }),
        "gap-2 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600",
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Zap className="h-4 w-4" aria-hidden />
      )}
      {alreadyBoosted
        ? `Commission à ${opportunity.suggestedCommissionPct}%`
        : "Proposer +2% commission"}
    </button>
  )
}
