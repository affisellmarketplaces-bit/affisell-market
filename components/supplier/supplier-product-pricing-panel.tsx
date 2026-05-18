"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { SupplierVariantTable, type EditableVariantRow } from "@/components/supplier/supplier-variant-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatStoreCurrency } from "@/lib/market-config"
import type { ProductVariantApiRow } from "@/lib/product-variant-sku"

type ProductPricingPayload = {
  id: string
  name: string
  hasVariants: boolean
  basePriceCents: number
  stock: number
  commissionRate: number
  variants: ProductVariantApiRow[]
}

function toEditable(rows: ProductVariantApiRow[]): EditableVariantRow[] {
  return rows.map((r) => ({
    id: r.id ?? `new-${crypto.randomUUID()}`,
    color: r.color?.trim() ?? "",
    size: r.size,
    sku: r.sku,
    supplierPrice: r.supplierPrice,
    publicPrice: r.publicPrice,
    stock: r.stock,
    commissionRate: r.commissionRate ?? 10,
    compareAtEur: null,
    customFields: {},
    margin: r.margin,
  }))
}

function toPayloadRows(rows: EditableVariantRow[]) {
  return rows.map((r) => ({
    id: r.id?.startsWith("new-") ? undefined : r.id,
    sku: r.sku,
    color: r.color,
    size: r.size,
    supplierPrice: Number(r.supplierPrice),
    publicPrice: Number(r.publicPrice),
    stock: r.stock,
    commissionRate: r.commissionRate,
  }))
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
  const [stock, setStock] = useState("0")
  const [commissionRate, setCommissionRate] = useState("15")
  const [variantRows, setVariantRows] = useState<EditableVariantRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${productId}`, { credentials: "include" })
      const data = (await res.json()) as ProductPricingPayload & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Chargement impossible")
      setName(data.name)
      setHasVariants(Boolean(data.hasVariants))
      setPrice((data.basePriceCents / 100).toFixed(2))
      setStock(String(data.stock ?? 0))
      setCommissionRate(String(data.commissionRate ?? 15))
      setVariantRows(toEditable(Array.isArray(data.variants) ? data.variants : []))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name,
        commission: Number(commissionRate),
        hasVariants,
      }
      if (hasVariants) {
        body.variants = toPayloadRows(variantRows)
      } else {
        body.price = Number(price)
        body.stock = Number(stock)
      }

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
    }
  }, [productId, name, commissionRate, hasVariants, variantRows, price, stock, load])

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
            Commission affiliés : <strong>{commissionRate}%</strong> — marge SKU = prix public − prix
            fournisseur
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
                    supplierPrice: Number(price) > 0 ? Number(price) * 0.6 : 10,
                    publicPrice: Number(price) || 0,
                    stock: Number(stock) || 0,
                    commissionRate: Number(commissionRate) || 15,
                    compareAtEur: null,
                    customFields: {},
                    margin: 0,
                  },
                ])
              }
            }}
            className="rounded border-zinc-300"
          />
          Produit avec déclinaisons SKU
        </label>
      </div>

      {hasVariants ? (
        <div className="mt-6">
          <SupplierVariantTable
            rows={variantRows}
            onChange={setVariantRows}
            disabled={saving}
            basePriceEur={Number(price) || 0}
            catalogCompareAtEur={null}
            defaultCommission={Math.round(Number(commissionRate) || 15)}
            customColumns={[]}
            onCustomColumnsChange={() => {}}
            hiddenColumns={[]}
            onHiddenColumnsChange={() => {}}
            skuPrefix="PRD"
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="simple-price">Prix public (€)</Label>
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
    </section>
  )
}
