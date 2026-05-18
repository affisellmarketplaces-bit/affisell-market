"use client"

import { useCallback, useMemo, useState } from "react"
import { ImagePlus, Plus, Sparkles, Trash2 } from "lucide-react"

import { SupplierSimpleColorImageField } from "@/components/supplier/supplier-simple-color-image-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatStoreCurrency } from "@/lib/market-config"
import { newVariantRowId } from "@/lib/product-variants"
import {
  buildSkuCombinations,
  generateSkuTableRowsFromSetup,
  parseCommaList,
  slugCustomColumnKey,
  type SkuCustomColumnDef,
  type SkuFastColorRow,
  type SkuFastDefaults,
  type SupplierSkuTableRow,
} from "@/lib/supplier-sku-builder"
import {
  isSkuColumnVisible,
  type SkuOptionalColumnKey,
} from "@/lib/supplier-sku-columns"
import { cn } from "@/lib/utils"

import { SupplierSkuColumnToggles } from "@/components/supplier/supplier-sku-column-toggles"

type Props = {
  skuPrefix: string
  baseSupplierPrice: number
  catalogCompareAtEur: number | null
  defaultCommission: number
  customColumns: SkuCustomColumnDef[]
  onCustomColumnsChange: (cols: SkuCustomColumnDef[]) => void
  onRemoveCustomColumn: (id: string) => void
  hiddenColumns: SkuOptionalColumnKey[]
  onHiddenColumnsChange: (hidden: SkuOptionalColumnKey[]) => void
  onGenerate: (rows: SupplierSkuTableRow[]) => void
  disabled?: boolean
}

function newColorRow(): SkuFastColorRow {
  return { id: newVariantRowId(), name: "", image: "" }
}

export function SupplierSkuFastPanel({
  skuPrefix,
  baseSupplierPrice,
  catalogCompareAtEur,
  defaultCommission,
  customColumns,
  onCustomColumnsChange,
  onRemoveCustomColumn,
  hiddenColumns,
  onHiddenColumnsChange,
  onGenerate,
  disabled,
}: Props) {
  const showPhoto = isSkuColumnVisible(hiddenColumns, "photo")
  const showSize = isSkuColumnVisible(hiddenColumns, "size")
  const showSupplierPrice = isSkuColumnVisible(hiddenColumns, "supplierPrice")
  const showSku = isSkuColumnVisible(hiddenColumns, "sku")
  const showCompareAt = isSkuColumnVisible(hiddenColumns, "compareAt")
  const showStock = isSkuColumnVisible(hiddenColumns, "stock")
  const showCommission = isSkuColumnVisible(hiddenColumns, "commission")
  const [colorRows, setColorRows] = useState<SkuFastColorRow[]>([newColorRow()])
  const [sizesText, setSizesText] = useState("")
  const [defaults, setDefaults] = useState<SkuFastDefaults>(() => ({
    supplierPrice: baseSupplierPrice,
    compareAtEur: catalogCompareAtEur,
    stock: 0,
    commissionRate: defaultCommission,
    customFieldValues: {},
  }))
  const [newColumnLabel, setNewColumnLabel] = useState("")

  const comboCount = useMemo(() => {
    const names = colorRows.map((c) => c.name.trim()).filter(Boolean)
    const sizes = parseCommaList(sizesText)
    return buildSkuCombinations(names, sizes).length
  }, [colorRows, sizesText])

  const setDefault = useCallback((patch: Partial<SkuFastDefaults>) => {
    setDefaults((d) => ({ ...d, ...patch }))
  }, [])

  const addCustomColumn = useCallback(() => {
    const label = newColumnLabel.trim()
    if (!label) return
    const key = slugCustomColumnKey(label)
    if (customColumns.some((c) => c.key === key)) return
    const col: SkuCustomColumnDef = { id: newVariantRowId(), key, label }
    onCustomColumnsChange([...customColumns, col])
    setNewColumnLabel("")
  }, [customColumns, newColumnLabel, onCustomColumnsChange])

  const handleRemoveCustomColumn = useCallback(
    (id: string) => {
      const col = customColumns.find((c) => c.id === id)
      onRemoveCustomColumn(id)
      if (col) {
        setDefaults((d) => {
          const next = { ...d.customFieldValues }
          delete next[col.key]
          return { ...d, customFieldValues: next }
        })
      }
    },
    [customColumns, onRemoveCustomColumn]
  )

  const handleGenerate = useCallback(() => {
    const filledColors = colorRows.filter((c) => c.name.trim())
    if (filledColors.length === 0) return
    let rows = generateSkuTableRowsFromSetup({
      colorRows: showPhoto ? filledColors : filledColors.map((c) => ({ ...c, image: "" })),
      sizesText: showSize ? sizesText : "",
      skuPrefix,
      defaults,
      customColumns,
    })
    if (!showCompareAt) rows = rows.map((r) => ({ ...r, compareAtEur: null }))
    onGenerate(rows)
  }, [
    colorRows,
    sizesText,
    skuPrefix,
    defaults,
    customColumns,
    onGenerate,
    showPhoto,
    showSize,
    showCompareAt,
  ])

  return (
    <div className="space-y-5 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-white to-violet-50/40 p-4 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-violet-950/20 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">
          Assistant de génération
        </p>
        <p className="mt-1 text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/85">
          Définissez couleurs, tailles, votre prix catalogue, commission et colonnes métier — puis
          générez le tableau. Les affiliés fixent le prix client final.
        </p>
      </div>

      <SupplierSkuColumnToggles
        hiddenColumns={hiddenColumns}
        onHiddenColumnsChange={onHiddenColumnsChange}
        disabled={disabled}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
              1 · Couleurs{showPhoto ? " & photos" : ""}
            </h3>
            <p className="text-[11px] text-zinc-500">Une pastille = une couleur (ex. Rose Haricot, Rouge).</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-1"
            onClick={() => setColorRows((prev) => [...prev, newColorRow()])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Couleur
          </Button>
        </div>
        <div className="space-y-3">
          {colorRows.map((row, i) => (
            <div
              key={row.id}
              className={cn(
                "grid gap-3 rounded-xl border border-zinc-200/90 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/50",
                showPhoto ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_auto]"
              )}
            >
              <div>
                <Label htmlFor={`fast-color-${row.id}`} className="text-xs">
                  Nom couleur
                </Label>
                <Input
                  id={`fast-color-${row.id}`}
                  className="mt-1 h-10"
                  disabled={disabled}
                  value={row.name}
                  onChange={(e) =>
                    setColorRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                    )
                  }
                  placeholder="Rose Haricot"
                  maxLength={32}
                />
              </div>
              {showPhoto ? (
                <div className="min-w-[200px]">
                  <Label className="text-xs flex items-center gap-1">
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                    Photo couleur
                  </Label>
                  <div className="mt-1">
                    <SupplierSimpleColorImageField
                      rowId={row.id}
                      value={row.image}
                      disabled={disabled}
                      onChange={(image) =>
                        setColorRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, image } : r))
                        )
                      }
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex items-end pb-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-zinc-500 hover:text-red-600"
                  disabled={disabled || colorRows.length <= 1}
                  onClick={() => setColorRows((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Supprimer cette couleur"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showSize ? (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            2 · Tailles (optionnel)
          </h3>
          <Input
            className="mt-2"
            disabled={disabled}
            value={sizesText}
            onChange={(e) => setSizesText(e.target.value)}
            placeholder="S, M, L, XL"
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          3 · Valeurs par défaut (toutes les lignes)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showSupplierPrice ? (
            <div>
              <Label className="text-xs">Votre prix EUR (catalogue affiliés)</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                className="mt-1 h-10"
                disabled={disabled}
                value={defaults.supplierPrice > 0 ? defaults.supplierPrice : ""}
                onChange={(e) =>
                  setDefault({ supplierPrice: Number(e.target.value) || 0 })
                }
              />
            </div>
          ) : null}
          {showCompareAt ? (
          <div>
            <Label className="text-xs">Prix barré EUR (opt.)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="mt-1 h-10"
              disabled={disabled}
              value={defaults.compareAtEur != null && defaults.compareAtEur > 0 ? defaults.compareAtEur : ""}
              onChange={(e) => {
                const raw = e.target.value
                setDefault({
                  compareAtEur: raw.trim() === "" ? null : Number(raw) || null,
                })
              }}
              placeholder={catalogCompareAtEur ? String(catalogCompareAtEur) : "19.90"}
            />
          </div>
          ) : null}
          {showStock ? (
          <div>
            <Label className="text-xs">Stock / ligne</Label>
            <Input
              type="number"
              min={0}
              className="mt-1 h-10"
              disabled={disabled}
              value={defaults.stock}
              onChange={(e) =>
                setDefault({ stock: Math.max(0, Math.round(Number(e.target.value) || 0)) })
              }
            />
          </div>
          ) : null}
          {showCommission ? (
          <div>
            <Label className="text-xs">Commission %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="mt-1 h-10"
              disabled={disabled}
              value={defaults.commissionRate}
              onChange={(e) =>
                setDefault({
                  commissionRate: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
                })
              }
            />
          </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          4 · Colonnes détail (optionnel)
        </h3>
        <p className="text-[11px] text-zinc-500">
          Ajoutez des champs comme « Unité de mesure », « Contenance », etc. Ils apparaîtront dans le
          tableau pour chaque SKU.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-10 min-w-[12rem] flex-1"
            disabled={disabled}
            value={newColumnLabel}
            onChange={(e) => setNewColumnLabel(e.target.value)}
            placeholder="ex. Unité de mesure"
            maxLength={48}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustomColumn()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addCustomColumn}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Colonne
          </Button>
        </div>
        {customColumns.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {customColumns.map((col) => (
              <span
                key={col.id}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-3 pr-1 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
              >
                {col.label}
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  disabled={disabled}
                  onClick={() => handleRemoveCustomColumn(col.id)}
                  aria-label={`Retirer ${col.label}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {customColumns.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {customColumns.map((col) => (
              <div key={col.id}>
                <Label className="text-xs">{col.label}</Label>
                <Input
                  className="mt-1 h-9"
                  disabled={disabled}
                  value={defaults.customFieldValues[col.key] ?? ""}
                  onChange={(e) =>
                    setDefault({
                      customFieldValues: {
                        ...defaults.customFieldValues,
                        [col.key]: e.target.value,
                      },
                    })
                  }
                  placeholder="Valeur par défaut"
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-violet-200/60 pt-4 dark:border-violet-800/50">
        <Button
          type="button"
          disabled={disabled || comboCount === 0}
          onClick={handleGenerate}
          className="gap-2 bg-violet-600 hover:bg-violet-700"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Générer {comboCount > 0 ? `${comboCount} variante${comboCount > 1 ? "s" : ""}` : ""}
        </Button>
        {comboCount > 0 ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Aperçu catalogue affiliés : {formatStoreCurrency(defaults.supplierPrice)}
            {defaults.compareAtEur ? ` · barré ${formatStoreCurrency(defaults.compareAtEur)}` : ""}
            {" · "}comm. {defaults.commissionRate}%
            {" · "}stock {defaults.stock}/ligne
          </p>
        ) : null}
      </div>
    </div>
  )
}
