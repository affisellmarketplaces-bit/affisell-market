"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  Circle,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  Cloud,
  Package,
  Sparkles,
  Globe2,
  Layers,
  Tag,
  Truck,
  Wallet,
  Zap,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { toast } from "sonner"

import { SupplierProductImageUpload } from "@/components/supplier/supplier-product-image-upload"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  affiliateCommissionMaxPct,
  type ListingKind,
  LISTING_KINDS,
} from "@/lib/supplier-commission"
import {
  pathFromLeafId,
  suggestLeafCategoriesFromTitle,
  type CategoryPathSegment,
  type LeafPath,
  type RecentCategoryEntry,
} from "@/lib/category-browse"
import { SupplierCategoryPicker, type BrowsePayload } from "@/components/supplier/supplier-category-picker"
import {
  CategoryAttributeFields,
  mergeCoreCategoryAttrs,
  missingRequiredCategorySpecs,
  type CategoryAttrRow,
} from "@/components/supplier/category-attribute-fields"
import {
  SupplierAiPublishPanel,
  type AiPublishResult,
} from "@/components/supplier/supplier-ai-publish-panel"
import {
  SupplierUrlImportPanel,
  type UrlImportApplyPayload,
} from "@/components/supplier/supplier-url-import-panel"
import {
  clearSupplierAddProductDraftCache,
  readSupplierAddProductDraftCache,
  writeSupplierAddProductDraftCache,
  type SupplierAddProductCacheMode,
  type SupplierSimpleColorRow,
  type SupplierVariantFormMode,
} from "@/lib/supplier-add-product-draft-cache"
import { newVariantRowId, parseVariantsPayload, type ProductVariantLine } from "@/lib/product-variants"
import { parseProductColorImagesFromDb } from "@/lib/product-color-images"
import { formatStoreCurrency } from "@/lib/market-config"
import { cn } from "@/lib/utils"

const LISTING_LABELS: Record<ListingKind, string> = {
  PHYSICAL: "Physical goods",
  SOFTWARE: "Software (digital)",
  SUBSCRIPTION: "Subscription / SaaS",
}

function formatMoneyDisplay(n: number) {
  return formatStoreCurrency(n)
}

function parseCsvOptions(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 40)
}

function defaultVariantRow(commissionPct: string): ProductVariantLine {
  const n = Math.round(Number(commissionPct))
  const commission = Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 20
  return {
    id: newVariantRowId(),
    name: "",
    sku: "",
    priceCents: 0,
    stock: 0,
    commission,
    sales: 0,
  }
}

/** Step 1 background sync must not send variant snapshot fields (server preserves DB when keys are omitted). */
function omitVariantSnapshotForDraftStep1(
  body: Record<string, unknown>,
  step: 1 | 2
): Record<string, unknown> {
  if (step !== 1) return body
  const rest = { ...body }
  delete rest.colors
  delete rest.variants
  delete rest.colorImages
  return rest
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  className,
  variant = "default",
  id,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
  variant?: "default" | "accent"
  /** In-page anchor for quick navigation */
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 rounded-2xl border p-6 shadow-md shadow-zinc-900/[0.04] ring-1 ring-black/[0.03] sm:p-7 dark:shadow-black/30 dark:ring-white/[0.04]",
        variant === "accent"
          ? "border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-white dark:border-violet-900/40 dark:from-violet-950/20 dark:via-zinc-950/50 dark:to-zinc-950"
          : "border-zinc-200/80 bg-white/95 backdrop-blur-[2px] dark:border-zinc-700/80 dark:bg-zinc-950/50",
        className
      )}
    >
      <div className="mb-5 flex gap-3.5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            variant === "accent"
              ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
              : "bg-gradient-to-br from-zinc-100 to-zinc-50 text-zinc-700 ring-1 ring-zinc-200/80 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-200 dark:ring-zinc-700/80"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

type SupplierAddProductFormProps = {
  /** Shown when the user arrived from the “Add products” hub (not when editing). */
  onBackToMethods?: () => void
  /** URL import + AI shortcut panels on step 1 (chosen from the hub or `?assist=1`). */
  assistShortcuts?: boolean
}

export function SupplierAddProductForm({
  onBackToMethods,
  assistShortcuts = false,
}: SupplierAddProductFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const draftIdFromUrl = searchParams.get("draft")?.trim() ?? ""
  const composeQs = searchParams.get("compose") === "1"
  const urlListingId = editId || draftIdFromUrl

  const cacheMode: SupplierAddProductCacheMode = assistShortcuts ? "assist" : composeQs ? "compose" : "plain"

  const [loadingProduct, setLoadingProduct] = useState(Boolean(urlListingId))
  const [saving, setSaving] = useState(false)
  const [draftSync, setDraftSync] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [draftSyncAt, setDraftSyncAt] = useState<number | null>(null)
  const [pendingDraftListingId, setPendingDraftListingId] = useState("")
  const [productIsDraft, setProductIsDraft] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const autosaveListingId = editId || draftIdFromUrl || pendingDraftListingId
  const lastAutosaveJson = useRef("")
  const hydratedFromCache = useRef(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [descriptionBullets, setDescriptionBullets] = useState<string[]>([""])
  const [categoryId, setCategoryId] = useState("")
  const [categoryPath, setCategoryPath] = useState<CategoryPathSegment[]>([])
  const [images, setImages] = useState<string[]>([])
  const [price, setPrice] = useState("")
  const [compareAt, setCompareAt] = useState("")
  const [stock, setStock] = useState("0")
  const [variantFormMode, setVariantFormMode] = useState<SupplierVariantFormMode>("none")
  const [variantSizesText, setVariantSizesText] = useState("")
  const [variantColorsText, setVariantColorsText] = useState("")
  const [variantRows, setVariantRows] = useState<ProductVariantLine[]>([])
  const [simpleColorRows, setSimpleColorRows] = useState<SupplierSimpleColorRow[]>([])
  const [listingKind, setListingKind] = useState<ListingKind>("PHYSICAL")
  const [commission, setCommission] = useState("15")

  const [browse, setBrowse] = useState<BrowsePayload | null>(null)
  const [recentCategories, setRecentCategories] = useState<RecentCategoryEntry[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(true)
  const [debouncedTitle, setDebouncedTitle] = useState("")
  const [aiCategorySuggestions, setAiCategorySuggestions] = useState<LeafPath[]>([])
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)
  const [shippingCountry, setShippingCountry] = useState("")
  const [warehouseType, setWarehouseType] = useState<"" | "local" | "regional" | "international">("")
  const [processingTime, setProcessingTime] = useState("1")
  const [deliveryMin, setDeliveryMin] = useState("2")
  const [deliveryMax, setDeliveryMax] = useState("5")
  const [shippingCost, setShippingCost] = useState("0")
  const [shipsFrom, setShipsFrom] = useState("")
  const [deliveryDays, setDeliveryDays] = useState("")
  const [freeShipping, setFreeShipping] = useState(false)
  const [supplierTag, setSupplierTag] = useState("")
  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttrRow[]>([])
  const [specValues, setSpecValues] = useState<Record<string, string>>({})
  const [attrsLoading, setAttrsLoading] = useState(false)
  const mergedCategoryAttrs = useMemo(() => mergeCoreCategoryAttrs(categoryAttrs), [categoryAttrs])

  const commissionMax = affiliateCommissionMaxPct(listingKind)

  useEffect(() => {
    if (variantFormMode !== "simple") return
    setSimpleColorRows((rows) =>
      rows.length === 0 ? [{ id: newVariantRowId(), name: "", image: "" }] : rows
    )
  }, [variantFormMode, simpleColorRows.length])

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

  const unitPriceFromVolumeHint = useMemo(() => {
    const raw = specValues.item_volume_ml?.trim().replace(",", ".")
    const ml = Number(raw)
    const p = Number(price)
    if (!Number.isFinite(ml) || ml <= 0 || !Number.isFinite(p) || p <= 0) return null
    const perLiter = p / (ml / 1000)
    return `${formatMoneyDisplay(perLiter)} per litre (from “Item volume” in specs ÷ your base price)`
  }, [price, specValues.item_volume_ml])

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

  const variantStockHint = useMemo(() => {
    if (variantFormMode !== "advanced") return null
    const valid = variantRows.filter((r) => r.name.trim())
    if (valid.length === 0) return null
    const sum = valid.reduce((a, r) => a + Math.max(0, Math.round(Number(r.stock) || 0)), 0)
    return `With SKU lines, saved stock is the sum of row quantities (${sum} from ${valid.length} line(s)).`
  }, [variantFormMode, variantRows])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(name), 420)
    return () => clearTimeout(t)
  }, [name])

  const keywordCategorySuggestions = useMemo(() => {
    if (!browse || debouncedTitle.trim().length < 2) return []
    return suggestLeafCategoriesFromTitle(debouncedTitle, browse.leafPaths, 3)
  }, [browse, debouncedTitle])

  useEffect(() => {
    if (!browse || debouncedTitle.trim().length < 2) {
      setAiCategorySuggestions([])
      setAiSuggestLoading(false)
      return
    }
    const ac = new AbortController()
    setAiSuggestLoading(true)
    fetch("/api/supplier/suggest-categories-ai", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({ title: debouncedTitle, description: description.trim() || undefined }),
    })
      .then((r) => r.json())
      .then((j: { suggestions?: LeafPath[] }) => {
        setAiCategorySuggestions(Array.isArray(j.suggestions) ? j.suggestions.slice(0, 3) : [])
      })
      .catch(() => {
        if (!ac.signal.aborted) setAiCategorySuggestions([])
      })
      .finally(() => {
        if (!ac.signal.aborted) setAiSuggestLoading(false)
      })
    return () => ac.abort()
  }, [browse, debouncedTitle, description])

  useEffect(() => {
    let cancelled = false
    setLoadingBrowse(true)
    Promise.all([
      fetch("/api/categories/browse").then((r) => r.json()),
      fetch("/api/supplier/recent-categories", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.resolve({ recent: [] })
      ),
    ])
      .then(([b, rec]) => {
        if (cancelled) return
        if (b && typeof b === "object" && Array.isArray((b as BrowsePayload).rootIds)) {
          setBrowse(b as BrowsePayload)
        } else {
          setBrowse(null)
        }
        setRecentCategories(Array.isArray(rec?.recent) ? rec.recent : [])
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load categories")
      })
      .finally(() => {
        if (!cancelled) setLoadingBrowse(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setAttrsLoading(true)
    const url =
      categoryId.trim().length > 0
        ? `/api/attributes/by-category?categoryId=${encodeURIComponent(categoryId.trim())}`
        : `/api/attributes/by-category`
    fetch(url)
      .then(async (r) => {
        let j: { attributes?: CategoryAttrRow[] } = {}
        try {
          j = await r.json()
        } catch {
          if (!cancelled) setCategoryAttrs([])
          return
        }
        if (cancelled) return
        if (!r.ok) {
          setCategoryAttrs([])
          return
        }
        setCategoryAttrs(Array.isArray(j.attributes) ? j.attributes : [])
      })
      .catch(() => {
        if (!cancelled) setCategoryAttrs([])
      })
      .finally(() => {
        if (!cancelled) setAttrsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId])

  useEffect(() => {
    if (!browse || !categoryId) return
    const p = pathFromLeafId(categoryId, browse.nodes)
    if (p?.length) queueMicrotask(() => setCategoryPath(p))
  }, [browse, categoryId])

  const categoryPathLabel = useMemo(
    () => categoryPath.map((s) => s.name).join(" > "),
    [categoryPath]
  )

  const handleAiGenerated = useCallback((result: AiPublishResult) => {
    if (result.title?.trim()) setName(result.title.trim().slice(0, 500))
    setDescription(result.description)
    setSpecValues((prev) => ({ ...prev, ...result.specs }))
    const extra = result.mergeHttpsImageUrls
    if (extra?.length) {
      setImages((prev) => {
        const merged = [...prev]
        for (const u of extra) {
          if (merged.includes(u)) continue
          merged.push(u)
        }
        return merged.slice(0, 12)
      })
    }
  }, [])

  const handleUrlImportApply = useCallback((patch: UrlImportApplyPayload) => {
    setName(patch.name)
    setDescription(patch.description)
    if (patch.images.length) setImages(patch.images)
    setStock(patch.stock)
    if (patch.price) setPrice(patch.price)
    if (patch.compareAt) setCompareAt(patch.compareAt)
    setShippingCountry(patch.shippingCountry)
    setWarehouseType(patch.warehouseType)
    setProcessingTime(patch.processingTime)
    setDeliveryMin(patch.deliveryMin)
    setDeliveryMax(patch.deliveryMax)
    setShippingCost(patch.shippingCost)
    setSpecValues((prev) => ({ ...prev, ...patch.specValuesPatch }))
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
      setShipsFrom(typeof data.shipsFrom === "string" ? data.shipsFrom : "")
      const dd = data.deliveryDays
      setDeliveryDays(dd != null && Number.isFinite(Number(dd)) ? String(dd) : "")
      setFreeShipping(Boolean(data.freeShipping))
      setSupplierTag(typeof data.supplierTag === "string" ? data.supplierTag : "")
      const colorsRaw = data.colors
      const colorList = Array.isArray(colorsRaw)
        ? colorsRaw
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
      const parsedColorImages = parseProductColorImagesFromDb(data.colorImages)
      const imageForColor = (c: string) =>
        parsedColorImages?.find((r) => r.color === c)?.image?.trim() ?? ""

      const parsedVariants = parseVariantsPayload(data.variants)
      if (parsedVariants?.variantRows?.length) {
        setVariantFormMode("advanced")
        setVariantRows(parsedVariants.variantRows)
        setVariantSizesText(parsedVariants.size?.length ? parsedVariants.size.join(", ") : "")
        setVariantColorsText(colorList.join(", "))
        setSimpleColorRows([])
      } else if (parsedVariants?.size?.length) {
        setVariantFormMode("simple")
        setVariantSizesText(parsedVariants.size.join(", "))
        setVariantRows([])
        setVariantColorsText("")
        setSimpleColorRows(
          colorList.length > 0
            ? colorList.map((c) => ({
                id: newVariantRowId(),
                name: c,
                image: imageForColor(c),
              }))
            : []
        )
      } else if (colorList.length > 0) {
        setVariantFormMode("simple")
        setVariantSizesText("")
        setVariantRows([])
        setVariantColorsText("")
        setSimpleColorRows(
          colorList.map((c) => ({
            id: newVariantRowId(),
            name: c,
            image: imageForColor(c),
          }))
        )
      } else {
        setVariantFormMode("none")
        setVariantSizesText("")
        setVariantRows([])
        setVariantColorsText("")
        setSimpleColorRows([])
      }
      const bulletsRaw = data.descriptionBullets
      if (Array.isArray(bulletsRaw)) {
        const lines = bulletsRaw
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
        setDescriptionBullets(lines.length > 0 ? lines : [""])
      } else {
        setDescriptionBullets([""])
      }
      const attrs = data.attributes
      if (Array.isArray(attrs)) {
        const next: Record<string, string> = {}
        for (const row of attrs) {
          if (!row || typeof row !== "object") continue
          const r = row as Record<string, unknown>
          const key = typeof r.key === "string" ? r.key : ""
          if (!key) continue
          next[key] = typeof r.value === "string" ? r.value : String(r.value ?? "")
        }
        setSpecValues(next)
      } else {
        setSpecValues({})
      }
      setProductIsDraft(Boolean(data.isDraft))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load product")
      router.replace("/dashboard/supplier/products/new")
    } finally {
      setLoadingProduct(false)
    }
  }, [router])

  useEffect(() => {
    if (!urlListingId) {
      if (!pendingDraftListingId) setProductIsDraft(false)
      return
    }
    void loadProduct(urlListingId)
  }, [urlListingId, loadProduct, pendingDraftListingId])

  useEffect(() => {
    const n = Number(commission)
    if (Number.isFinite(n) && n > commissionMax) {
      setCommission(String(commissionMax))
    }
  }, [commission, commissionMax])

  const assembleListingPayload = useCallback(
    (draftPriceFallback: boolean): Record<string, unknown> => {
      const productAttributes = mergedCategoryAttrs
        .map((a) => ({
          key: a.key,
          label: a.label,
          value: (specValues[a.key] ?? "").trim(),
        }))
        .filter((row) => row.value.length > 0)

      let priceN = Number(price)
      if (draftPriceFallback && (!Number.isFinite(priceN) || priceN <= 0)) {
        priceN = 1
      }

      const simpleSizes = parseCsvOptions(variantSizesText)
      const advancedColorLabels = [...new Set(parseCsvOptions(variantColorsText))]
      let variantsPayload: Record<string, unknown> | null = null
      let colorsPayload: string[] = []
      let colorImagesPayload: Array<{ color: string; image: string }> | undefined = undefined

      if (variantFormMode === "simple") {
        const ordered: string[] = []
        const imgBy = new Map<string, string>()
        for (const row of simpleColorRows) {
          const n = row.name.trim()
          if (!n) continue
          if (!imgBy.has(n)) ordered.push(n)
          imgBy.set(n, row.image.trim())
        }
        colorsPayload = ordered.slice(0, 40)
        if (simpleSizes.length > 0) {
          variantsPayload = { size: simpleSizes }
        }
        colorImagesPayload =
          colorsPayload.length > 0
            ? colorsPayload.map((c) => ({
                color: c.slice(0, 48),
                image: (imgBy.get(c) ?? "").trim().slice(0, 2000),
              }))
            : undefined
      } else if (variantFormMode === "advanced") {
        colorsPayload = advancedColorLabels
        const validRows = variantRows
          .filter((r) => r.name.trim().length > 0)
          .map((r) => ({
            id: r.id,
            name: r.name.trim().slice(0, 160),
            sku: r.sku.trim().slice(0, 80),
            priceCents: Math.max(0, Math.round(r.priceCents)),
            stock: Math.max(0, Math.round(r.stock)),
            commission: Math.min(50, Math.max(1, Math.round(r.commission))),
            sales: Math.max(0, Math.round(r.sales)),
            ...(r.image?.trim() ? { image: r.image.trim().slice(0, 2000) } : {}),
            ...(r.priceType?.trim() ? { priceType: r.priceType.trim().slice(0, 32) } : {}),
          }))
          .slice(0, 500)
        if (validRows.length > 0) {
          variantsPayload = { variantRows: validRows }
        }
        colorImagesPayload =
          colorsPayload.length > 0
            ? colorsPayload.map((color) => {
                const lc = color.toLowerCase()
                const matched = variantRows.find(
                  (r) => r.name.toLowerCase().includes(lc) && Boolean(r.image?.trim())
                )
                return {
                  color: color.trim().slice(0, 48),
                  image: (matched?.image?.trim() || "").slice(0, 2000),
                }
              })
            : undefined
      }

      let stockOut = Math.max(0, Math.round(Number(stock) || 0))
      if (
        variantFormMode === "advanced" &&
        variantsPayload &&
        Array.isArray(variantsPayload.variantRows) &&
        (variantsPayload.variantRows as { stock: number }[]).length > 0
      ) {
        stockOut = (variantsPayload.variantRows as { stock: number }[]).reduce(
          (acc, r) => acc + Math.max(0, Math.round(r.stock)),
          0
        )
      }

      return {
        name: name.trim(),
        description: description.trim(),
        price: priceN,
        compareAt: compareAt.trim() ? Number(compareAt) : null,
        stock: stockOut,
        commission: Math.round(Number(commission)),
        listingKind,
        images,
        categoryId: categoryId.trim(),
        shippingCountry: shippingCountry.trim().toUpperCase().slice(0, 2) || undefined,
        warehouseType: warehouseType || undefined,
        processingTime: Math.round(Number(processingTime) || 1),
        deliveryMin: Math.round(Number(deliveryMin) || 2),
        deliveryMax: Math.round(Number(deliveryMax) || 5),
        shippingCostEUR: Number(shippingCost) || 0,
        shippingMethods: ["standard"],
        productAttributes,
        shipsFrom: shipsFrom.trim() || undefined,
        deliveryDays:
          deliveryDays.trim() === ""
            ? undefined
            : Math.round(Number(deliveryDays)) >= 0
              ? Math.round(Number(deliveryDays))
              : undefined,
        freeShipping,
        supplierTag: supplierTag.trim() || undefined,
        descriptionBullets: descriptionBullets.map((s) => s.trim()).filter(Boolean),
        colors: colorsPayload,
        variants: variantsPayload,
        colorImages: colorImagesPayload,
      }
    },
    [
      mergedCategoryAttrs,
      specValues,
      price,
      name,
      description,
      compareAt,
      stock,
      commission,
      listingKind,
      images,
      categoryId,
      shippingCountry,
      warehouseType,
      processingTime,
      deliveryMin,
      deliveryMax,
      shippingCost,
      shipsFrom,
      deliveryDays,
      freeShipping,
      supplierTag,
      descriptionBullets,
      variantFormMode,
      variantSizesText,
      variantColorsText,
      simpleColorRows,
      variantRows,
    ]
  )

  useEffect(() => {
    if (urlListingId || pendingDraftListingId || hydratedFromCache.current || loadingBrowse) return
    const c = readSupplierAddProductDraftCache(cacheMode)
    hydratedFromCache.current = true
    if (!c) return
    if (Date.now() - c.updatedAt > 14 * 24 * 60 * 60 * 1000) return
    setStep(c.step)
    setName(c.name)
    setDescription(c.description)
    setCategoryId(c.categoryId)
    setImages(Array.isArray(c.images) ? c.images : [])
    setPrice(c.price)
    setCompareAt(c.compareAt)
    setStock(c.stock)
    if (LISTING_KINDS.includes(c.listingKind as ListingKind)) {
      setListingKind(c.listingKind as ListingKind)
    }
    setCommission(c.commission)
    setShippingCountry(c.shippingCountry)
    setWarehouseType(
      c.warehouseType === "local" || c.warehouseType === "regional" || c.warehouseType === "international"
        ? c.warehouseType
        : ""
    )
    setProcessingTime(c.processingTime)
    setDeliveryMin(c.deliveryMin)
    setDeliveryMax(c.deliveryMax)
    setShippingCost(c.shippingCost)
    setShipsFrom(c.shipsFrom)
    setDeliveryDays(c.deliveryDays)
    setFreeShipping(c.freeShipping)
    setSupplierTag(c.supplierTag)
    setSpecValues(c.specValues)
    setDescriptionBullets(c.descriptionBullets?.length ? c.descriptionBullets : [""])
    if (c.variantFormMode === "none" || c.variantFormMode === "simple" || c.variantFormMode === "advanced") {
      setVariantFormMode(c.variantFormMode)
    }
    if (typeof c.variantSizesText === "string") setVariantSizesText(c.variantSizesText)
    if (typeof c.variantColorsText === "string") setVariantColorsText(c.variantColorsText)
    if (Array.isArray(c.simpleColorRows) && c.simpleColorRows.length > 0) {
      const ok = c.simpleColorRows.filter(
        (r): r is SupplierSimpleColorRow =>
          r != null &&
          typeof r === "object" &&
          typeof (r as SupplierSimpleColorRow).id === "string" &&
          typeof (r as SupplierSimpleColorRow).name === "string" &&
          typeof (r as SupplierSimpleColorRow).image === "string"
      )
      if (ok.length > 0) setSimpleColorRows(ok)
    } else if (Array.isArray(c.variantColorImageRows) && c.variantColorImageRows.length > 0) {
      setSimpleColorRows(
        c.variantColorImageRows
          .filter(
            (r): r is { color: string; image: string } =>
              r != null && typeof r === "object" && typeof r.color === "string" && typeof r.image === "string"
          )
          .map((r) => ({ id: newVariantRowId(), name: r.color, image: r.image }))
      )
    } else if (typeof c.variantColorsText === "string" && c.variantColorsText.trim()) {
      setSimpleColorRows(
        [...new Set(parseCsvOptions(c.variantColorsText))].map((name) => ({
          id: newVariantRowId(),
          name,
          image: "",
        }))
      )
    }
    if (Array.isArray(c.variantRows) && c.variantRows.length > 0) {
      setVariantRows(
        c.variantRows.filter(
          (r): r is ProductVariantLine =>
            r != null &&
            typeof r === "object" &&
            typeof (r as ProductVariantLine).id === "string" &&
            typeof (r as ProductVariantLine).name === "string"
        )
      )
    }
    toast("Restored your last on-device draft for this workflow.", { duration: 4500 })
  }, [urlListingId, pendingDraftListingId, loadingBrowse, cacheMode])

  const autosaveFingerprint = useMemo(
    () =>
      JSON.stringify(
        omitVariantSnapshotForDraftStep1(assembleListingPayload(true) as Record<string, unknown>, step)
      ) + String(step),
    [assembleListingPayload, step]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (loadingProduct || saving) return
    if (editId && !productIsDraft) return

    const hasServerDraftBucket = Boolean(
      autosaveListingId && (productIsDraft || draftIdFromUrl || pendingDraftListingId)
    )
    const hasLocalSignals =
      !editId &&
      (Boolean(name.trim()) ||
        Boolean(description.trim()) ||
        Boolean(categoryId.trim()) ||
        images.length > 0 ||
        Boolean(shipsFrom.trim()))
    if (!(hasServerDraftBucket || hasLocalSignals)) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const body = omitVariantSnapshotForDraftStep1(
          assembleListingPayload(true) as Record<string, unknown>,
          step
        )
        const fp = JSON.stringify(body)
        if (fp === lastAutosaveJson.current) return
        try {
          if (cancelled) return
          setDraftSync("saving")
          if (autosaveListingId) {
            const res = await fetch(`/api/supplier/products/${autosaveListingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(body),
            })
            const json = (await res.json().catch(() => ({}))) as { error?: string }
            if (!res.ok) {
              throw new Error(typeof json.error === "string" ? json.error : "Draft sync failed")
            }
          } else {
            const res = await fetch("/api/supplier/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ ...body, saveAsDraft: true }),
            })
            const json = (await res.json()) as { id?: string; error?: string }
            if (!res.ok) {
              throw new Error(typeof json.error === "string" ? json.error : "Draft sync failed")
            }
            if (json.id) {
              setPendingDraftListingId(json.id)
              setProductIsDraft(true)
              const qs = new URLSearchParams(searchParams.toString())
              qs.set("draft", json.id)
              router.replace(`${pathname}?${qs.toString()}`, { scroll: false })
            }
          }
          if (cancelled) return
          lastAutosaveJson.current = fp
          setDraftSync("saved")
          setDraftSyncAt(Date.now())
        } catch {
          if (!cancelled) setDraftSync("error")
        }
      })()
    }, 2400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    assembleListingPayload,
    autosaveFingerprint,
    autosaveListingId,
    categoryId,
    description,
    draftIdFromUrl,
    editId,
    images,
    loadingProduct,
    name,
    pathname,
    pendingDraftListingId,
    productIsDraft,
    router,
    saving,
    searchParams,
    shipsFrom,
    step,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (editId && !productIsDraft) return
    if (!(name.trim() || description.trim() || categoryId.trim() || images.length > 0)) return
    const t = window.setTimeout(() => {
      writeSupplierAddProductDraftCache({
        mode: cacheMode,
        step,
        name,
        description,
        categoryId,
        images,
        price,
        compareAt,
        stock,
        listingKind,
        commission,
        shippingCountry,
        warehouseType,
        processingTime,
        deliveryMin,
        deliveryMax,
        shippingCost,
        shipsFrom,
        deliveryDays,
        freeShipping,
        supplierTag,
        specValues,
        descriptionBullets,
        variantFormMode,
        variantSizesText,
        variantColorsText,
        simpleColorRows,
        variantRows,
      })
    }, 720)
    return () => window.clearTimeout(t)
  }, [
    cacheMode,
    step,
    categoryId,
    commission,
    compareAt,
    deliveryDays,
    deliveryMax,
    deliveryMin,
    description,
    descriptionBullets,
    editId,
    freeShipping,
    images,
    listingKind,
    name,
    price,
    productIsDraft,
    processingTime,
    shippingCost,
    shippingCountry,
    shipsFrom,
    specValues,
    stock,
    supplierTag,
    warehouseType,
    variantFormMode,
    variantSizesText,
    variantColorsText,
    simpleColorRows,
    variantRows,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return
    const dirty =
      productIsDraft ||
      (!editId &&
        Boolean(
          name.trim() ||
            description.trim() ||
            categoryId.trim() ||
            images.length ||
            autosaveListingId
        ))
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [autosaveListingId, categoryId, description, editId, images.length, name, productIsDraft])

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
    if (!categoryId.trim()) {
      toast.error("Please select a category.")
      return
    }
    const missingSpecs = missingRequiredCategorySpecs(mergedCategoryAttrs, specValues)
    if (missingSpecs.length > 0) {
      toast.error(`Fill required fields: ${missingSpecs.map((m) => m.label).join(", ")}`)
      return
    }
    if (variantFormMode === "advanced" && variantRows.length > 0) {
      const named = variantRows.filter((r) => r.name.trim())
      if (named.length === 0) {
        toast.error(
          "Add a label for each variant row, delete empty rows, or switch to “No variants” / “Sizes & colors”."
        )
        return
      }
    }
    if (variantFormMode === "simple") {
      const colorNames = simpleColorRows.map((r) => r.name.trim()).filter(Boolean)
      if (colorNames.length !== new Set(colorNames).size) {
        toast.error("Chaque nom de couleur doit être unique.")
        return
      }
    }

    const payload = assembleListingPayload(false)
    const serverId = editId || draftIdFromUrl || pendingDraftListingId

    setSaving(true)
    try {
      let res: Response
      if (serverId && productIsDraft) {
        res = await fetch(`/api/supplier/products/${serverId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ...payload, publish: true }),
        })
      } else if (serverId && !productIsDraft) {
        res = await fetch(`/api/supplier/products/${serverId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/supplier/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
      }
      const json = (await res.json()) as { error?: string; id?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Save failed")
      }
      if (categoryId && categoryPath.length) {
        void fetch("/api/supplier/recent-categories", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leafId: categoryId, path: categoryPath }),
        })
          .then((r) => r.json())
          .then((j: { recent?: RecentCategoryEntry[] }) => {
            if (Array.isArray(j.recent)) setRecentCategories(j.recent)
          })
          .catch(() => {})
      }
      clearSupplierAddProductDraftCache()
      lastAutosaveJson.current = ""
      toast.success(
        serverId && !productIsDraft ? "Product updated." : "Product published to your catalog."
      )
      router.push("/dashboard/supplier/products")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const specMissing = useMemo(
    () => missingRequiredCategorySpecs(mergedCategoryAttrs, specValues),
    [mergedCategoryAttrs, specValues]
  )
  const step1Checklist = useMemo(
    () => ({
      title: name.trim().length > 0,
      category: Boolean(categoryId.trim()),
      specs: Boolean(categoryId.trim()) && specMissing.length === 0,
      images: images.length > 0,
    }),
    [name, categoryId, specMissing, images.length]
  )

  const steps = [
    { n: 1 as const, title: "Listing & media", hint: "Story, category, visuals" },
    { n: 2 as const, title: "Pricing & publish", hint: "Economics & go-live" },
  ] as const

  const headerMeta =
    editId && !productIsDraft
      ? {
          kicker: "Edit listing",
          title: "Refine your product",
          blurb: "Adjust story, visuals, specs, marketplace delivery, and economics before saving.",
        }
      : productIsDraft
        ? {
            kicker: "Draft listing",
            title: assistShortcuts ? "Draft with assists" : "Manual draft",
            blurb:
              "Synced to your supplier account in the background—plus a local backup in this browser. Nothing is public until you publish.",
          }
        : assistShortcuts
          ? {
              kicker: "Assist mode",
              title: "Draft your listing",
              blurb:
                "Use optional URL import and AI tools below—then finalize category labels and imagery. Pricing is step 2.",
            }
          : {
              kicker: "New listing",
              title: "Manual listing",
              blurb: "Story, category, and images here; price, stock, shipping, and commission in step 2.",
            }

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const jumpBtnClass =
    "rounded-full border border-zinc-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-violet-400/80 hover:bg-violet-50/80 hover:text-violet-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-500/60 dark:hover:bg-violet-950/30 dark:hover:text-violet-100"

  if (loadingProduct) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-gradient-to-b from-zinc-50 via-violet-50/20 to-zinc-100/80 px-4 dark:from-zinc-950 dark:via-violet-950/10 dark:to-zinc-900">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-violet-400/20" aria-hidden />
          <Loader2 className="relative h-10 w-10 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
        </div>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Loading product…</p>
      </div>
    )
  }

  return (
    <>
      {onBackToMethods ? (
        <div className="border-b border-zinc-200/90 bg-white/95 dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={onBackToMethods}
              className="text-sm font-medium text-teal-700 transition hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
            >
              ← Other listing methods
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
              onClick={() => void signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </Button>
          </div>
        </div>
      ) : null}
      <div className="min-h-screen bg-gradient-to-b from-zinc-100/90 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/95">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white/95 p-6 shadow-md ring-1 ring-black/[0.03] dark:border-zinc-700/80 dark:bg-zinc-950/70 dark:ring-white/[0.04] sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-500/[0.12] blur-3xl dark:bg-violet-500/[0.18]"
            aria-hidden
          />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-emerald-500/[0.06] blur-3xl dark:bg-emerald-500/10" aria-hidden />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <Link
                href="/dashboard/supplier/products"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "-ml-2 inline-flex w-fit gap-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Catalog
              </Link>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                  {headerMeta.kicker}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                  {headerMeta.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {headerMeta.blurb}
                </p>
                {productIsDraft ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <Cloud className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                    {draftSync === "saving" ? (
                      <span>Saving draft…</span>
                    ) : draftSync === "error" ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        Could not sync—check your connection and try again.
                      </span>
                    ) : draftSyncAt ? (
                      <span>
                        Draft saved{" "}
                        {new Date(draftSyncAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : (
                      <span>Autosave runs a few seconds after you stop typing.</span>
                    )}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
              {!onBackToMethods ? (
                <Link
                  href="/dashboard/supplier/bulk-import"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex justify-center border-zinc-300 bg-white/80 dark:border-zinc-600 dark:bg-zinc-900/80"
                  )}
                >
                  Bulk Excel import
                </Link>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="inline-flex justify-center gap-1.5 border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Log out
              </Button>
            </div>
          </div>
        </header>

        <nav className="mt-8" aria-label="Form steps">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
            <div className="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-zinc-200/90 bg-gradient-to-b from-white via-zinc-50/50 to-zinc-100/40 shadow-lg shadow-zinc-900/5 dark:border-zinc-700/80 dark:from-zinc-900 dark:via-zinc-950/80 dark:to-zinc-950 sm:grid-cols-2">
              {steps.map(({ n, title, hint }, i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStep(n)}
                  className={cn(
                    "relative flex items-start gap-3 px-4 py-4 text-left transition sm:px-6 sm:py-5",
                    i === 0 && "sm:border-r sm:border-zinc-200/80 dark:sm:border-zinc-700/80",
                    step === n
                      ? "bg-white/95 ring-2 ring-inset ring-violet-500/40 dark:bg-zinc-900/95 dark:ring-violet-400/35"
                      : "hover:bg-white/80 dark:hover:bg-zinc-800/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                      step === n
                        ? "bg-violet-600 text-white shadow-lg shadow-violet-500/35"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {n}
                  </span>
                  <span className="min-w-0 flex-1 pr-6">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
                      {n === 1 && step === 2 ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                      {hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex shrink-0 flex-col justify-center rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-center shadow-sm dark:border-zinc-700/80 dark:bg-zinc-950/80 sm:min-w-[7.5rem]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Progress
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {step}
                <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500"> /2</span>
              </p>
            </div>
          </div>
        </nav>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-12">
          <div className="min-w-0 space-y-10">
            {step === 1 ? (
              <>
                <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-gradient-to-r from-white via-violet-50/30 to-white px-4 py-3.5 shadow-sm dark:border-zinc-700/80 dark:from-zinc-950 dark:via-violet-950/20 dark:to-zinc-950 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    On this page
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assistShortcuts ? (
                      <button
                        type="button"
                        className={jumpBtnClass}
                        onClick={() => scrollToSection("add-product-shortcuts")}
                      >
                        Shortcuts
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={jumpBtnClass}
                      onClick={() => scrollToSection("add-product-story")}
                    >
                      Story
                    </button>
                    <button
                      type="button"
                      className={jumpBtnClass}
                      onClick={() => scrollToSection("add-product-classify")}
                    >
                      Category &amp; specs
                    </button>
                    <button
                      type="button"
                      className={jumpBtnClass}
                      onClick={() => scrollToSection("add-product-media")}
                    >
                      Photos
                    </button>
                  </div>
                </div>

                {assistShortcuts ? (
                  <SectionCard
                    id="add-product-shortcuts"
                    icon={Zap}
                    variant="accent"
                    title="Shortcuts"
                    description="Pull in data from a URL or let AI draft copy—optional, but fast when you’re in a hurry."
                  >
                    <div className="space-y-8 border-t border-violet-200/50 pt-6 dark:border-violet-900/30">
                      <SupplierUrlImportPanel categoryAttrs={mergedCategoryAttrs} onApply={handleUrlImportApply} />
                      <SupplierAiPublishPanel
                        initialTitle={name}
                        initialNotes={description}
                        initialImageUrls={images}
                        categoryAttrs={mergedCategoryAttrs}
                        categoryPathLabel={categoryPathLabel}
                        onGenerated={handleAiGenerated}
                      />
                    </div>
                  </SectionCard>
                ) : null}

                <div className="grid gap-8 xl:grid-cols-12 xl:gap-x-10 xl:items-start">
                  <div className="space-y-8 xl:col-span-5">
                    <SectionCard
                      id="add-product-story"
                      icon={Package}
                      title="Product story"
                      description="Name and description appear to affiliates and on your storefront."
                    >
                      <div>
                        <Label htmlFor="p-name">
                          Product name <span className="text-red-600">*</span>
                        </Label>
                        <Input
                          id="p-name"
                          className="mt-1.5 h-11"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Wireless earbuds with ANC"
                          maxLength={500}
                        />
                      </div>
                      <div>
                        <Label htmlFor="p-desc">Description</Label>
                        <textarea
                          id="p-desc"
                          className="mt-1.5 min-h-[132px] w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900/50 dark:focus:border-violet-600"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Highlights, materials, who it’s for—what affiliates should know"
                        />
                      </div>
                      <div>
                        <Label className="text-zinc-800 dark:text-zinc-100">About this item (bullet points)</Label>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Structured selling points shoppers see first on the product page (like marketplace “About
                          this item”).
                        </p>
                        <div className="mt-2 space-y-2">
                          {descriptionBullets.map((line, i) => (
                            <div key={i} className="flex gap-2">
                              <Input
                                className="h-10 min-w-0 flex-1"
                                value={line}
                                onChange={(e) => {
                                  const next = [...descriptionBullets]
                                  next[i] = e.target.value
                                  setDescriptionBullets(next)
                                }}
                                placeholder={`Selling point ${i + 1}`}
                                maxLength={500}
                              />
                              {descriptionBullets.length > 1 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 text-zinc-500 hover:text-red-600"
                                  onClick={() =>
                                    setDescriptionBullets(descriptionBullets.filter((_, j) => j !== i))
                                  }
                                  aria-label="Remove bullet"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 border-dashed text-zinc-600 dark:text-zinc-300"
                            onClick={() => setDescriptionBullets([...descriptionBullets, ""])}
                          >
                            <Plus className="h-4 w-4" aria-hidden /> Add bullet
                          </Button>
                        </div>
                      </div>
                    </SectionCard>
                  </div>

                  <div className="space-y-8 xl:col-span-7">
                    <SectionCard
                      id="add-product-classify"
                      icon={Tag}
                      title="Classification"
                      description="Choose a leaf category to load the right specs for this product."
                    >
                      <div>
                        <Label className="inline-flex items-center gap-1">
                          Category <span className="text-red-600">*</span>
                        </Label>
                        <div className="mt-1.5">
                          <SupplierCategoryPicker
                            browse={browse}
                            recent={recentCategories}
                            value={categoryId}
                            onChange={(leafId, path) => {
                              setCategoryId(leafId)
                              setCategoryPath(path)
                              setSpecValues({})
                            }}
                            keywordSuggestions={keywordCategorySuggestions}
                            aiSuggestions={aiCategorySuggestions}
                            aiLoading={aiSuggestLoading}
                            loading={loadingBrowse}
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-100 bg-zinc-50/40 p-1 dark:border-zinc-800 dark:bg-zinc-900/30">
                        <CategoryAttributeFields
                          attributes={mergedCategoryAttrs}
                          loading={attrsLoading}
                          values={specValues}
                          onChange={setSpecValues}
                        />
                      </div>
                    </SectionCard>
                  </div>

                  <div className="space-y-8 xl:col-span-12">
                    <SectionCard
                      id="add-product-media"
                      icon={ImageIcon}
                      title="Visual assets"
                      description="Strong photos convert—multiple angles and lifestyle shots win."
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Label className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-100">
                          <span className="text-red-600">*</span>
                          Images
                        </Label>
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          title="Five or more images typically perform best."
                          aria-label="Image count tip"
                        >
                          <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Upload several angles; five or more is ideal for marketplace trust.
                      </p>
                      <div className="mt-3">
                        <SupplierProductImageUpload initialUrls={images} onImagesChange={setImages} />
                      </div>
                    </SectionCard>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/50 via-white to-white px-4 py-4 dark:border-violet-900/40 dark:from-violet-950/25 dark:via-zinc-950 dark:to-zinc-950 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Step 2</span> — base price, stock,
                    variants, and affiliate economics.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full shrink-0 bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 sm:w-auto"
                    onClick={() => {
                      if (!categoryId.trim()) {
                        toast.error("Please select a category.")
                        return
                      }
                      const miss = missingRequiredCategorySpecs(mergedCategoryAttrs, specValues)
                      if (miss.length > 0) {
                        toast.error(`Fill required fields: ${miss.map((m) => m.label).join(", ")}`)
                        return
                      }
                      setStep(2)
                    }}
                  >
                    Continue to pricing
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-8 xl:grid-cols-2 xl:gap-x-10 xl:items-start">
                  <div className="space-y-8">
                <SectionCard
                  icon={Wallet}
                  title="Pricing & inventory"
                  description="Your cost basis and stock. Affiliates set retail; commission applies to their margin."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="p-price">Base price</Label>
                      <Input
                        id="p-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="mt-1.5 h-11"
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
                        className="mt-1.5 h-11"
                        value={compareAt}
                        onChange={(e) => setCompareAt(e.target.value)}
                        placeholder="MSRP"
                      />
                      {compareError ? <p className="mt-1 text-xs text-red-600">{compareError}</p> : null}
                    </div>
                    {unitPriceFromVolumeHint ? (
                      <p className="sm:col-span-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Unit price signal: {unitPriceFromVolumeHint}
                      </p>
                    ) : null}
                    <div>
                      <Label htmlFor="p-stock">Stock</Label>
                      <Input
                        id="p-stock"
                        type="number"
                        min="0"
                        step="1"
                        className="mt-1.5 h-11"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        disabled={
                          variantFormMode === "advanced" &&
                          variantRows.some((r) => r.name.trim().length > 0)
                        }
                      />
                      {variantStockHint ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{variantStockHint}</p>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={Layers}
                  title="Options & variants"
                  description="Optional: list sizes or colors for the PDP, or track each SKU with its own stock (totals into inventory above)."
                >
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["none", "No variants"],
                        ["simple", "Sizes & colors"],
                        ["advanced", "SKU lines"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVariantFormMode(mode)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm font-medium transition",
                          variantFormMode === mode
                            ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {variantFormMode === "simple" ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="v-sizes">Sizes (comma-separated)</Label>
                        <Input
                          id="v-sizes"
                          className="mt-1.5 h-11"
                          value={variantSizesText}
                          onChange={(e) => setVariantSizesText(e.target.value)}
                          placeholder="e.g. S, M, L, XL"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <Label>Couleurs</Label>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                              Ajoutez une ligne par couleur (nom + photo optionnelle pour la fiche produit).
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1 shrink-0"
                            onClick={() =>
                              setSimpleColorRows((prev) => [
                                ...prev,
                                { id: newVariantRowId(), name: "", image: "" },
                              ])
                            }
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Ajouter une couleur
                          </Button>
                        </div>
                        <div className="mt-3 space-y-3">
                          {simpleColorRows.map((row, i) => (
                            <div
                              key={row.id}
                              className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40 sm:flex-row sm:items-end"
                            >
                              <div className="min-w-0 flex-1">
                                <Label htmlFor={`v-color-name-${row.id}`} className="text-xs">
                                  Nom
                                </Label>
                                <Input
                                  id={`v-color-name-${row.id}`}
                                  className="mt-1.5 h-10"
                                  value={row.name}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setSimpleColorRows((prev) =>
                                      prev.map((r, j) => (j === i ? { ...r, name: v } : r))
                                    )
                                  }}
                                  placeholder="ex. Violet"
                                  maxLength={48}
                                />
                              </div>
                              <div className="min-w-0 flex-[2]">
                                <Label htmlFor={`v-color-img-${row.id}`} className="text-xs">
                                  Photo (URL)
                                </Label>
                                <Input
                                  id={`v-color-img-${row.id}`}
                                  type="url"
                                  className="mt-1.5 h-10"
                                  value={row.image}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setSimpleColorRows((prev) =>
                                      prev.map((r, j) => (j === i ? { ...r, image: v } : r))
                                    )
                                  }}
                                  placeholder="https://…"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 shrink-0 text-zinc-500 hover:text-red-600"
                                onClick={() =>
                                  setSimpleColorRows((prev) => prev.filter((_, j) => j !== i))
                                }
                                aria-label="Supprimer cette couleur"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : variantFormMode === "advanced" ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="v-colors-adv">Color labels (optional, comma-separated)</Label>
                        <Input
                          id="v-colors-adv"
                          className="mt-1.5 h-11"
                          value={variantColorsText}
                          onChange={(e) => setVariantColorsText(e.target.value)}
                          placeholder="e.g. Black, Navy — for PDP swatches"
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Each row needs a label (e.g. “Black / M”). Leave price blank to use your base price.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() =>
                            setVariantRows((prev) => [...prev, defaultVariantRow(commission)])
                          }
                        >
                          <Plus className="h-4 w-4" aria-hidden /> Add row
                        </Button>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            <tr>
                              <th className="px-3 py-2">Label</th>
                              <th className="px-3 py-2">SKU</th>
                              <th className="px-3 py-2">Price (USD)</th>
                              <th className="px-3 py-2">Stock</th>
                              <th className="px-3 py-2">Comm. %</th>
                              <th className="w-10 px-2 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {variantRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-xs text-zinc-500">
                                  No rows yet — add a line for each sellable SKU.
                                </td>
                              </tr>
                            ) : (
                              variantRows.map((row, i) => (
                                <tr
                                  key={row.id}
                                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                                >
                                  <td className="px-2 py-1.5 align-middle">
                                    <Input
                                      className="h-9 min-w-[120px]"
                                      value={row.name}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setVariantRows((prev) =>
                                          prev.map((r, j) => (j === i ? { ...r, name: v } : r))
                                        )
                                      }}
                                      placeholder="e.g. Black / M"
                                      maxLength={160}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 align-middle">
                                    <Input
                                      className="h-9 w-24 min-w-[5rem] sm:w-28"
                                      value={row.sku}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setVariantRows((prev) =>
                                          prev.map((r, j) => (j === i ? { ...r, sku: v } : r))
                                        )
                                      }}
                                      placeholder="—"
                                      maxLength={80}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 align-middle">
                                    <Input
                                      className="h-9 w-24"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={row.priceCents > 0 ? (row.priceCents / 100).toFixed(2) : ""}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        const n = Number(raw)
                                        setVariantRows((prev) =>
                                          prev.map((r, j) =>
                                            j === i
                                              ? {
                                                  ...r,
                                                  priceCents:
                                                    raw.trim() === "" || !Number.isFinite(n)
                                                      ? 0
                                                      : Math.max(0, Math.round(n * 100)),
                                                }
                                              : r
                                          )
                                        )
                                      }}
                                      placeholder="Base"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 align-middle">
                                    <Input
                                      className="h-9 w-20"
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={row.stock}
                                      onChange={(e) => {
                                        const n = Math.max(0, Math.round(Number(e.target.value) || 0))
                                        setVariantRows((prev) =>
                                          prev.map((r, j) => (j === i ? { ...r, stock: n } : r))
                                        )
                                      }}
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 align-middle">
                                    <Input
                                      className="h-9 w-16"
                                      type="number"
                                      min={1}
                                      max={50}
                                      step={1}
                                      value={row.commission}
                                      onChange={(e) => {
                                        const n = Math.round(Number(e.target.value) || 20)
                                        setVariantRows((prev) =>
                                          prev.map((r, j) =>
                                            j === i
                                              ? {
                                                  ...r,
                                                  commission: Math.min(50, Math.max(1, n)),
                                                }
                                              : r
                                          )
                                        )
                                      }}
                                    />
                                  </td>
                                  <td className="px-1 py-1.5 align-middle">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 text-zinc-500 hover:text-red-600"
                                      onClick={() =>
                                        setVariantRows((prev) => prev.filter((_, j) => j !== i))
                                      }
                                      aria-label="Remove row"
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
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      One sellable unit — no size or color pickers on the product page from this listing.
                    </p>
                  )}
                </SectionCard>
                  </div>
                  <div className="space-y-8">
                <SectionCard
                  icon={Globe2}
                  title="Marketplace delivery"
                  description="Region label, delivery window, and free-shipping help buyers find your listing. Optional catalog tag for your own grouping."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="m-ships">Ships from (display)</Label>
                      <Input
                        id="m-ships"
                        className="mt-1.5 h-11"
                        value={shipsFrom}
                        onChange={(e) => setShipsFrom(e.target.value)}
                        placeholder="e.g. EU, US, Global"
                        maxLength={48}
                      />
                    </div>
                    <div>
                      <Label htmlFor="m-days">Typical delivery (days)</Label>
                      <Input
                        id="m-days"
                        type="number"
                        min={0}
                        max={365}
                        className="mt-1.5 h-11"
                        value={deliveryDays}
                        onChange={(e) => setDeliveryDays(e.target.value)}
                        placeholder="e.g. 5"
                      />
                    </div>
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <input
                        id="m-free"
                        type="checkbox"
                        checked={freeShipping}
                        onChange={(e) => setFreeShipping(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600"
                      />
                      <Label htmlFor="m-free" className="font-normal leading-snug text-zinc-700 dark:text-zinc-300">
                        Offer free shipping (shows in marketplace filters when enabled)
                      </Label>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="m-tag">Catalog label (optional)</Label>
                      <Input
                        id="m-tag"
                        className="mt-1.5 h-11"
                        value={supplierTag}
                        onChange={(e) => setSupplierTag(e.target.value)}
                        placeholder="Short tag for your catalog (max 64 characters)"
                        maxLength={64}
                      />
                    </div>
                  </div>
                </SectionCard>

                <section
                  id="add-product-commission"
                  className="scroll-mt-28 overflow-hidden rounded-3xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-violet-50/50 p-6 shadow-md ring-1 ring-violet-500/10 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-violet-950/30 dark:ring-violet-400/10 sm:p-7"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-violet-950 dark:text-violet-100">
                        Affiliate commission
                      </h2>
                      <p className="mt-1 text-sm text-violet-900/85 dark:text-violet-200/90">
                        Share of the affiliate&apos;s margin (their price minus your base) when a sale
                        completes.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="p-kind">Listing type</Label>
                      <select
                        id="p-kind"
                        className="mt-1.5 flex h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm dark:border-violet-800 dark:bg-zinc-950"
                        value={listingKind}
                        onChange={(e) => setListingKind(e.target.value as ListingKind)}
                      >
                        {LISTING_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {LISTING_LABELS[k]}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-violet-900/75 dark:text-violet-300/85">
                        Up to {commissionMax}% for this listing type. 100% allowed for software and
                        subscriptions only.
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
                        className="mt-1.5 h-11"
                        value={commission}
                        onChange={(e) => setCommission(e.target.value)}
                      />
                      {commissionError ? (
                        <p className="mt-1 text-xs text-red-600">{commissionError}</p>
                      ) : null}
                    </div>
                  </div>
                </section>

                <SectionCard
                  icon={Truck}
                  title="Shipping profile"
                  description="Optional—helps affiliates and filters set buyer expectations."
                >
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                      Advanced shipping fields
                      <span className="text-xs font-normal text-zinc-500 group-open:hidden">
                        Tap to expand
                      </span>
                    </summary>
                    <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:grid-cols-2">
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
                </SectionCard>

                {Number.isFinite(Number(price)) && Number(price) > 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-5 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-950">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Buyer-facing preview
                    </p>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                      Base:{" "}
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatMoneyDisplay(Number(price))}
                      </span>
                      {compareAt.trim() && Number(compareAt) > Number(price) ? (
                        <>
                          {" "}
                          <span className="text-compare-at tabular-nums line-through">
                            {formatMoneyDisplay(Number(compareAt))}
                          </span>
                          {discountPct > 0 ? (
                            <span className="ml-2 inline-flex rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                              −{discountPct}%
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : null}
                </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
                    Back to listing
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    disabled={saving}
                    className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600"
                    onClick={() => void handleSubmit()}
                  >
                    {saving
                      ? "Saving…"
                      : editId && !productIsDraft
                        ? "Save changes"
                        : "Publish product"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              {step === 1 ? (
                <div className="rounded-2xl border border-zinc-200/90 bg-white/95 p-5 shadow-md ring-1 ring-black/[0.02] dark:border-zinc-700/90 dark:bg-zinc-950/80 dark:ring-white/[0.03]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Readiness
                  </p>
                  <ul className="mt-4 space-y-3 text-sm">
                    {(
                      [
                        ["Title", step1Checklist.title],
                        ["Category", step1Checklist.category],
                        ["Required specs", step1Checklist.specs],
                        ["Images", step1Checklist.images],
                      ] as const
                    ).map(([label, ok]) => (
                      <li key={label} className="flex items-center gap-2">
                        {ok ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
                        )}
                        <span className={ok ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500"}>
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Pick a category so required specs match your aisle.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-zinc-50 to-white p-5 shadow-md ring-1 ring-black/[0.02] dark:border-zinc-700/90 dark:from-zinc-900 dark:to-zinc-950 dark:ring-white/[0.03]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Summary
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {name.trim() || "Untitled product"}
                  </p>
                  {categoryPathLabel ? (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{categoryPathLabel}</p>
                  ) : null}
                  {Number.isFinite(Number(price)) && Number(price) > 0 ? (
                    <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                      Base:{" "}
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {formatMoneyDisplay(Number(price))}
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
    </>
  )
}
