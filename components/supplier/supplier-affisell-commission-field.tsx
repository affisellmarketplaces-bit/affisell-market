"use client"

import { useEffect, useState } from "react"

import { Label } from "@/components/ui/label"
import { affisellCommissionRateBpsToPercent } from "@/lib/affisell-platform-commission"
import { cn } from "@/lib/utils"

type Props = {
  categoryId: string
  value: string
  onChange: (value: string) => void
  productOverrideBps?: number | null
  className?: string
}

export function SupplierAffisellCommissionField({
  categoryId,
  value,
  onChange,
  productOverrideBps,
  className,
}: Props) {
  const [effectivePercent, setEffectivePercent] = useState<number | null>(null)
  const [categoryExplicitPercent, setCategoryExplicitPercent] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = categoryId.trim()
    if (!id) {
      setEffectivePercent(null)
      setCategoryExplicitPercent(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetch(`/api/supplier/category-affisell-commission?categoryId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data: { effectivePercent?: number; affisellCommissionRateBps?: number | null }) => {
        if (cancelled) return
        setEffectivePercent(
          typeof data.effectivePercent === "number" ? data.effectivePercent : null
        )
        setCategoryExplicitPercent(
          data.affisellCommissionRateBps != null
            ? affisellCommissionRateBpsToPercent(data.affisellCommissionRateBps)
            : null
        )
      })
      .catch(() => {
        if (!cancelled) {
          setEffectivePercent(null)
          setCategoryExplicitPercent(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId])

  const appliedPercent =
    value.trim() !== ""
      ? Number(value)
      : productOverrideBps != null
        ? affisellCommissionRateBpsToPercent(productOverrideBps)
        : effectivePercent

  return (
    <div className={cn("space-y-2 rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20", className)}>
      <div>
        <Label htmlFor="affisell-commission-override" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Commission Affisell (plateforme)
        </Label>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          Frais prélevés par Affisell sur chaque vente marketplace. Laissez vide pour suivre la catégorie.
          Ce champ est distinct de la commission affilié sur votre marge.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="affisell-commission-override" className="text-[11px] text-zinc-500">
            Override produit (%)
          </Label>
          <input
            id="affisell-commission-override"
            type="number"
            min={0}
            max={50}
            step={0.1}
            placeholder={effectivePercent != null ? String(effectivePercent) : "—"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          {loading ? (
            <span>Calcul du taux catégorie…</span>
          ) : categoryId.trim() ? (
            <>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Taux effectif : {appliedPercent != null ? `${appliedPercent.toFixed(1)} %` : "—"}
              </span>
              {categoryExplicitPercent != null ? (
                <span className="ml-1 text-zinc-500">(catégorie : {categoryExplicitPercent.toFixed(1)} %)</span>
              ) : effectivePercent != null ? (
                <span className="ml-1 text-zinc-500">(hérité)</span>
              ) : null}
            </>
          ) : (
            <span>Choisissez une catégorie pour voir le taux par défaut.</span>
          )}
        </div>
      </div>
    </div>
  )
}
