"use client"

import { useCallback } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatStoreCurrency } from "@/lib/market-config"
import { marginEur, type ProductVariantApiRow } from "@/lib/product-variant-sku"
import { cn } from "@/lib/utils"

export type EditableVariantRow = Omit<ProductVariantApiRow, "margin"> & { margin?: number }

function newRow(): EditableVariantRow {
  return {
    id: `new-${crypto.randomUUID()}`,
    sku: null,
    color: null,
    size: null,
    supplierPrice: 0,
    publicPrice: 0,
    stock: 0,
    margin: 0,
  }
}

function withMargin(row: EditableVariantRow): EditableVariantRow {
  const supplier = Number(row.supplierPrice) || 0
  const pub = Number(row.publicPrice) || 0
  return { ...row, margin: marginEur(supplier, pub) }
}

type Props = {
  rows: EditableVariantRow[]
  onChange: (rows: EditableVariantRow[]) => void
  disabled?: boolean
  className?: string
}

export function SupplierVariantTable({ rows, onChange, disabled, className }: Props) {
  const updateRow = useCallback(
    (index: number, patch: Partial<EditableVariantRow>) => {
      onChange(
        rows.map((r, i) => (i === index ? withMargin({ ...r, ...patch }) : r))
      )
    },
    [rows, onChange]
  )

  const removeRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, i) => i !== index))
    },
    [rows, onChange]
  )

  const addRow = useCallback(() => {
    onChange([...rows, newRow()])
  }, [rows, onChange])

  const applyPublicPriceToAll = useCallback(() => {
    const first = rows[0]
    if (!first) return
    const pub = Number(first.publicPrice) || 0
    onChange(rows.map((r) => withMargin({ ...r, publicPrice: pub })))
  }, [rows, onChange])

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Tableau SKU — prix fournisseur & prix public
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || rows.length === 0}
            onClick={applyPublicPriceToAll}
          >
            Appliquer prix public à tous
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Ajouter variante
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2.5">Couleur</th>
              <th className="px-3 py-2.5">Taille</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">Stock</th>
              <th className="px-3 py-2.5">Prix fournisseur</th>
              <th className="px-3 py-2.5">Prix public</th>
              <th className="px-3 py-2.5">Marge</th>
              <th className="w-10 px-2 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  Aucune variante — ajoutez une ligne pour commencer.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id ?? index} className="bg-white dark:bg-zinc-950">
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-9 min-w-[88px]"
                      value={row.color ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { color: e.target.value || null })}
                      placeholder="Noir"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-9 min-w-[72px]"
                      value={row.size ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { size: e.target.value || null })}
                      placeholder="M"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-9 min-w-[100px] font-mono text-xs"
                      value={row.sku ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { sku: e.target.value || null })}
                      placeholder="SKU-001"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      className="h-9 w-20"
                      value={row.stock}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(index, { stock: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="h-9 w-28"
                      value={row.supplierPrice || ""}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(index, { supplierPrice: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="h-9 w-28"
                      value={row.publicPrice || ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { publicPrice: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatStoreCurrency(row.margin ?? marginEur(row.supplierPrice, row.publicPrice))}
                  </td>
                  <td className="px-1 py-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-600"
                      disabled={disabled}
                      onClick={() => removeRow(index)}
                      aria-label="Supprimer la variante"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
