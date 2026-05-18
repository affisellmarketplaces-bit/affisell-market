"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Plus, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatStoreCurrency } from "@/lib/market-config"
import { marginEur } from "@/lib/product-variant-sku"
import {
  buildSkuCombinations,
  generateSkuTableRows,
  parseCommaList,
  suggestVariantSku,
  validateSupplierSkuTableRows,
  type SupplierSkuTableRow,
  type VariantRowValidationIssue,
} from "@/lib/supplier-sku-builder"
import { cn } from "@/lib/utils"

export type EditableVariantRow = SupplierSkuTableRow & { margin?: number }

function withMargin(row: EditableVariantRow): EditableVariantRow {
  const supplier = Number(row.supplierPrice) || 0
  const pub = Number(row.publicPrice) || 0
  return { ...row, margin: marginEur(supplier, pub) }
}

function newRow(defaults: {
  supplierPrice: number
  publicPrice: number
  commission: number
}): EditableVariantRow {
  return withMargin({
    id: `new-${crypto.randomUUID()}`,
    color: "",
    size: null,
    sku: null,
    supplierPrice: defaults.supplierPrice,
    publicPrice: defaults.publicPrice,
    stock: 0,
    commissionRate: defaults.commission,
  })
}

type Props = {
  rows: EditableVariantRow[]
  onChange: (rows: EditableVariantRow[]) => void
  onValidationChange?: (issues: VariantRowValidationIssue[]) => void
  basePriceEur: number
  defaultCommission: number
  skuPrefix?: string
  disabled?: boolean
  className?: string
  tableId?: string
}

export function SupplierVariantTable({
  rows,
  onChange,
  onValidationChange,
  basePriceEur,
  defaultCommission,
  skuPrefix = "PRD",
  disabled,
  className,
  tableId = "supplier-sku-table",
}: Props) {
  const [mode, setMode] = useState<"fast" | "table">("fast")
  const [fastColors, setFastColors] = useState("")
  const [fastSizes, setFastSizes] = useState("")
  const costTipId = useId()

  const baseSupplier = basePriceEur > 0 ? Math.round(basePriceEur * 0.6 * 100) / 100 : 10
  const basePublic = basePriceEur > 0 ? basePriceEur : 0

  const validationIssues = useMemo(() => validateSupplierSkuTableRows(rows), [rows])

  useEffect(() => {
    onValidationChange?.(validationIssues)
  }, [validationIssues, onValidationChange])

  const issueByIndex = useMemo(() => {
    const map = new Map<number, Set<string>>()
    for (const issue of validationIssues) {
      const set = map.get(issue.index) ?? new Set<string>()
      set.add(issue.field)
      map.set(issue.index, set)
    }
    return map
  }, [validationIssues])

  const totalStock = useMemo(
    () => rows.reduce((acc, r) => acc + Math.max(0, Math.round(r.stock) || 0), 0),
    [rows]
  )

  const comboPreview = useMemo(() => {
    const colors = parseCommaList(fastColors)
    const sizes = parseCommaList(fastSizes)
    return buildSkuCombinations(colors, sizes).length
  }, [fastColors, fastSizes])

  const updateRow = useCallback(
    (index: number, patch: Partial<EditableVariantRow>) => {
      onChange(
        rows.map((r, i) => {
          if (i !== index) return r
          const next = withMargin({ ...r, ...patch })
          if (patch.color !== undefined || patch.size !== undefined) {
            const color = (patch.color ?? r.color).trim()
            const size = patch.size !== undefined ? patch.size : r.size
            if (color && !(patch.sku !== undefined ? patch.sku : r.sku)?.trim()) {
              next.sku = suggestVariantSku(skuPrefix, color, size)
            }
          }
          if (
            (patch.supplierPrice === undefined || patch.supplierPrice <= 0) &&
            next.supplierPrice <= 0 &&
            baseSupplier > 0
          ) {
            next.supplierPrice = baseSupplier
          }
          return next
        })
      )
    },
    [rows, onChange, skuPrefix, baseSupplier]
  )

  const removeRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, i) => i !== index))
    },
    [rows, onChange]
  )

  const addRow = useCallback(() => {
    onChange([
      ...rows,
      newRow({
        supplierPrice: baseSupplier,
        publicPrice: basePublic,
        commission: defaultCommission,
      }),
    ])
  }, [rows, onChange, baseSupplier, basePublic, defaultCommission])

  const generateFromFast = useCallback(() => {
    const generated = generateSkuTableRows({
      colorsText: fastColors,
      sizesText: fastSizes,
      skuPrefix,
      baseSupplierPrice: baseSupplier,
      basePublicPrice: basePublic,
      defaultCommission,
    })
    if (generated.length === 0) return
    onChange(generated.map(withMargin))
    setMode("table")
  }, [fastColors, fastSizes, skuPrefix, baseSupplier, basePublic, defaultCommission, onChange])

  const applyPublicPriceToAll = useCallback(() => {
    const pub = basePublic > 0 ? basePublic : Number(rows[0]?.publicPrice) || 0
    if (pub <= 0) return
    onChange(rows.map((r) => withMargin({ ...r, publicPrice: pub })))
  }, [rows, onChange, basePublic])

  const firstErrorRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (validationIssues.length > 0 && firstErrorRef.current) {
      firstErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [validationIssues.length])

  const rowErrorClass = (index: number, field: string) =>
    issueByIndex.get(index)?.has(field)
      ? "border-red-500 ring-2 ring-red-500/25 focus-visible:ring-red-500/30"
      : ""

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">SKU Builder</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Stock total des lignes : <strong className="tabular-nums">{totalStock}</strong>
            {validationIssues.length > 0 ? (
              <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                · {validationIssues.length} erreur{validationIssues.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode("fast")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              mode === "fast"
                ? "bg-violet-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            Mode rapide
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode("table")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              mode === "table"
                ? "bg-violet-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
          >
            Mode tableau
          </button>
        </div>
      </div>

      {mode === "fast" ? (
        <div className="grid gap-4 rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${tableId}-fast-colors`}>Couleurs (virgules)</Label>
            <Input
              id={`${tableId}-fast-colors`}
              className="mt-1.5"
              disabled={disabled}
              value={fastColors}
              onChange={(e) => setFastColors(e.target.value)}
              placeholder="Noir, Rouge, Bleu"
            />
          </div>
          <div>
            <Label htmlFor={`${tableId}-fast-sizes`}>Tailles (virgules)</Label>
            <Input
              id={`${tableId}-fast-sizes`}
              className="mt-1.5"
              disabled={disabled}
              value={fastSizes}
              onChange={(e) => setFastSizes(e.target.value)}
              placeholder="S, M, L, XL"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button
              type="button"
              disabled={disabled || comboPreview === 0}
              onClick={generateFromFast}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Générer {comboPreview > 0 ? `${comboPreview} variante${comboPreview > 1 ? "s" : ""}` : "les variantes"}
            </Button>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Ex. 3 couleurs × 4 tailles = 12 lignes avec SKU suggérés ({skuPrefix}-NOIR-S).
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Coût vide = prix de base ({formatStoreCurrency(baseSupplier)}). SKU vide = généré automatiquement.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || rows.length === 0}
            onClick={applyPublicPriceToAll}
          >
            Prix public catalogue à tous
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Ajouter ligne
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table id={tableId} className="w-full min-w-[960px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 shadow-sm dark:bg-zinc-900/95 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2.5">Couleur</th>
              <th className="px-3 py-2.5">Taille</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Coût EUR
                  <button
                    type="button"
                    className="font-normal normal-case text-violet-600 underline decoration-dotted dark:text-violet-400"
                    aria-describedby={costTipId}
                    title="Prix d'achat fournisseur. Marge = Prix public - Coût"
                  >
                    ?
                  </button>
                </span>
                <span id={costTipId} className="sr-only">
                  Prix d&apos;achat fournisseur. Marge = Prix public − Coût
                </span>
              </th>
              <th className="px-3 py-2.5">Prix public</th>
              <th className="px-3 py-2.5">Marge EUR</th>
              <th className="px-3 py-2.5">Stock</th>
              <th className="px-3 py-2.5">Comm. %</th>
              <th className="w-10 px-2 py-2.5" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                  Aucune variante — utilisez le mode rapide ou ajoutez une ligne.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isFirstError =
                  validationIssues.length > 0 && validationIssues[0]?.index === index
                return (
                  <tr
                    key={row.id}
                    ref={isFirstError ? firstErrorRef : undefined}
                    className="bg-white dark:bg-zinc-950"
                  >
                    <td className="px-2 py-1.5">
                      <Input
                        className={cn("h-9 min-w-[88px]", rowErrorClass(index, "color"))}
                        value={row.color}
                        disabled={disabled}
                        onChange={(e) => updateRow(index, { color: e.target.value })}
                        placeholder="Noir"
                        maxLength={32}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className={cn("h-9 min-w-[72px]", rowErrorClass(index, "size"))}
                        value={row.size ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          updateRow(index, { size: e.target.value.trim() ? e.target.value : null })
                        }
                        placeholder="M"
                        maxLength={16}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        className={cn("h-9 min-w-[100px] font-mono text-xs", rowErrorClass(index, "sku"))}
                        value={row.sku ?? ""}
                        disabled={disabled}
                        onChange={(e) => updateRow(index, { sku: e.target.value || null })}
                        placeholder="PRD-NOI-M"
                        maxLength={64}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        className={cn("h-9 w-28", rowErrorClass(index, "supplierPrice"))}
                        value={row.supplierPrice > 0 ? row.supplierPrice : ""}
                        disabled={disabled}
                        onChange={(e) =>
                          updateRow(index, {
                            supplierPrice: e.target.value ? Number(e.target.value) : 0,
                          })
                        }
                        placeholder={baseSupplier > 0 ? baseSupplier.toFixed(2) : "9.90"}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        className={cn("h-9 w-28", rowErrorClass(index, "publicPrice"))}
                        value={row.publicPrice > 0 ? row.publicPrice : ""}
                        disabled={disabled}
                        onChange={(e) =>
                          updateRow(index, { publicPrice: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatStoreCurrency(row.margin ?? marginEur(row.supplierPrice, row.publicPrice))}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        className={cn("h-9 w-20", rowErrorClass(index, "stock"))}
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
                        min={0}
                        max={100}
                        className="h-9 w-16"
                        value={row.commissionRate}
                        disabled={disabled}
                        onChange={(e) =>
                          updateRow(index, {
                            commissionRate: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
                          })
                        }
                      />
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
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
