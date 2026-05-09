"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"

import ImageUpload from "@/app/dashboard/products/new/ImageUpload"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  affiliateCommissionMaxPct,
  type ListingKind,
  LISTING_KINDS,
} from "@/lib/supplier-commission"
import { cn } from "@/lib/utils"

type CategoryRow = {
  id: string
  name: string
  icon?: string
  subcategories?: { id: string; name: string }[]
}

const LISTING_LABELS: Record<ListingKind, string> = {
  PHYSICAL: "Physical goods",
  SOFTWARE: "Software (digital)",
  SUBSCRIPTION: "Subscription / SaaS",
}

function formatMoneyUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function SupplierAddProductForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""

  const [loadingProduct, setLoadingProduct] = useState(Boolean(editId))
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [price, setPrice] = useState("")
  const [compareAt, setCompareAt] = useState("")
  const [stock, setStock] = useState("0")
  const [listingKind, setListingKind] = useState<ListingKind>("PHYSICAL")
  const [commission, setCommission] = useState("15")

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [shippingCountry, setShippingCountry] = useState("")
  const [warehouseType, setWarehouseType] = useState<"" | "local" | "regional" | "international">("")
  const [processingTime, setProcessingTime] = useState("1")
  const [deliveryMin, setDeliveryMin] = useState("2")
  const [deliveryMax, setDeliveryMax] = useState("5")
  const [shippingCost, setShippingCost] = useState("0")

  const commissionMax = affiliateCommissionMaxPct(listingKind)

  const discountPct = useMemo(() => {
    const p = Number(price)
    const c = Number(compareAt)
    if (!Number.isFinite(p) || !Number.isFinite(c) || c <= p) return 0
    return Math.round(((c - p) / c) * 100)
  }, [price, compareAt])

  const priceError = useMemo(() => {
    const p = Number(price)
    if (!Number.isFinite(p) || p <= 0) return "Enter a valid base price (USD)."
    return null
  }, [price])

  const compareError = useMemo(() => {
    if (!compareAt.trim()) return null
    const p = Number(price)
    const c = Number(compareAt)
    if (!Number.isFinite(c) || c <= 0) return "Compare-at price is invalid."
    if (Number.isFinite(p) && c <= p) return "Compare-at must be greater than base price."
    if (discountPct > 70) return "Compare-at discount cannot exceed 70%."
    return null
  }, [compareAt, discountPct, price])

  const commissionError = useMemo(() => {
    const n = Number(commission)
    if (!Number.isFinite(n)) return "Enter a valid percentage."
    if (n < 0 || n > commissionMax) {
      return listingKind === "PHYSICAL"
        ? `Physical goods: commission must be between 0% and ${commissionMax}%.`
        : `Commission must be between 0% and ${commissionMax}%.`
    }
    return null
  }, [commission, commissionMax, listingKind])

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((j: { categories?: CategoryRow[] }) => setCategories(j.categories ?? []))
      .catch(() => toast.error("Could not load categories"))
  }, [])

  const loadProduct = useCallback(async (id: string) => {
    setLoadingProduct(true)
    try {
      const res = await fetch(`/api/supplier/products/${id}`, { credentials: "include" })
      const data = (await res.json()) as Record<string, unknown>
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load product")
      }
      setName(String(data.name ?? ""))
      setDescription(String(data.description ?? ""))
      setCategoryId(typeof data.categoryId === "string" ? data.categoryId : "")
      setImages(Array.isArray(data.images) ? (data.images as string[]) : [])
      const cents = Number(data.basePriceCents)
      setPrice(Number.isFinite(cents) ? (cents / 100).toFixed(2) : "")
      const cmp = data.compareAt
      setCompareAt(cmp != null && Number(cmp) > 0 ? Number(cmp).toFixed(2) : "")
      setStock(String(data.stock ?? 0))
      const lk = String(data.listingKind ?? "PHYSICAL").toUpperCase()
      setListingKind(LISTING_KINDS.includes(lk as ListingKind) ? (lk as ListingKind) : "PHYSICAL")
      setCommission(String(data.commissionRate ?? 15))
      setShippingCountry(String(data.shippingCountry ?? ""))
      const wt = String(data.warehouseType ?? "")
      setWarehouseType(wt === "local" || wt === "regional" || wt === "international" ? wt : "")
      setProcessingTime(String(data.processingTime ?? 1))
      setDeliveryMin(String(data.deliveryMin ?? 2))
      setDeliveryMax(String(data.deliveryMax ?? 5))
      const sc = data.shippingCost
      setShippingCost(sc != null ? String(Number(sc)) : "0")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load product")
      router.replace("/dashboard/supplier/products/new")
    } finally {
      setLoadingProduct(false)
    }
  }, [router])

  useEffect(() => {
    if (editId) void loadProduct(editId)
  }, [editId, loadProduct])

  useEffect(() => {
    const n = Number(commission)
    if (Number.isFinite(n) && n > commissionMax) {
      setCommission(String(commissionMax))
    }
  }, [commission, commissionMax])

  async function handleSubmit() {
    if (priceError || compareError || commissionError) {
      toast.error("Fix validation errors before saving.")
      return
    }
    if (!name.trim()) {
      toast.error("Product name is required.")
      return
    }
    if (images.length === 0) {
      toast.error("Add at least one product image.")
      return
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      compareAt: compareAt.trim() ? Number(compareAt) : null,
      stock: Math.max(0, Math.round(Number(stock) || 0)),
      commission: Math.round(Number(commission)),
      listingKind,
      images,
      categoryId: categoryId || undefined,
      shippingCountry: shippingCountry.trim().toUpperCase().slice(0, 2) || undefined,
      warehouseType: warehouseType || undefined,
      processingTime: Math.round(Number(processingTime) || 1),
      deliveryMin: Math.round(Number(deliveryMin) || 2),
      deliveryMax: Math.round(Number(deliveryMax) || 5),
      shippingCostEUR: Number(shippingCost) || 0,
      shippingMethods: ["standard"],
    }

    setSaving(true)
    try {
      const url = editId ? `/api/supplier/products/${editId}` : "/api/supplier/products"
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editId ? { ...payload, name: name.trim() } : payload),
      })
      const json = (await res.json()) as { error?: string; id?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Save failed")
      }
      toast.success(editId ? "Product updated." : "Product created.")
      router.push("/dashboard/supplier/products")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loadingProduct) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading product…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/supplier/products"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "inline-flex gap-1")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {editId ? "Edit product" : "Add product"}
        </h1>
      </div>

      <div className="mb-6 flex gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
        {(
          [
            [1, "Details & media"],
            [2, "Pricing & affiliates"],
          ] as const
        ).map(([n, label]) => (
          <button
            key={n}
            type="button"
            onClick={() => setStep(n)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              step === n
                ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <Card className="space-y-6 border-zinc-200 p-6 dark:border-zinc-700">
          <div>
            <Label htmlFor="p-name">Product name</Label>
            <Input
              id="p-name"
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wireless earbuds"
              maxLength={500}
            />
          </div>
          <div>
            <Label htmlFor="p-desc">Description</Label>
            <textarea
              id="p-desc"
              className="mt-1.5 min-h-[120px] w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What affiliates and buyers should know"
            />
          </div>
          <div>
            <Label htmlFor="p-cat">Category</Label>
            <select
              id="p-cat"
              className="mt-1.5 flex h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-700"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select a category (optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Images</Label>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              At least one image (800×800px minimum). First image is the cover.
            </p>
            <div className="mt-3">
              <ImageUpload initialUrls={images} onImagesChange={setImages} />
            </div>
          </div>
          <Button type="button" className="w-full sm:w-auto" onClick={() => setStep(2)}>
            Continue to pricing
          </Button>
        </Card>
      ) : (
        <Card className="space-y-6 border-zinc-200 p-6 dark:border-zinc-700">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="p-price">Base price (supplier) — USD</Label>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Affiliates set the final storefront price; commission applies to their margin over this
                base.
              </p>
              <Input
                id="p-price"
                type="number"
                min="0.01"
                step="0.01"
                className="mt-1.5"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              {priceError ? <p className="mt-1 text-xs text-red-600">{priceError}</p> : null}
            </div>
            <div>
              <Label htmlFor="p-compare">Compare-at (optional)</Label>
              <Input
                id="p-compare"
                type="number"
                min="0"
                step="0.01"
                className="mt-1.5"
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="MSRP"
              />
              {compareError ? <p className="mt-1 text-xs text-red-600">{compareError}</p> : null}
            </div>
            <div>
              <Label htmlFor="p-stock">Stock</Label>
              <Input
                id="p-stock"
                type="number"
                min="0"
                step="1"
                className="mt-1.5"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-900 dark:bg-violet-950/40">
            <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-100">Affiliate commission</h2>
            <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/90">
              Percentage of the affiliate&apos;s margin (storefront price minus this base price) paid to the
              affiliate when a sale completes.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-kind">Listing type</Label>
                <select
                  id="p-kind"
                  className="mt-1.5 flex h-10 w-full rounded-md border border-violet-200 bg-white px-3 text-sm dark:border-violet-800 dark:bg-zinc-950"
                  value={listingKind}
                  onChange={(e) => setListingKind(e.target.value as ListingKind)}
                >
                  {LISTING_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {LISTING_LABELS[k]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-violet-900/70 dark:text-violet-300/80">
                  Up to {commissionMax}% for this type. 100% is only available for software and subscriptions.
                </p>
              </div>
              <div>
                <Label htmlFor="p-comm">Commission offered (%)</Label>
                <Input
                  id="p-comm"
                  type="number"
                  min={0}
                  max={commissionMax}
                  step="1"
                  className="mt-1.5"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                />
                {commissionError ? <p className="mt-1 text-xs text-red-600">{commissionError}</p> : null}
              </div>
            </div>
          </div>

          <details className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-700">
            <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
              Shipping (optional)
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ship-cc">Ship from (ISO country)</Label>
                <Input
                  id="ship-cc"
                  className="mt-1.5 uppercase"
                  maxLength={2}
                  placeholder="US"
                  value={shippingCountry}
                  onChange={(e) => setShippingCountry(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ship-wh">Warehouse</Label>
                <select
                  id="ship-wh"
                  className="mt-1.5 flex h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-700"
                  value={warehouseType}
                  onChange={(e) => setWarehouseType(e.target.value as typeof warehouseType)}
                >
                  <option value="">Not specified</option>
                  <option value="local">Local</option>
                  <option value="regional">Regional</option>
                  <option value="international">International</option>
                </select>
              </div>
              <div>
                <Label htmlFor="ship-pt">Processing days</Label>
                <Input
                  id="ship-pt"
                  type="number"
                  min={1}
                  className="mt-1.5"
                  value={processingTime}
                  onChange={(e) => setProcessingTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ship-sc">Shipping cost (EUR)</Label>
                <Input
                  id="ship-sc"
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1.5"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ship-dmin">Delivery min (days)</Label>
                <Input
                  id="ship-dmin"
                  type="number"
                  min={1}
                  className="mt-1.5"
                  value={deliveryMin}
                  onChange={(e) => setDeliveryMin(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ship-dmax">Delivery max (days)</Label>
                <Input
                  id="ship-dmax"
                  type="number"
                  min={1}
                  className="mt-1.5"
                  value={deliveryMax}
                  onChange={(e) => setDeliveryMax(e.target.value)}
                />
              </div>
            </div>
          </details>

          {Number.isFinite(Number(price)) && Number(price) > 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">Preview</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                Base price: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatMoneyUsd(Number(price))}</span>
                {compareAt.trim() && Number(compareAt) > Number(price) ? (
                  <>
                    {" "}
                    <span className="text-zinc-400 line-through">{formatMoneyUsd(Number(compareAt))}</span>
                    {discountPct > 0 ? (
                      <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">
                        −{discountPct}%
                      </span>
                    ) : null}
                  </>
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
              {saving ? "Saving…" : editId ? "Save changes" : "Publish product"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
