"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"

import {
  isCustomCellInvalid,
  SupplierCustomColumnCell,
} from "@/components/supplier/supplier-custom-column-cell"
import { SupplierCustomColumnModal } from "@/components/supplier/supplier-custom-column-modal"
import { SupplierSkuAffiliateMarginCell } from "@/components/supplier/supplier-sku-affiliate-margin-cell"
import { SupplierSkuColumnToggles } from "@/components/supplier/supplier-sku-column-toggles"
import { SupplierSkuFastPanel } from "@/components/supplier/supplier-sku-fast-panel"
import { SupplierSimpleColorImageField } from "@/components/supplier/supplier-simple-color-image-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatStoreCurrency } from "@/lib/market-config"
import { newVariantRowId } from "@/lib/product-variants"
import { downloadSupplierSkuCsv } from "@/lib/supplier-sku-csv-export"
import {
  applyColorImageToRows,
  ensureRowCustomFields,
  firstRowIndexForColor,
  rowCustomData,
  type SkuCustomColumnDef,
  validateSupplierSkuTableRows,
  type SupplierSkuTableRow,
  type VariantRowValidationIssue,
} from "@/lib/supplier-sku-builder"
import type { CustomColumn, VariantCustomData } from "@/types/product"
import { isSkuColumnVisible, type SkuOptionalColumnKey } from "@/lib/supplier-sku-columns"
import { cn } from "@/lib/utils"

export type EditableVariantRow = SupplierSkuTableRow

function newRow(defaults: {
  supplierPrice: number
  compareAtEur: number | null
  commission: number
  customFields: Record<string, string>
  weightGrams?: number | null
  processingDays?: number | null
  ean?: string | null
  originCountry?: string | null
  warehouseCode?: string | null
  videoUrl?: string | null
}): EditableVariantRow {
  return {
    id: `new-${crypto.randomUUID()}`,
    color: "",
    size: null,
    sku: null,
    supplierPrice: defaults.supplierPrice,
    compareAtEur: defaults.compareAtEur,
    stock: 0,
    commissionRate: defaults.commission,
    colorImage: undefined,
    customFields: { ...defaults.customFields },
    weightGrams: defaults.weightGrams ?? null,
    processingDays: defaults.processingDays ?? 2,
    ean: defaults.ean ?? null,
    originCountry: defaults.originCountry ?? "CN",
    warehouseCode: defaults.warehouseCode ?? null,
    videoUrl: defaults.videoUrl ?? null,
  }
}

type Props = {
  rows: EditableVariantRow[]
  onChange: (rows: EditableVariantRow[]) => void
  onValidationChange?: (issues: VariantRowValidationIssue[]) => void
  basePriceEur: number
  catalogCompareAtEur?: number | null
  defaultCommission: number
  customColumns: SkuCustomColumnDef[]
  onCustomColumnsChange: (cols: SkuCustomColumnDef[]) => void
  hiddenColumns: SkuOptionalColumnKey[]
  onHiddenColumnsChange: (hidden: SkuOptionalColumnKey[]) => void
  skuPrefix?: string
  catalogShipsFrom?: string
  catalogDeliveryDays?: number | null
  disabled?: boolean
  className?: string
  tableId?: string
  /** Hide stock total + inline error count in header (wizard shows alert below). */
  hideHeaderStats?: boolean
}

export function SupplierVariantTable({
  rows,
  onChange,
  onValidationChange,
  basePriceEur,
  catalogCompareAtEur = null,
  defaultCommission,
  customColumns,
  onCustomColumnsChange,
  hiddenColumns,
  onHiddenColumnsChange,
  skuPrefix = "PRD",
  catalogShipsFrom = "EU",
  catalogDeliveryDays = 2,
  disabled,
  className,
  tableId = "supplier-sku-table",
  hideHeaderStats = false,
}: Props) {
  const [mode, setMode] = useState<"fast" | "table">(rows.length === 0 ? "fast" : "table")
  const [customColumnModalOpen, setCustomColumnModalOpen] = useState(false)
  const costTipId = useId()
  const MAX_CUSTOM_COLUMNS = 10

  const baseSupplier = basePriceEur > 0 ? basePriceEur : 10
  const showPhotoCol = isSkuColumnVisible(hiddenColumns, "photo")
  const showSizeCol = isSkuColumnVisible(hiddenColumns, "size")
  const showSupplierPriceCol = isSkuColumnVisible(hiddenColumns, "supplierPrice")
  const showSkuCol = isSkuColumnVisible(hiddenColumns, "sku")
  const showCompareAtCol = isSkuColumnVisible(hiddenColumns, "compareAt")
  const showStockCol = isSkuColumnVisible(hiddenColumns, "stock")
  const showCommissionCol = isSkuColumnVisible(hiddenColumns, "commission")
  const showWeightCol = isSkuColumnVisible(hiddenColumns, "weightGrams")
  const showEanCol = isSkuColumnVisible(hiddenColumns, "ean")
  const showProcessingCol = isSkuColumnVisible(hiddenColumns, "processingDays")
  const showOriginCol = isSkuColumnVisible(hiddenColumns, "originCountry")
  const showWarehouseCol = isSkuColumnVisible(hiddenColumns, "warehouseCode")
  const showVideoCol = isSkuColumnVisible(hiddenColumns, "videoUrl")
  const showAffiliateMarginCol = isSkuColumnVisible(hiddenColumns, "affiliateMargin")
  const columnKeys = useMemo(() => customColumns.map((c) => c.key), [customColumns])

  const rowLogisticsDefaults = useMemo(
    () => ({
      weightGrams: null as number | null,
      processingDays: catalogDeliveryDays ?? 2,
      ean: null as string | null,
      originCountry: "CN",
      warehouseCode: catalogShipsFrom.trim() || "EU",
      videoUrl: null as string | null,
    }),
    [catalogShipsFrom, catalogDeliveryDays]
  )

  const rowsWithFields = useMemo(
    () => ensureRowCustomFields(rows, columnKeys),
    [rows, columnKeys]
  )

  const removeCustomColumn = useCallback(
    (id: string) => {
      const col = customColumns.find((c) => c.id === id)
      onCustomColumnsChange(customColumns.filter((c) => c.id !== id))
      if (col) {
        onChange(
          rowsWithFields.map((r) => {
            const data = { ...rowCustomData(r) }
            delete data[col.key]
            const cf = { ...(r.customFields ?? {}) }
            delete cf[col.key]
            return { ...r, customData: data, customFields: cf }
          })
        )
      }
    },
    [customColumns, onCustomColumnsChange, onChange, rowsWithFields]
  )

  useEffect(() => {
    const keys = columnKeys.join("\0")
    if (!keys) return
    const ensured = ensureRowCustomFields(rows, columnKeys)
    const needsPatch = ensured.some((r, i) => {
      const prev = rows[i]
      if (!prev) return true
      return JSON.stringify(r.customFields) !== JSON.stringify(prev.customFields)
    })
    if (needsPatch) onChange(ensured)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync empty custom field keys when columns change
  }, [columnKeys.join("\0")])

  const validationIssues = useMemo(
    () => validateSupplierSkuTableRows(rowsWithFields, customColumns),
    [rowsWithFields, customColumns]
  )

  const addCustomColumn = useCallback(
    (col: CustomColumn) => {
      if (customColumns.length >= MAX_CUSTOM_COLUMNS) return
      onCustomColumnsChange([
        ...customColumns,
        { ...col, id: newVariantRowId() },
      ])
    },
    [customColumns, onCustomColumnsChange]
  )

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
    () => rowsWithFields.reduce((acc, r) => acc + Math.max(0, Math.round(r.stock) || 0), 0),
    [rowsWithFields]
  )

  const defaultCustomFields = useMemo(() => {
    const out: Record<string, string> = {}
    for (const c of customColumns) out[c.key] = ""
    return out
  }, [customColumns])

  const updateRow = useCallback(
    (index: number, patch: Partial<EditableVariantRow>) => {
      onChange(
        rowsWithFields.map((r, i) => {
          if (i !== index) return r
          return { ...r, ...patch }
        })
      )
    },
    [rowsWithFields, onChange]
  )

  const updateCustomData = useCallback(
    (index: number, key: string, value: string | number | boolean | undefined) => {
      onChange(
        rowsWithFields.map((r, i) => {
          if (i !== index) return r
          const data: VariantCustomData = { ...rowCustomData(r) }
          if (value === undefined || (value === "" && typeof value !== "boolean")) {
            delete data[key]
          } else {
            data[key] = value as string | number | boolean
          }
          const customFields = { ...(r.customFields ?? {}) }
          if (value === undefined || value === "") delete customFields[key]
          else customFields[key] = String(value)
          return { ...r, customData: data, customFields }
        })
      )
    },
    [rowsWithFields, onChange]
  )

  const updateColorImage = useCallback(
    (index: number, image: string) => {
      const color = rowsWithFields[index]?.color ?? ""
      onChange(applyColorImageToRows(rowsWithFields, color, image))
    },
    [rowsWithFields, onChange]
  )

  const removeRow = useCallback(
    (index: number) => {
      onChange(rowsWithFields.filter((_, i) => i !== index))
    },
    [rowsWithFields, onChange]
  )

  const addRow = useCallback(() => {
    onChange([
      ...rowsWithFields,
      newRow({
        supplierPrice: baseSupplier,
        compareAtEur: catalogCompareAtEur,
        commission: defaultCommission,
        customFields: defaultCustomFields,
        ...rowLogisticsDefaults,
      }),
    ])
    setMode("table")
  }, [
    rowsWithFields,
    onChange,
    baseSupplier,
    catalogCompareAtEur,
    defaultCommission,
    defaultCustomFields,
    rowLogisticsDefaults,
  ])

  const handleFastGenerate = useCallback(
    (generated: SupplierSkuTableRow[]) => {
      onChange(generated)
      setMode("table")
    },
    [onChange]
  )

  const applySupplierPriceToAll = useCallback(() => {
    if (baseSupplier <= 0) return
    onChange(rowsWithFields.map((r) => ({ ...r, supplierPrice: baseSupplier })))
  }, [rowsWithFields, onChange, baseSupplier])

  const applyCompareAtToAll = useCallback(() => {
    if (catalogCompareAtEur == null || catalogCompareAtEur <= 0) return
    onChange(rowsWithFields.map((r) => ({ ...r, compareAtEur: catalogCompareAtEur })))
  }, [rowsWithFields, onChange, catalogCompareAtEur])

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

  const colSpan =
    2 +
    (showPhotoCol ? 1 : 0) +
    (showSizeCol ? 1 : 0) +
    (showSkuCol ? 1 : 0) +
    (showSupplierPriceCol ? 1 : 0) +
    (showCompareAtCol ? 1 : 0) +
    (showStockCol ? 1 : 0) +
    (showCommissionCol ? 1 : 0) +
    (showWeightCol ? 1 : 0) +
    (showEanCol ? 1 : 0) +
    (showProcessingCol ? 1 : 0) +
    (showOriginCol ? 1 : 0) +
    (showWarehouseCol ? 1 : 0) +
    (showVideoCol ? 1 : 0) +
    (showAffiliateMarginCol ? 1 : 0) +
    customColumns.length

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">SKU Builder</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Stock total : <strong className="tabular-nums">{totalStock}</strong>
            {!hideHeaderStats && validationIssues.length > 0 ? (
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
        <SupplierSkuFastPanel
          skuPrefix={skuPrefix}
          baseSupplierPrice={baseSupplier}
          catalogCompareAtEur={catalogCompareAtEur}
          defaultCommission={defaultCommission}
          customColumns={customColumns}
          onCustomColumnsChange={onCustomColumnsChange}
          onRemoveCustomColumn={removeCustomColumn}
          onOpenCustomColumnModal={() => setCustomColumnModalOpen(true)}
          customColumnCount={customColumns.length}
          maxCustomColumns={MAX_CUSTOM_COLUMNS}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={onHiddenColumnsChange}
          catalogOriginCountry={rowLogisticsDefaults.originCountry}
          catalogWarehouse={rowLogisticsDefaults.warehouseCode ?? "EU"}
          catalogProcessingDays={rowLogisticsDefaults.processingDays ?? 2}
          onGenerate={handleFastGenerate}
          disabled={disabled}
        />
      ) : null}

      {mode === "table" || rowsWithFields.length > 0 ? (
        <>
          <div className="space-y-2 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <SupplierSkuColumnToggles
              variant="toolbar"
              hiddenColumns={hiddenColumns}
              onHiddenColumnsChange={onHiddenColumnsChange}
              disabled={disabled}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || customColumns.length >= MAX_CUSTOM_COLUMNS}
                onClick={() => setCustomColumnModalOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Colonne personnalisée
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || rowsWithFields.length === 0}
                onClick={() =>
                  downloadSupplierSkuCsv(
                    `sku-export-${Date.now()}.csv`,
                    rowsWithFields,
                    customColumns
                  )
                }
              >
                Exporter CSV
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {showPhotoCol ? "Photo partagée par couleur · " : ""}
              Prix vide = {formatStoreCurrency(baseSupplier)} (catalogue affiliés)
            </p>
            <div className="flex flex-wrap gap-2">
              {showSupplierPriceCol ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || rowsWithFields.length === 0 || baseSupplier <= 0}
                  onClick={applySupplierPriceToAll}
                >
                  Votre prix à tous
                </Button>
              ) : null}
              {showCompareAtCol && catalogCompareAtEur != null && catalogCompareAtEur > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || rowsWithFields.length === 0}
                  onClick={applyCompareAtToAll}
                >
                  Prix barré catalogue à tous
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addRow}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Ligne
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table id={tableId} className="w-full min-w-[1280px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 shadow-sm dark:bg-zinc-900/95 dark:text-zinc-400">
                <tr>
                  {showPhotoCol ? <th className="w-[140px] px-2 py-2.5">Photo</th> : null}
                  <th className="px-3 py-2.5">Couleur</th>
                  {showSizeCol ? <th className="px-3 py-2.5">Taille</th> : null}
                  {showSkuCol ? <th className="px-3 py-2.5">SKU</th> : null}
                  {showSupplierPriceCol ? (
                    <th className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        Votre prix
                        <button
                          type="button"
                          className="font-normal normal-case text-violet-600 underline decoration-dotted dark:text-violet-400"
                          aria-describedby={costTipId}
                          title="Prix catalogue visible par les affiliés"
                        >
                          ?
                        </button>
                      </span>
                      <span id={costTipId} className="sr-only">
                        Les affiliés fixent le prix de vente client ; vous définissez votre prix et la
                        commission offerte.
                      </span>
                    </th>
                  ) : null}
                  {showCompareAtCol ? <th className="px-3 py-2.5">Barré</th> : null}
                  {showStockCol ? <th className="px-3 py-2.5">Stock</th> : null}
                  {showCommissionCol ? <th className="px-3 py-2.5">Comm.%</th> : null}
                  {showWeightCol ? <th className="px-3 py-2.5">Poids (g)</th> : null}
                  {showEanCol ? <th className="px-3 py-2.5">EAN</th> : null}
                  {showProcessingCol ? <th className="px-3 py-2.5">Délai (j)</th> : null}
                  {showOriginCol ? <th className="px-3 py-2.5">Origine</th> : null}
                  {showWarehouseCol ? <th className="px-3 py-2.5">Entrepôt</th> : null}
                  {showVideoCol ? <th className="px-3 py-2.5">Vidéo</th> : null}
                  {showAffiliateMarginCol ? (
                    <th className="px-3 py-2.5">Marge affilié</th>
                  ) : null}
                  {customColumns.map((col) => (
                    <th key={col.id} className="min-w-[100px] px-2 py-2.5">
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <button
                          type="button"
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700"
                          disabled={disabled}
                          onClick={() => removeCustomColumn(col.id)}
                          aria-label={`Retirer la colonne ${col.label}`}
                          title="Retirer cette colonne"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    </th>
                  ))}
                  <th className="w-10 px-2 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {rowsWithFields.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-zinc-500">
                      Aucune ligne — utilisez le mode rapide ci-dessus.
                    </td>
                  </tr>
                ) : (
                  rowsWithFields.map((row, index) => {
                    const isFirstError =
                      validationIssues.length > 0 && validationIssues[0]?.index === index
                    const isFirstColorRow = firstRowIndexForColor(rowsWithFields, index)
                    return (
                      <tr
                        key={row.id}
                        data-sku-row={index}
                        ref={isFirstError ? firstErrorRef : undefined}
                        className="bg-white dark:bg-zinc-950"
                      >
                        {showPhotoCol ? (
                          <td className="px-2 py-2 align-top">
                            {isFirstColorRow && row.color.trim() ? (
                              <SupplierSimpleColorImageField
                                rowId={`sku-photo-${row.id}`}
                                value={row.colorImage ?? ""}
                                disabled={disabled}
                                onChange={(img) => updateColorImage(index, img)}
                              />
                            ) : (
                              <span className="block px-1 pt-2 text-[10px] text-zinc-400">
                                ↳ même couleur
                              </span>
                            )}
                          </td>
                        ) : null}
                        <td className="px-2 py-1.5">
                          <Input
                            className={cn("h-9 min-w-[88px]", rowErrorClass(index, "color"))}
                            value={row.color}
                            disabled={disabled}
                            onChange={(e) => updateRow(index, { color: e.target.value })}
                            maxLength={32}
                          />
                        </td>
                        {showSizeCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              className={cn("h-9 w-16", rowErrorClass(index, "size"))}
                              value={row.size ?? ""}
                              disabled={disabled}
                              onChange={(e) =>
                                updateRow(index, {
                                  size: e.target.value.trim() ? e.target.value : null,
                                })
                              }
                              maxLength={16}
                            />
                          </td>
                        ) : null}
                        {showSkuCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              className={cn(
                                "h-9 min-w-[96px] font-mono text-xs",
                                rowErrorClass(index, "sku")
                              )}
                              value={row.sku ?? ""}
                              disabled={disabled}
                              onChange={(e) => updateRow(index, { sku: e.target.value || null })}
                              maxLength={64}
                            />
                          </td>
                        ) : null}
                        {showSupplierPriceCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              className={cn("h-9 w-24", rowErrorClass(index, "supplierPrice"))}
                              value={row.supplierPrice > 0 ? row.supplierPrice : ""}
                              disabled={disabled}
                              onChange={(e) =>
                                updateRow(index, {
                                  supplierPrice: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showCompareAtCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className={cn("h-9 w-24", rowErrorClass(index, "compareAtEur"))}
                              value={
                                row.compareAtEur != null && row.compareAtEur > 0 ? row.compareAtEur : ""
                              }
                              disabled={disabled}
                              placeholder="—"
                              onChange={(e) => {
                                const raw = e.target.value
                                updateRow(index, {
                                  compareAtEur: raw.trim() === "" ? null : Number(raw) || null,
                                })
                              }}
                            />
                          </td>
                        ) : null}
                        {showStockCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              className={cn("h-9 w-16", rowErrorClass(index, "stock"))}
                              value={row.stock}
                              disabled={disabled}
                              onChange={(e) =>
                                updateRow(index, {
                                  stock: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showCommissionCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-9 w-14"
                              value={row.commissionRate}
                              disabled={disabled}
                              onChange={(e) =>
                                updateRow(index, {
                                  commissionRate: Math.min(
                                    100,
                                    Math.max(0, Math.round(Number(e.target.value) || 0))
                                  ),
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showWeightCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={30000}
                              className={cn("h-9 w-20", rowErrorClass(index, "weightGrams"))}
                              value={row.weightGrams != null && row.weightGrams > 0 ? row.weightGrams : ""}
                              disabled={disabled}
                              placeholder="250"
                              onChange={(e) => {
                                const raw = e.target.value
                                updateRow(index, {
                                  weightGrams: raw.trim() === "" ? null : Number(raw) || null,
                                })
                              }}
                            />
                          </td>
                        ) : null}
                        {showEanCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              className={cn("h-9 min-w-[100px] font-mono text-xs", rowErrorClass(index, "ean"))}
                              value={row.ean ?? ""}
                              disabled={disabled}
                              placeholder="3700123456789"
                              maxLength={13}
                              onChange={(e) =>
                                updateRow(index, {
                                  ean: e.target.value.trim() ? e.target.value.trim() : null,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showProcessingCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={30}
                              className={cn("h-9 w-14", rowErrorClass(index, "processingDays"))}
                              value={row.processingDays ?? ""}
                              disabled={disabled}
                              onChange={(e) =>
                                updateRow(index, {
                                  processingDays: Math.min(
                                    30,
                                    Math.max(0, Math.round(Number(e.target.value) || 0))
                                  ),
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showOriginCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-9 w-14 uppercase"
                              value={row.originCountry ?? ""}
                              disabled={disabled}
                              placeholder="CN"
                              maxLength={2}
                              onChange={(e) =>
                                updateRow(index, {
                                  originCountry: e.target.value.trim().toUpperCase().slice(0, 2) || null,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showWarehouseCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-9 w-16 uppercase"
                              value={row.warehouseCode ?? ""}
                              disabled={disabled}
                              placeholder="EU"
                              maxLength={16}
                              onChange={(e) =>
                                updateRow(index, {
                                  warehouseCode: e.target.value.trim().toUpperCase() || null,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showVideoCol ? (
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-9 min-w-[120px] text-xs"
                              value={row.videoUrl ?? ""}
                              disabled={disabled}
                              placeholder="https://…"
                              onChange={(e) =>
                                updateRow(index, {
                                  videoUrl: e.target.value.trim() || null,
                                })
                              }
                            />
                          </td>
                        ) : null}
                        {showAffiliateMarginCol ? (
                          <td className="px-2 py-1.5">
                            <SupplierSkuAffiliateMarginCell row={row} />
                          </td>
                        ) : null}
                        {customColumns.map((col) => (
                          <SupplierCustomColumnCell
                            key={col.id}
                            column={col}
                            value={rowCustomData(row)[col.key]}
                            disabled={disabled}
                            invalid={
                              isCustomCellInvalid(col, rowCustomData(row)[col.key]) ||
                              issueByIndex.get(index)?.has(col.key)
                            }
                            onChange={(v) => updateCustomData(index, col.key, v)}
                          />
                        ))}
                        <td className="px-1 py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-500 hover:text-red-600"
                            disabled={disabled}
                            onClick={() => removeRow(index)}
                            aria-label="Supprimer"
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
        </>
      ) : null}

      <SupplierCustomColumnModal
        open={customColumnModalOpen}
        onOpenChange={setCustomColumnModalOpen}
        existingKeys={customColumns.map((c) => c.key)}
        maxColumns={MAX_CUSTOM_COLUMNS}
        onSave={addCustomColumn}
      />
    </div>
  )
}
