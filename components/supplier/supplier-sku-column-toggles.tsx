"use client"

import { Eye, EyeOff } from "lucide-react"

import {
  SKU_OPTIONAL_COLUMN_KEYS,
  SKU_OPTIONAL_COLUMN_LABELS,
  type SkuOptionalColumnKey,
  toggleSkuHiddenColumn,
} from "@/lib/supplier-sku-columns"
import { cn } from "@/lib/utils"

type Props = {
  hiddenColumns: SkuOptionalColumnKey[]
  onHiddenColumnsChange: (hidden: SkuOptionalColumnKey[]) => void
  disabled?: boolean
  className?: string
  /** Compact label for toolbar vs full block in fast panel */
  variant?: "toolbar" | "panel"
}

export function SupplierSkuColumnToggles({
  hiddenColumns,
  onHiddenColumnsChange,
  disabled,
  className,
  variant = "panel",
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <p
        className={cn(
          "text-zinc-600 dark:text-zinc-400",
          variant === "toolbar" ? "text-[11px]" : "text-xs font-medium"
        )}
      >
        {variant === "toolbar" ? "Colonnes :" : "Champs & colonnes affichés"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SKU_OPTIONAL_COLUMN_KEYS.map((key) => {
          const visible = !hiddenColumns.includes(key)
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              title={
                visible
                  ? `Masquer « ${SKU_OPTIONAL_COLUMN_LABELS[key]} »`
                  : `Réafficher « ${SKU_OPTIONAL_COLUMN_LABELS[key]} »`
              }
              onClick={() =>
                onHiddenColumnsChange(toggleSkuHiddenColumn(hiddenColumns, key))
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                visible
                  ? "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100"
                  : "border-zinc-200 bg-zinc-100 text-zinc-500 line-through hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              )}
            >
              {visible ? (
                <Eye className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              ) : (
                <EyeOff className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              )}
              {SKU_OPTIONAL_COLUMN_LABELS[key]}
            </button>
          )
        })}
      </div>
      {variant === "panel" ? (
        <p className="text-[11px] text-zinc-500">
          Cliquez pour masquer un champ (prix, SKU, stock, prix barré, etc.) qui ne s&apos;applique pas.
          Les colonnes personnalisées se dupliquent (icône copie) pour varier couleur, SKU ou
          spécifications par ligne, puis se retirent avec la poubelle.
        </p>
      ) : variant === "toolbar" && !hiddenColumns.includes("compareAt") ? (
        <p className="text-[11px] text-zinc-500">
          « Prix barré » : champs numériques dans la colonne Barré du tableau (prix avant promo).
        </p>
      ) : null}
    </div>
  )
}
