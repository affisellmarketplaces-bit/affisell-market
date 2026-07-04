"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { SupplierVariantTable, type EditableVariantRow } from "@/components/supplier/supplier-variant-table"
import { SupplierWholesalePreSaveModal } from "@/components/supplier/supplier-wholesale-pre-save-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatStoreCurrency } from "@/lib/market-config"
import { parseVariantsPayload } from "@/lib/product-variants"
import type { ProductVariantApiRow } from "@/lib/product-variant-sku"
import {
  apiRowsFromSkuTable,
  productVariantLinesToSkuTableRows,
  skuTableRowFromApiVariant,
  skuTableRowsToProductVariantLines,
} from "@/lib/supplier-sku-builder"
import { parseSkuHiddenColumns, type SkuOptionalColumnKey } from "@/lib/supplier-sku-columns"
import {
  fetchSupplierWholesalePreview,
  wholesalePreSaveNeedsConfirm,
  type SupplierWholesalePreview,
} from "@/lib/supplier-wholesale-pre-save-client"

type ProductPricingPayload = {
  id: string
  name: string
  hasVariants: boolean
  basePriceCents: number
  stock: number
  commissionRate: number
  compareAt: number | null
  listingVariants: unknown
  variants: ProductVariantApiRow[]
}

function rowsFromProduct(data: ProductPricingPayload): EditableVariantRow[] {
  const baseSupplier = data.basePriceCents > 0 ? data.basePriceCents / 100 : 10
  const comm = data.commissionRate ?? 15
  const parsed = parseVariantsPayload(data.listingVariants)
  if (parsed?.variantRows?.length) {
    return productVariantLinesToSkuTableRows(parsed.variantRows, comm, baseSupplier)
  }
  const apiRows = Array.isArray(data.variants) ? data.variants : []
  return apiRows.map((r) => skuTableRowFromApiVariant(r))
}

type Props = {
  productId: string
}

export function SupplierProductPricingPanel({ productId }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [hasVariants, setHasVariants] = useState(false)
  const [price, setPrice] = useState("")
  const [compareAt, setCompareAt] = useState("")
  const [stock, setStock] = useState("0")
  const [commissionRate, setCommissionRate] = useState("15")
  const [variantRows, setVariantRows] = useState<EditableVariantRow[]>([])
  const [skuHiddenColumns, setSkuHiddenColumns] = useState<SkuOptionalColumnKey[]>([])
  const [preSaveOpen, setPreSaveOpen] = useState(false)
  const [preSavePreview, setPreSavePreview] = useState<SupplierWholesalePreview | null>(null)
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null)

  const catalogCompareAtEur = useMemo(() => {
    const c = Number(compareAt)
    return compareAt.trim() && Number.isFinite(c) && c > 0 ? c : null
  }, [compareAt])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${productId}`, { credentials: "include" })
      const data = (await res.json()) as ProductPricingPayload & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Chargement impossible")
      setName(data.name)
      setHasVariants(Boolean(data.hasVariants))
      setPrice((data.basePriceCents / 100).toFixed(2))
      setCompareAt(
        data.compareAt != null && Number.isFinite(data.compareAt) && data.compareAt > 0
          ? String(data.compareAt)
          : ""
      )
      setStock(String(data.stock ?? 0))
      setCommissionRate(String(data.commissionRate ?? 15))
      setVariantRows(rowsFromProduct(data))
      const parsed = parseVariantsPayload(data.listingVariants)
      setSkuHiddenColumns(parseSkuHiddenColumns(parsed?.skuHiddenColumns))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  const buildSaveBody = useCallback((): Record<string, unknown> => {
    const priceN = Number(price)
    const comm = Math.round(Number(commissionRate) || 15)
    const body: Record<string, unknown> = {
      name,
      commission: comm,
      hasVariants,
      compareAt: compareAt.trim() ? Number(compareAt) : null,
    }
    if (hasVariants) {
      const filled = variantRows.filter((r) => r.color.trim())
      body.variants = apiRowsFromSkuTable(filled, {
        baseSupplierPrice: priceN > 0 ? priceN : 10,
        defaultCommission: comm,
      })
      if (filled.length > 0) {
        const minSupplier = Math.min(...filled.map((r) => r.supplierPrice).filter((p) => p > 0))
        const baseCents = Math.max(
          100,
          Math.round(
            (Number.isFinite(minSupplier) && minSupplier > 0 ? minSupplier : priceN > 0 ? priceN : 10) *
              100
          )
        )
        body.listingVariants = {
          variantRows: skuTableRowsToProductVariantLines(filled, baseCents),
          ...(skuHiddenColumns.length > 0 ? { skuHiddenColumns } : {}),
        }
      }
    } else {
      body.price = priceN
      body.stock = Number(stock)
    }
    return body
  }, [
    name,
    commissionRate,
    hasVariants,
    variantRows,
    price,
    stock,
    compareAt,
    skuHiddenColumns,
  ])

  const performSave = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true)
      try {
        const res = await fetch(`/api/supplier/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Enregistrement impossible")
        toast.success("Tarification enregistrée")
        await load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur")
      } finally {
        setSaving(false)
        setPreSaveOpen(false)
        setPendingBody(null)
        setPreSavePreview(null)
      }
    },
    [productId, load]
  )

  const save = useCallback(async () => {
    const body = buildSaveBody()
    const preview = await fetchSupplierWholesalePreview(productId, body)
    if (wholesalePreSaveNeedsConfirm(preview)) {
      setPendingBody(body)
      setPreSavePreview(preview)
      setPreSaveOpen(true)
      return
    }
    await performSave(body)
  }, [buildSaveBody, performSave, productId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Chargement des prix…
      </div>
    )
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Tarification</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Votre prix catalogue + commission <strong>{commissionRate}%</strong> sur la marge
            affiliée. Les affiliés fixent le prix client.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => {
              setHasVariants(e.target.checked)
              if (e.target.checked && variantRows.length === 0) {
                setVariantRows([
                  {
                    id: `new-${crypto.randomUUID()}`,
                    sku: null,
                    color: "",
                    size: null,
                    supplierPrice: Number(price) > 0 ? Number(price) : 10,
                    stock: Number(stock) || 0,
                    commissionRate: Number(commissionRate) || 15,
                    compareAtEur: catalogCompareAtEur,
                    customFields: {},
                  },
                ])
              }
            }}
            className="rounded border-zinc-300"
          />
          Produit avec déclinaisons SKU
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="pricing-compare">Prix barré catalogue (optionnel)</Label>
          <Input
            id="pricing-compare"
            type="number"
            min={0.01}
            step={0.01}
            className="mt-1.5"
            value={compareAt}
            onChange={(e) => setCompareAt(e.target.value)}
            placeholder="MSRP pour toutes les lignes"
          />
        </div>
        {!hasVariants ? (
          <div>
            <Label htmlFor="simple-price">Prix catalogue (€)</Label>
            <Input
              id="simple-price"
              type="number"
              min={0.01}
              step={0.01}
              className="mt-1.5"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        ) : null}
      </div>

      {hasVariants ? (
        <div className="mt-6">
          <SupplierVariantTable
            rows={variantRows}
            onChange={setVariantRows}
            disabled={saving}
            basePriceEur={Number(price) || 0}
            catalogCompareAtEur={catalogCompareAtEur}
            defaultCommission={Math.round(Number(commissionRate) || 15)}
            customColumns={[]}
            onCustomColumnsChange={() => {}}
            hiddenColumns={skuHiddenColumns}
            onHiddenColumnsChange={setSkuHiddenColumns}
            catalogShipsFrom="EU"
            catalogDeliveryDays={2}
            skuPrefix="PRD"
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="simple-stock">Stock</Label>
            <Input
              id="simple-stock"
              type="number"
              min={0}
              className="mt-1.5"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <p className="sm:col-span-2 text-xs text-zinc-500">
            Prix catalogue actuel : {formatStoreCurrency(Number(price) || 0)}
            {catalogCompareAtEur ? ` · barré ${formatStoreCurrency(catalogCompareAtEur)}` : ""}
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Enregistrement…
            </>
          ) : (
            "Enregistrer la tarification"
          )}
        </Button>
      </div>

      <SupplierWholesalePreSaveModal
        open={preSaveOpen}
        preview={preSavePreview}
        busy={saving}
        onCancel={() => {
          setPreSaveOpen(false)
          setPendingBody(null)
          setPreSavePreview(null)
        }}
        onConfirm={() => {
          if (pendingBody) void performSave(pendingBody)
        }}
      />
    </section>
  )
}
