"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useDebounce } from "use-debounce"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  Package,
  Sparkles,
  ScanLine,
  Globe2,
  Layers,
  Store,
  Tag,
  Truck,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { BentoShell } from "@/components/affisell/bento-ui"
import { AttachProductVideoActions } from "@/components/attach-product-video-actions"
import { SupplierProductDescriptionField } from "@/components/supplier/supplier-product-description-field"
import { SupplierTitleOptimizer } from "@/components/supplier/supplier-title-optimizer"
import { SupplierSimpleColorImageField } from "@/components/supplier/supplier-simple-color-image-field"
import { SupplierProductImageUpload } from "@/components/supplier/supplier-product-image-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  affiliateCommissionMaxPct,
  type ListingKind,
  LISTING_KINDS,
  maxAffiliateCommissionRatePct,
} from "@/lib/supplier-commission"
import {
  pathFromLeafId,
  type CategoryPathSegment,
  type RecentCategoryEntry,
} from "@/lib/category-browse"
import { suggestFromTitle, titleSuggestionAttributes } from "@/lib/title-parser"
import { SupplierAffisellCommissionField } from "@/components/supplier/supplier-affisell-commission-field"
import {
  SupplierCategoryPicker,
  type BrowsePayload,
  type CategoryPickOrigin,
} from "@/components/supplier/supplier-category-picker"
import { SupplierDeleteDraftButton } from "@/components/supplier/supplier-delete-draft-button"
import {
  SupplierVariantTable,
  type EditableVariantRow,
} from "@/components/supplier/supplier-variant-table"
import { ProductWizard } from "@/components/supplier/ProductWizard"
import { SupplierSimulationCard } from "@/components/supplier/supplier-simulation-card"
import { SupplierSkuErrorsAlert } from "@/components/supplier/supplier-sku-errors-alert"
import {
  SupplierWizardQualityPanel,
  type WizardQualityItem,
} from "@/components/supplier/supplier-wizard-quality-panel"
import { useSupplierProductWizardStore, type WizardStep } from "@/stores/supplier-product-wizard-store"
import type { PendingCategoryConfirmation } from "@/components/supplier/supplier-category-confirm-types"
import { SupplierExpressTaxonomyRail } from "@/components/supplier/supplier-express-taxonomy-rail"
import { useSupplierCategorySuggestions } from "@/components/supplier/use-supplier-category-suggestions"
import { shouldSuggestCategoryConfirmation } from "@/lib/supplier-auto-category-policy"
import {
  mergeCoreCategoryAttrs,
  missingRequiredCategorySpecs,
  type CategoryAttrRow,
} from "@/components/supplier/category-attribute-fields"
import { DynamicAttributes } from "@/components/product-form-dynamic"
import type { CategoryAttributeDto } from "@/lib/category-attribute-api"
import {
  SupplierAiPublishPanel,
  type AiPublishResult,
} from "@/components/supplier/supplier-ai-publish-panel"
import {
  SupplierUrlImportPanel,
  type UrlImportApplyPayload,
} from "@/components/supplier/supplier-url-import-panel"
import { SupplierAiImportAgent } from "@/components/supplier/supplier-ai-import-agent"
import {
  clearSupplierAddProductDraftCache,
  readSupplierAddProductDraftCache,
  writeSupplierAddProductDraftCache,
  type SupplierAddProductCacheMode,
  type SupplierSimpleColorRow,
  type SupplierVariantFormMode,
} from "@/lib/supplier-add-product-draft-cache"
import { newVariantRowId, parseVariantsPayload, type ProductVariantLine } from "@/lib/product-variants"
import {
  effectiveSupplierCatalogPriceEur,
  minSupplierPriceEurFromSkuRows,
  usesVariantSkuPricing,
} from "@/lib/supplier-catalog-price"
import { registerMerchantDraftFlush } from "@/lib/merchant-draft-flush"
import {
  collectClientPublishBlockers,
  mapServerPublishBlockers,
  PUBLISH_FIELD_SCROLL_ID,
  PUBLISH_INPUT_ERROR_CLASS,
  PUBLISH_SECTION_ERROR_CLASS,
  publishBlockerStep,
  type PublishBlocker,
  type PublishFieldKey,
  uniqueBlockerFields,
} from "@/lib/supplier-publish-blockers"
import {
  applySimpleColorsToVariantRowsIfChanged,
  extractOrderedColorNames,
  syncVariantRowsFromSimpleColors,
} from "@/lib/supplier-variant-row-sync"
import {
  apiRowsFromSkuTable,
  colorImageByName,
  generateSkuTableRows,
  productVariantLinesToSkuTableRows,
  skuTableRowFromApiVariant,
  skuTableRowsToProductVariantLines,
  sumSkuTableStock,
  type SkuCustomColumnDef,
  type VariantRowValidationIssue,
} from "@/lib/supplier-sku-builder"
import { formatAffiliateCatalogPreviewLine } from "@/lib/supplier-sku-affiliate-earning"
import { parseSkuHiddenColumns, type SkuOptionalColumnKey } from "@/lib/supplier-sku-columns"
import {
  legacySkuCustomColumnsToDefinitions,
  mergeCustomColumnDefinitions,
  parseCustomColumnsFromDb,
} from "@/lib/product-custom-columns"
import {
  validateSimpleColorName,
  validateSimpleColorRows,
  type SimpleColorValidationIssue,
} from "@/lib/supplier-simple-color-validation"
import { parseProductColorImagesFromDb } from "@/lib/product-color-images"
import { trimColorSwatchImageForStore } from "@/lib/color-swatch-image"
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

const AI_KEY_FEATURES_COUNT = 5

function bulletsForAiCopy(lines: string[]): string[] {
  const trimmed = lines.map((s) => s.trim()).filter(Boolean)
  return Array.from({ length: AI_KEY_FEATURES_COUNT }, (_, i) => trimmed[i] ?? "")
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
  step: WizardStep
): Record<string, unknown> {
  if (step !== 1) return body
  const rest = { ...body }
  delete rest.colors
  delete rest.variants
  delete rest.listingVariants
  delete rest.colorImages
  delete rest.hasVariants
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
  hasError = false,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children: ReactNode
  className?: string
  variant?: "default" | "accent"
  /** In-page anchor for quick navigation */
  id?: string
  /** Publication validation — red frame */
  hasError?: boolean
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 rounded-3xl border bg-white/80 p-6 shadow-sm backdrop-blur-sm ring-1 sm:p-7 dark:bg-zinc-950/75",
        hasError
          ? PUBLISH_SECTION_ERROR_CLASS
          : "border-gray-100 ring-black/[0.02] dark:border-zinc-800 dark:ring-white/[0.04]",
        variant === "accent" && !hasError
          ? "border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-white dark:border-violet-900/40 dark:from-violet-950/20 dark:via-zinc-950/50 dark:to-zinc-950"
          : "",
        hasError && variant === "accent" && "bg-red-50/40 dark:bg-red-950/20",
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
  /** Logged-in supplier — scopes local draft cache and blocks cross-account hydration. */
  ownerUserId: string
  /** Shown when the user arrived from the “Add products” hub (not when editing). */
  onBackToMethods?: () => void
  /** URL import + AI shortcut panels on step 1 (chosen from the hub or `?assist=1`). */
  assistShortcuts?: boolean
  /** Pre-fill commission % from affiliate invite pitch. */
  inviteCommissionHint?: number | null
}

export function SupplierAddProductForm({
  ownerUserId,
  onBackToMethods,
  assistShortcuts = false,
  inviteCommissionHint,
}: SupplierAddProductFormProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const draftIdFromUrl = searchParams.get("draft")?.trim() ?? ""
  const composeQs = searchParams.get("compose") === "1"

  const cacheMode: SupplierAddProductCacheMode = assistShortcuts ? "assist" : composeQs ? "compose" : "plain"
  const tForm = useTranslations("supplier.form")

  /** Server draft ids that 404 (deleted or never synced) — never retry PUT on these. */
  const [deadServerDraftIds, setDeadServerDraftIds] = useState<readonly string[]>([])
  const markServerDraftDead = useCallback((id: string) => {
    setDeadServerDraftIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])
  const draftIdFromUrlUsable =
    draftIdFromUrl && !deadServerDraftIds.includes(draftIdFromUrl) ? draftIdFromUrl : ""
  const urlListingId = editId || draftIdFromUrlUsable

  const [loadingProduct, setLoadingProduct] = useState(
    () => Boolean(editId || draftIdFromUrl)
  )
  const [saving, setSaving] = useState(false)
  const [draftSync, setDraftSync] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [draftSyncAt, setDraftSyncAt] = useState<number | null>(null)
  const [pendingDraftListingId, setPendingDraftListingId] = useState("")
  const [productIsDraft, setProductIsDraft] = useState(false)
  const autosaveListingId = editId || draftIdFromUrlUsable || pendingDraftListingId
  const step = useSupplierProductWizardStore((s) => s.step)
  const trySetStep = useSupplierProductWizardStore((s) => s.trySetStep)
  const nextWizardStep = useSupplierProductWizardStore((s) => s.nextStep)
  const prevWizardStep = useSupplierProductWizardStore((s) => s.prevStep)
  const setStep1Valid = useSupplierProductWizardStore((s) => s.setStep1Valid)
  const setStep2Valid = useSupplierProductWizardStore((s) => s.setStep2Valid)
  const setSkuErrors = useSupplierProductWizardStore((s) => s.setSkuErrors)
  const skuErrors = useSupplierProductWizardStore((s) => s.skuErrors)

  const lastAutosaveJson = useRef("")
  const hydratedFromCache = useRef(false)

  const replaceProductQuery = useCallback(
    (mutate: (qs: URLSearchParams) => void) => {
      const qs = new URLSearchParams(searchParams.toString())
      mutate(qs)
      if (composeQs && !qs.has("compose")) qs.set("compose", "1")
      const next = qs.toString()
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [composeQs, pathname, router, searchParams]
  )

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [descriptionBullets, setDescriptionBullets] = useState<string[]>([""])
  const [descriptionIllustrationImages, setDescriptionIllustrationImages] = useState<string[]>([])
  const [descriptionIllustrationVideos, setDescriptionIllustrationVideos] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [affisellCommissionOverride, setAffisellCommissionOverride] = useState("")
  const [loadedAffisellOverrideBps, setLoadedAffisellOverrideBps] = useState<number | null>(null)
  const [categoryPath, setCategoryPath] = useState<CategoryPathSegment[]>([])
  const [images, setImages] = useState<string[]>([])
  const [price, setPrice] = useState("")
  const [compareAt, setCompareAt] = useState("")
  const [stock, setStock] = useState("0")
  const [variantFormMode, setVariantFormMode] = useState<SupplierVariantFormMode>("none")
  const [variantSizesText, setVariantSizesText] = useState("")
  const [variantColorsText, setVariantColorsText] = useState("")
  const [variantRows, setVariantRows] = useState<ProductVariantLine[]>([])
  const [advancedSkuRows, setAdvancedSkuRows] = useState<EditableVariantRow[]>([])
  const [skuCustomColumns, setSkuCustomColumns] = useState<SkuCustomColumnDef[]>([])
  const [skuHiddenColumns, setSkuHiddenColumns] = useState<SkuOptionalColumnKey[]>([])
  const [skuValidationIssues, setSkuValidationIssues] = useState<VariantRowValidationIssue[]>([])
  const [simpleColorIssues, setSimpleColorIssues] = useState<SimpleColorValidationIssue[]>([])
  const [simpleColorRows, setSimpleColorRows] = useState<SupplierSimpleColorRow[]>([])
  const [listingKind, setListingKind] = useState<ListingKind>("PHYSICAL")
  const [commission, setCommission] = useState("15")

  useEffect(() => {
    if (inviteCommissionHint == null || !Number.isFinite(inviteCommissionHint)) return
    setCommission(String(Math.min(50, Math.max(0, inviteCommissionHint))))
  }, [inviteCommissionHint])

  const [browse, setBrowse] = useState<BrowsePayload | null>(null)
  const [recentCategories, setRecentCategories] = useState<RecentCategoryEntry[]>([])
  const [loadingBrowse, setLoadingBrowse] = useState(true)
  const [debouncedName] = useDebounce(name, 500)

  const categoryMatchBullets = useMemo(
    () => descriptionBullets.map((s) => s.trim()).filter(Boolean),
    [descriptionBullets]
  )

  const [debouncedCategoryBullets] = useDebounce(categoryMatchBullets, 500)
  const [categoryAiTag, setCategoryAiTag] = useState(false)
  const [categoryManualLock, setCategoryManualLock] = useState(false)
  const [pendingCategoryConfirm, setPendingCategoryConfirm] =
    useState<PendingCategoryConfirmation | null>(null)
  const dismissedCategoryFingerprintsRef = useRef<Set<string>>(new Set())
  const lastSuggestedTitleRef = useRef("")
  const lastTitleParserKeyRef = useRef<string | null>(null)
  const [shippingCountry, setShippingCountry] = useState("")
  const [warehouseType, setWarehouseType] = useState<"" | "local" | "regional" | "international">("")
  const [processingTime, setProcessingTime] = useState("1")
  const [deliveryMin, setDeliveryMin] = useState("2")
  const [deliveryMax, setDeliveryMax] = useState("5")
  const [shippingCost, setShippingCost] = useState("0")
  const [shipsFrom, setShipsFrom] = useState("")
  const [deliveryDays, setDeliveryDays] = useState("")
  const [freeShipping, setFreeShipping] = useState(false)
  const [isLuxury, setIsLuxury] = useState(false)
  const [supplierTag, setSupplierTag] = useState("")
  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttrRow[]>([])
  const [specValues, setSpecValues] = useState<Record<string, string>>({})
  const [specFormErrors, setSpecFormErrors] = useState<string[]>([])
  const [publishBlockers, setPublishBlockers] = useState<PublishBlocker[]>([])
  const [attrsLoading, setAttrsLoading] = useState(false)
  const mergedCategoryAttrs = useMemo(() => mergeCoreCategoryAttrs(categoryAttrs), [categoryAttrs])

  const commissionMax = affiliateCommissionMaxPct(listingKind)

  useEffect(() => {
    if (variantFormMode !== "simple") return
    setSimpleColorRows((rows) =>
      rows.length === 0 ? [{ id: newVariantRowId(), name: "", image: "" }] : rows
    )
  }, [variantFormMode, simpleColorRows.length])

  const simpleColorsSyncKey = useMemo(() => {
    const names = extractOrderedColorNames(simpleColorRows)
    return `${names.join("\u0001")}|\u0002|${variantSizesText.trim()}`
  }, [simpleColorRows, variantSizesText])

  useEffect(() => {
    if (extractOrderedColorNames(simpleColorRows).length === 0) return

    setVariantRows((prev) =>
      applySimpleColorsToVariantRowsIfChanged(prev, {
        simpleColorRows,
        sizesText: variantSizesText,
        defaultRow: () => defaultVariantRow(commission),
      })
    )

    const labels = extractOrderedColorNames(simpleColorRows)
    setVariantColorsText((prev) => {
      const next = labels.join(", ")
      return prev === next ? prev : next
    })
  }, [simpleColorsSyncKey, commission, simpleColorRows, variantSizesText])

  const variantSkuPricingActive = usesVariantSkuPricing(variantFormMode, advancedSkuRows)

  const catalogPriceEur = useMemo(
    () =>
      effectiveSupplierCatalogPriceEur({
        variantFormMode,
        priceFieldEur: price,
        skuRows: advancedSkuRows,
      }),
    [variantFormMode, price, advancedSkuRows]
  )

  const discountPct = useMemo(() => {
    const p = catalogPriceEur ?? Number(price)
    const c = Number(compareAt)
    if (!Number.isFinite(p) || !Number.isFinite(c) || c <= p) return 0
    return Math.round(((c - p) / c) * 100)
  }, [catalogPriceEur, price, compareAt])

  const affiliateCatalogPreviewLine = useMemo(() => {
    const priceN = catalogPriceEur ?? Number(price)
    if (!Number.isFinite(priceN) || priceN <= 0) return null
    const firstSku = advancedSkuRows.find((r) => r.color.trim() && r.supplierPrice > 0)
    const comm = firstSku?.commissionRate ?? Math.round(Number(commission) || 0)
    const dd = deliveryDays.trim() ? Number(deliveryDays) : null
    return formatAffiliateCatalogPreviewLine({
      supplierPriceEur: priceN,
      commissionRate: comm,
      compareAtEur: compareAt.trim() ? Number(compareAt) : null,
      weightGrams: firstSku?.weightGrams ?? null,
      processingDays: firstSku?.processingDays ?? (dd != null && Number.isFinite(dd) ? dd : null),
      warehouseCode: firstSku?.warehouseCode ?? null,
      shipsFrom: shipsFrom.trim() || undefined,
      deliveryDays: dd,
    })
  }, [catalogPriceEur, price, commission, compareAt, advancedSkuRows, deliveryDays, shipsFrom])

  const priceError = useMemo(() => {
    if (variantSkuPricingActive) return null
    const p = Number(price)
    if (!Number.isFinite(p) || p <= 0) return "Indiquez un prix catalogue valide (EUR)."
    return null
  }, [price, variantSkuPricingActive])

  const compareError = useMemo(() => {
    if (!compareAt.trim()) return null
    const p = catalogPriceEur ?? Number(price)
    const c = Number(compareAt)
    if (!Number.isFinite(c) || c <= 0) return "Prix barré invalide."
    if (Number.isFinite(p) && p > 0 && c <= p) {
      return "Le prix barré doit être supérieur au prix catalogue."
    }
    if (discountPct > 70) return "La réduction sur prix barré ne peut pas dépasser 70 %."
    return null
  }, [compareAt, discountPct, catalogPriceEur, price])

  const unitPriceFromVolumeHint = useMemo(() => {
    const raw = specValues.item_volume_ml?.trim().replace(",", ".")
    const ml = Number(raw)
    const p = catalogPriceEur ?? Number(price)
    if (!Number.isFinite(ml) || ml <= 0 || !Number.isFinite(p) || p <= 0) return null
    const perLiter = p / (ml / 1000)
    return `${formatMoneyDisplay(perLiter)} per litre (from “Item volume” in specs ÷ your base price)`
  }, [catalogPriceEur, price, specValues.item_volume_ml])

  const commissionError = useMemo(() => {
    const hasSkuLines =
      variantFormMode === "advanced" && advancedSkuRows.some((r) => r.color.trim())
    if (commission.trim() === "" && (variantFormMode === "none" || hasSkuLines)) {
      return null
    }
    const n = Number(commission)
    if (!Number.isFinite(n)) return "Saisissez un pourcentage valide."
    if (n < 0 || n > commissionMax) {
      return listingKind === "PHYSICAL"
        ? `Produit physique : commission entre 0 % et ${commissionMax} %.`
        : `La commission doit être entre 0 % et ${commissionMax} %.`
    }
    return null
  }, [commission, commissionMax, listingKind, variantFormMode, advancedSkuRows])

  useEffect(() => {
    if (variantFormMode !== "simple") {
      setSimpleColorIssues([])
      return
    }
    setSimpleColorIssues(validateSimpleColorRows(simpleColorRows))
  }, [variantFormMode, simpleColorRows])

  const variantStockHint = useMemo(() => {
    if (variantFormMode !== "advanced") return null
    const filled = advancedSkuRows.filter((r) => r.color.trim())
    if (filled.length === 0) return null
    const sum = sumSkuTableStock(filled)
    return `Avec les lignes SKU, le stock enregistré est la somme des quantités (${sum} sur ${filled.length} ligne${filled.length > 1 ? "s" : ""}).`
  }, [variantFormMode, advancedSkuRows])

  const {
    suggestions: categorySuggestions,
    alternatives: categoryAlternativeSuggestions,
    productInsight: categoryProductInsight,
    loading: categorySuggestionsLoading,
    meta: categorySuggestMeta,
  } = useSupplierCategorySuggestions(
    debouncedName,
    description,
    debouncedCategoryBullets,
    browse,
    images[0] ?? null
  )

  const topCategorySuggestion = categorySuggestions[0] ?? null

  const applyCategory = useCallback(
    (leafId: string, path: CategoryPathSegment[], origin: CategoryPickOrigin = "manual") => {
      setCategoryId(leafId)
      setCategoryPath(path)
      setSpecValues({})
      setSpecFormErrors([])
      setCategoryAiTag(origin === "suggested")
      if (origin === "manual") {
        setCategoryManualLock(true)
        setPendingCategoryConfirm(null)
      }
    },
    []
  )

  useEffect(() => {
    dismissedCategoryFingerprintsRef.current.clear()
    lastSuggestedTitleRef.current = ""
    setCategoryManualLock(false)
    setPendingCategoryConfirm(null)
  }, [images[0], debouncedName])

  useEffect(() => {
    const suggested = categorySuggestMeta.suggestedProductName?.trim()
    if (!suggested || name.trim().length >= 5) return
    if (lastSuggestedTitleRef.current === suggested) return
    lastSuggestedTitleRef.current = suggested
    setName(suggested)
    toast.info("Nom produit suggéré depuis la photo", { description: suggested })
  }, [categorySuggestMeta.suggestedProductName, name])

  useEffect(() => {
    const title = debouncedName.trim()
    if (title.length < 5) return

    const suggestion = suggestFromTitle(title)
    const attrs = titleSuggestionAttributes(suggestion)

    void (async () => {
      if (Object.keys(attrs).length === 0) return

      const attrKey = `${title}|attrs|${JSON.stringify(attrs)}`
      if (lastTitleParserKeyRef.current === attrKey) return

      setSpecValues((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [k, v] of Object.entries(attrs)) {
          if (v && (!prev[k] || !prev[k]!.trim())) {
            next[k] = v
            changed = true
          }
        }
        return changed ? next : prev
      })
      lastTitleParserKeyRef.current = attrKey
      if (attrs.brand) toast.info(`Marque détectée : ${attrs.brand}`)
    })()
  }, [debouncedName, browse])

  useEffect(() => {
    let cancelled = false
    setLoadingBrowse(true)
    Promise.all([
      fetch("/api/categories/browse?lite=1").then((r) => r.json()),
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
        const raw = Array.isArray(j.attributes) ? (j.attributes as CategoryAttributeDto[]) : []
        setCategoryAttrs(
          raw.map((d) => ({
            id: d.id,
            key: d.key,
            label: d.label,
            type: d.type,
            unit: d.unit ?? null,
            options: d.options ?? [],
            required: d.required,
            order: d.order,
            recommended: d.recommended,
            validationRule: d.validationRule,
            dependsOnKey: d.dependsOnKey,
            dependsOnValue: d.dependsOnValue,
            helpText: d.helpText,
          }))
        )
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

  const productSpecsForDescription = useMemo(
    () =>
      mergedCategoryAttrs
        .map((a) => ({
          label: a.label,
          value: (specValues[a.key] ?? "").trim(),
        }))
        .filter((row) => row.value.length > 0),
    [mergedCategoryAttrs, specValues]
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
    lastTitleParserKeyRef.current = ""
    setName(patch.name)
    setDescription(patch.description)
    if (patch.images.length) setImages(patch.images)
    if (patch.illustrationVideos.length) {
      setDescriptionIllustrationVideos((prev) => {
        const merged = [...prev]
        for (const v of patch.illustrationVideos) {
          if (!merged.includes(v)) merged.push(v)
        }
        return merged.slice(0, 2)
      })
    }
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
    if (patch.categoryId?.trim()) setCategoryId(patch.categoryId.trim())

    const { mode, sizes, simpleColors, variantRows } = patch.variants
    setVariantFormMode(mode)
    if (mode === "advanced") {
      setVariantRows(variantRows.length ? variantRows : [defaultVariantRow(commission)])
      setAdvancedSkuRows((rows) =>
        rows.length
          ? rows
          : productVariantLinesToSkuTableRows(
              variantRows.length ? variantRows : [defaultVariantRow(commission)],
              Math.round(Number(commission) || 15),
              Number(price) > 0 ? Number(price) : 10
            )
      )
      setVariantSizesText("")
      setVariantColorsText("")
      setSimpleColorRows([])
    } else if (mode === "simple") {
      setVariantSizesText(sizes.join(", "))
      setSimpleColorRows(
        simpleColors.length > 0 ? simpleColors : [{ id: newVariantRowId(), name: "", image: "" }]
      )
      setVariantRows([])
      setVariantColorsText("")
    } else {
      setVariantSizesText("")
      setVariantRows([])
      setVariantColorsText("")
      setSimpleColorRows([])
    }
  }, [commission])

  const loadProduct = useCallback(async (id: string) => {
    if (deadServerDraftIds.includes(id)) return
    setLoadingProduct(true)
    try {
      const res = await fetch(`/api/supplier/products/${id}`, { credentials: "include" })
      const data = (await res.json()) as Record<string, unknown>
      if (res.status === 404) {
        markServerDraftDead(id)
        setPendingDraftListingId("")
        replaceProductQuery((qs) => {
          qs.delete("draft")
          qs.delete("edit")
        })
        if (composeQs) setProductIsDraft(true)
        toast.message("Brouillon introuvable — un nouveau sera créé à la prochaine sauvegarde.")
        return
      }
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to load product")
      }
      const rowSupplierId = typeof data.supplierId === "string" ? data.supplierId : ""
      if (rowSupplierId && rowSupplierId !== ownerUserId) {
        throw new Error("Ce produit n’appartient pas à votre compte fournisseur.")
      }
      setName(String(data.name ?? ""))
      setDescription(String(data.description ?? ""))
      setCategoryId(typeof data.categoryId === "string" ? data.categoryId : "")
      const overrideBps = (data as { affisellCommissionRateOverrideBps?: number | null })
        .affisellCommissionRateOverrideBps
      setLoadedAffisellOverrideBps(
        overrideBps != null && Number.isFinite(overrideBps) ? Math.round(overrideBps) : null
      )
      setAffisellCommissionOverride(
        overrideBps != null && Number.isFinite(overrideBps) ? String(overrideBps / 100) : ""
      )
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
      setIsLuxury(Boolean(data.isLuxury))
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

      const hasSkuMatrix = Boolean(data.hasVariants) && Array.isArray(data.variants) && data.variants.length > 0
      const parsedListingVariants = parseVariantsPayload(
        (data as { listingVariants?: unknown }).listingVariants ?? data.variants
      )

      if (hasSkuMatrix) {
        const apiRows = data.variants as Array<{
          id: string
          color: string | null
          size: string | null
          sku: string | null
          supplierPrice: number
          publicPrice: number
          stock: number
          commissionRate?: number
          customData?: Record<string, string | number | boolean> | null
        }>
        const dbCols = parseCustomColumnsFromDb(
          (data as { customColumns?: unknown }).customColumns
        )
        const legacyCols = legacySkuCustomColumnsToDefinitions(
          parsedListingVariants?.skuCustomColumns
        )
        setVariantFormMode("advanced")
        const mirrorById = new Map(
          (parsedListingVariants?.variantRows ?? []).map((line) => [line.id, line])
        )
        setAdvancedSkuRows(
          apiRows.map((row) => {
            const sku = skuTableRowFromApiVariant(row)
            const mirror = mirrorById.get(row.id)
            if (mirror && Number(mirror.commission) > 0) {
              return { ...sku, commissionRate: Math.round(mirror.commission) }
            }
            return sku
          })
        )
        setSkuCustomColumns(
          mergeCustomColumnDefinitions(dbCols, legacyCols).map((c) => ({
            ...c,
            id: newVariantRowId(),
          }))
        )
        setSkuHiddenColumns([])
        setVariantRows([])
        setVariantSizesText("")
        setVariantColorsText("")
        setSimpleColorRows([])
      } else if (parsedListingVariants?.variantRows?.length) {
        setVariantFormMode("advanced")
        const sup = Number.isFinite(cents) ? cents / 100 : 10
        setAdvancedSkuRows(
          productVariantLinesToSkuTableRows(
            parsedListingVariants.variantRows,
            Math.round(Number(data.commissionRate) || 15),
            sup > 0 ? sup : 10
          )
        )
        setVariantRows(parsedListingVariants.variantRows)
        setSkuCustomColumns(
          legacySkuCustomColumnsToDefinitions(parsedListingVariants.skuCustomColumns).map(
            (c) => ({ ...c, id: newVariantRowId() })
          )
        )
        setSkuHiddenColumns(parseSkuHiddenColumns(parsedListingVariants.skuHiddenColumns))
        setVariantSizesText(
          parsedListingVariants.size?.length ? parsedListingVariants.size.join(", ") : ""
        )
        setVariantColorsText(colorList.join(", "))
        setSimpleColorRows([])
      } else if (parsedListingVariants?.size?.length) {
        setVariantFormMode("simple")
        setVariantSizesText(parsedListingVariants.size.join(", "))
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
      const illRaw = data.descriptionIllustrationImages
      if (Array.isArray(illRaw)) {
        setDescriptionIllustrationImages(
          illRaw
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4)
        )
      } else {
        setDescriptionIllustrationImages([])
      }
      const vidRaw = data.descriptionIllustrationVideos
      if (Array.isArray(vidRaw)) {
        setDescriptionIllustrationVideos(
          vidRaw
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 2)
        )
      } else {
        setDescriptionIllustrationVideos([])
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
      setCategoryAiTag(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load product")
      replaceProductQuery((qs) => {
        qs.delete("draft")
        qs.delete("edit")
      })
    } finally {
      setLoadingProduct(false)
    }
  }, [composeQs, deadServerDraftIds, markServerDraftDead, ownerUserId, replaceProductQuery])

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

      let priceN =
        effectiveSupplierCatalogPriceEur({
          variantFormMode,
          priceFieldEur: price,
          skuRows: advancedSkuRows,
        }) ?? Number(price)
      if (draftPriceFallback && (!Number.isFinite(priceN) || priceN <= 0)) {
        priceN = 1
      }

      const simpleSizes = parseCsvOptions(variantSizesText)
      let listingVariantsPayload: Record<string, unknown> | null = null
      let colorsPayload: string[] = []
      let colorImagesPayload: Array<{ color: string; image: string }> | undefined = undefined
      let hasVariantsPayload = false
      let skuVariantsPayload: ReturnType<typeof apiRowsFromSkuTable> | undefined = undefined

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
          listingVariantsPayload = { size: simpleSizes }
        }
        hasVariantsPayload = false
        colorImagesPayload =
          colorsPayload.length > 0
            ? colorsPayload.map((c) => ({
                color: c.slice(0, 48),
                image: trimColorSwatchImageForStore(imgBy.get(c) ?? ""),
              }))
            : undefined
      } else if (variantFormMode === "advanced") {
        const baseSupplier = priceN > 0 ? priceN : 10
        const comm = Math.round(Number(commission) || 15)
        const filledSku = advancedSkuRows.filter((r) => r.color.trim())
        colorsPayload = [
          ...new Set(filledSku.map((r) => r.color.trim()).filter(Boolean)),
        ].slice(0, 40)
        const sizes = [
          ...new Set(
            filledSku.map((r) => r.size?.trim()).filter((s): s is string => Boolean(s))
          ),
        ].slice(0, 40)

        if (filledSku.length > 0) {
          hasVariantsPayload = true
          skuVariantsPayload = apiRowsFromSkuTable(filledSku, {
            baseSupplierPrice: baseSupplier,
            defaultCommission: comm,
          })
          const minSupplierFromRows = Math.min(
            ...filledSku.map((r) => r.supplierPrice).filter((p) => p > 0)
          )
          if (Number.isFinite(minSupplierFromRows) && minSupplierFromRows > 0) {
            priceN = minSupplierFromRows
          }
          const mirrorLines = skuTableRowsToProductVariantLines(
            filledSku,
            Math.max(100, Math.round(priceN * 100))
          )
          listingVariantsPayload = {
            ...(sizes.length > 0 ? { size: sizes } : {}),
            skuCustomColumns: skuCustomColumns.map((c) => ({ key: c.key, label: c.label })),
            ...(skuHiddenColumns.length > 0 ? { skuHiddenColumns } : {}),
            variantRows: mirrorLines,
          }
        }

        const imgByColor = colorImageByName(filledSku)
        colorImagesPayload =
          colorsPayload.length > 0
            ? colorsPayload.map((color) => ({
                color: color.slice(0, 48),
                image: trimColorSwatchImageForStore(imgByColor.get(color.toLowerCase()) ?? ""),
              }))
            : undefined
      }

      let stockOut = Math.max(0, Math.round(Number(stock) || 0))
      if (variantFormMode === "advanced" && advancedSkuRows.some((r) => r.color.trim())) {
        stockOut = sumSkuTableStock(advancedSkuRows.filter((r) => r.color.trim()))
      }

      return {
        name: name.trim(),
        description: description.trim(),
        price: priceN,
        compareAt: compareAt.trim() ? Number(compareAt) : null,
        stock: stockOut,
        commission: (() => {
          if (variantFormMode === "advanced") {
            const filled = advancedSkuRows.filter((r) => r.color.trim())
            if (filled.length > 0) {
              const rates = filled.map((r) => r.commissionRate)
              if (commission.trim() !== "" && Number.isFinite(Number(commission))) {
                rates.push(Number(commission))
              }
              return maxAffiliateCommissionRatePct(rates)
            }
          }
          const n = Number(commission)
          return Number.isFinite(n) ? Math.round(n) : 0
        })(),
        listingKind,
        images,
        categoryId: categoryId.trim(),
        affisellCommissionRateOverridePercent:
          affisellCommissionOverride.trim() === ""
            ? null
            : Number(affisellCommissionOverride),
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
        isLuxury,
        supplierTag: supplierTag.trim() || undefined,
        descriptionBullets: descriptionBullets.map((s) => s.trim()).filter(Boolean),
        descriptionIllustrationImages,
        descriptionIllustrationVideos,
        colors: colorsPayload,
        ...(listingVariantsPayload ? { listingVariants: listingVariantsPayload } : {}),
        ...(variantFormMode === "advanced" && hasVariantsPayload && skuVariantsPayload
          ? { hasVariants: true, variants: skuVariantsPayload }
          : variantFormMode !== "none"
            ? { hasVariants: false }
            : {}),
        ...(skuCustomColumns.length > 0
          ? {
              customColumns: skuCustomColumns.map((c) => ({
                key: c.key,
                label: c.label,
                type: c.type,
                required: c.required,
                ...(c.options?.length ? { options: c.options } : {}),
              })),
            }
          : {}),
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
      affisellCommissionOverride,
      shippingCountry,
      warehouseType,
      processingTime,
      deliveryMin,
      deliveryMax,
      shippingCost,
      shipsFrom,
      deliveryDays,
      freeShipping,
      isLuxury,
      supplierTag,
      descriptionBullets,
      descriptionIllustrationImages,
      descriptionIllustrationVideos,
      variantFormMode,
      variantSizesText,
      variantColorsText,
      simpleColorRows,
      variantRows,
      advancedSkuRows,
      skuCustomColumns,
    ]
  )

  useEffect(() => {
    if (urlListingId || pendingDraftListingId || hydratedFromCache.current || loadingBrowse) return
    const c = readSupplierAddProductDraftCache(cacheMode, ownerUserId)
    hydratedFromCache.current = true
    if (!c) return
    if (Date.now() - c.updatedAt > 14 * 24 * 60 * 60 * 1000) return
    trySetStep((Math.min(3, Math.max(1, c.step ?? 1)) as WizardStep) || 1)
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
    setIsLuxury(Boolean(c.isLuxury))
    setSupplierTag(c.supplierTag)
    setSpecValues(c.specValues)
    setDescriptionBullets(c.descriptionBullets?.length ? c.descriptionBullets : [""])
    setDescriptionIllustrationImages(
      Array.isArray(c.descriptionIllustrationImages)
        ? c.descriptionIllustrationImages.filter((x): x is string => typeof x === "string").slice(0, 4)
        : []
    )
    setDescriptionIllustrationVideos(
      Array.isArray(c.descriptionIllustrationVideos)
        ? c.descriptionIllustrationVideos.filter((x): x is string => typeof x === "string").slice(0, 2)
        : []
    )
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
  }, [urlListingId, pendingDraftListingId, loadingBrowse, cacheMode, ownerUserId])

  const canSaveDraft = !editId || productIsDraft

  /** Compose / draft flows autosave without required fields (empty → "Untitled draft"). */
  const draftAutosaveEnabled =
    canSaveDraft && (composeQs || productIsDraft || Boolean(autosaveListingId) || assistShortcuts)

  const buildDraftSyncBody = useCallback(
    (forStep: WizardStep) => {
      const full = assembleListingPayload(true) as Record<string, unknown>
      return forStep === 1 ? omitVariantSnapshotForDraftStep1(full, 1) : full
    },
    [assembleListingPayload]
  )

  const syncDraftToServer = useCallback(
    async (opts?: { silent?: boolean; force?: boolean; stepOverride?: WizardStep }) => {
      if (!canSaveDraft || loadingProduct || saving) return false

      const syncStep = opts?.stepOverride ?? step
      const body = buildDraftSyncBody(syncStep)
      const fp = JSON.stringify(body) + `|step:${syncStep}`
      if (!opts?.force && fp === lastAutosaveJson.current) {
        if (!opts?.silent) toast.success("Brouillon déjà à jour")
        return true
      }

      setDraftSync("saving")
      try {
        const saveViaPost = async () => {
          const res = await fetch("/api/supplier/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ...body, saveAsDraft: true }),
          })
          const json = (await res.json()) as { id?: string; error?: string }
          if (!res.ok) {
            throw new Error(typeof json.error === "string" ? json.error : "Échec de l'enregistrement")
          }
          if (json.id) {
            setPendingDraftListingId(json.id)
            setProductIsDraft(true)
            replaceProductQuery((qs) => {
              qs.set("draft", json.id!)
              if (!qs.has("compose")) qs.set("compose", "1")
            })
          }
        }

        if (autosaveListingId) {
          const res = await fetch(`/api/supplier/products/${autosaveListingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          })
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          if (res.status === 404) {
            markServerDraftDead(autosaveListingId)
            setPendingDraftListingId("")
            lastAutosaveJson.current = ""
            replaceProductQuery((qs) => {
              qs.delete("draft")
              qs.delete("edit")
            })
            await saveViaPost()
          } else if (!res.ok) {
            throw new Error(typeof json.error === "string" ? json.error : "Échec de l'enregistrement")
          }
        } else {
          await saveViaPost()
        }

        lastAutosaveJson.current = fp
        setDraftSync("saved")
        setDraftSyncAt(Date.now())
        if (!productIsDraft) setProductIsDraft(true)
        if (!opts?.silent) toast.success("Brouillon sauvegardé")
        return true
      } catch (e) {
        setDraftSync("error")
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : "Impossible d'enregistrer le brouillon")
        }
        return false
      }
    },
    [
      autosaveListingId,
      buildDraftSyncBody,
      canSaveDraft,
      loadingProduct,
      markServerDraftDead,
      pathname,
      productIsDraft,
      replaceProductQuery,
      router,
      saving,
      searchParams,
      step,
    ]
  )

  const autosaveFingerprint = useMemo(
    () => JSON.stringify(buildDraftSyncBody(step)) + String(step),
    [buildDraftSyncBody, step]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    if (loadingProduct || saving || !draftAutosaveEnabled) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        await syncDraftToServer({ silent: true })
      })()
    }, 2200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    autosaveFingerprint,
    draftAutosaveEnabled,
    loadingProduct,
    saving,
    syncDraftToServer,
  ])

  useEffect(() => {
    if (!draftAutosaveEnabled) return
    const unregister = registerMerchantDraftFlush("supplier-add-product", () => {
      void syncDraftToServer({ silent: true, force: true })
    })
    return () => {
      void syncDraftToServer({ silent: true, force: true })
      unregister()
    }
  }, [draftAutosaveEnabled, syncDraftToServer])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (editId && !productIsDraft) return
    if (!(name.trim() || description.trim() || categoryId.trim() || images.length > 0 || descriptionIllustrationImages.length > 0 || descriptionIllustrationVideos.length > 0)) return
    const t = window.setTimeout(() => {
      writeSupplierAddProductDraftCache(ownerUserId, {
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
        isLuxury,
        supplierTag,
        specValues,
        descriptionBullets,
        descriptionIllustrationImages,
        descriptionIllustrationVideos,
        variantFormMode,
        variantSizesText,
        variantColorsText,
        simpleColorRows,
        variantRows,
      })
    }, 720)
    return () => window.clearTimeout(t)
  }, [
    ownerUserId,
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
    descriptionIllustrationImages,
    descriptionIllustrationVideos,
    editId,
    freeShipping,
    isLuxury,
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
            descriptionIllustrationImages.length ||
            descriptionIllustrationVideos.length ||
            autosaveListingId
        ))
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [autosaveListingId, categoryId, description, descriptionIllustrationImages.length, descriptionIllustrationVideos.length, editId, images.length, name, productIsDraft])

  async function handleSubmit() {
    if (variantFormMode === "simple" && simpleColorIssues.length > 0) {
      applyPublishBlockers([
        {
          field: "variants",
          message: `${simpleColorIssues.length} erreur${simpleColorIssues.length > 1 ? "s" : ""} sur les noms de couleur.`,
        },
      ])
      toast.error(
        `${simpleColorIssues.length} erreur${simpleColorIssues.length > 1 ? "s" : ""} sur les couleurs — corrigez les lignes encadrées.`
      )
      return
    }

    if (variantFormMode === "advanced" && skuValidationIssues.length > 0) {
      applyPublishBlockers([
        {
          field: "variants",
          message: `${skuValidationIssues.length} erreur${skuValidationIssues.length > 1 ? "s" : ""} à corriger dans le tableau SKU.`,
        },
      ])
      toast.error(
        `${skuValidationIssues.length} erreur${skuValidationIssues.length > 1 ? "s" : ""} à corriger dans le tableau SKU.`
      )
      return
    }

    const clientBlockers = collectClientPublishBlockers(publishValidationContext)
    if (clientBlockers.length > 0) {
      applyPublishBlockers(clientBlockers)
      return
    }
    setPublishBlockers([])
    setSpecFormErrors([])

    const payload = assembleListingPayload(false)
    const serverId = autosaveListingId

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
      const json = (await res.json()) as { error?: string; id?: string; errors?: string[] }
      if (!res.ok) {
        const serverBlockers = mapServerPublishBlockers(
          json as { error?: string; errors?: string[]; issues?: unknown }
        )
        if (serverBlockers.length > 0) {
          applyPublishBlockers(serverBlockers)
          return
        }
        applyPublishBlockers([
          { field: "specs", message: json.error ?? "Publication impossible. Vérifiez le formulaire." },
        ])
        return
      }
      setPublishBlockers([])
      setSpecFormErrors([])
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
      clearSupplierAddProductDraftCache(ownerUserId)
      lastAutosaveJson.current = ""
      toast.success(
        serverId && !productIsDraft ? "Product updated." : "Product published to your catalog."
      )
      router.push("/dashboard/supplier/products")
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publication impossible"
      applyPublishBlockers([{ field: "specs", message: msg }])
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
      price: variantSkuPricingActive
        ? minSupplierPriceEurFromSkuRows(advancedSkuRows) != null
        : Number(price) > 0 && !priceError,
    }),
    [name, categoryId, specMissing, images.length, price, priceError]
  )

  const hasVariants = variantFormMode !== "none"

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const handleSaveDraftClick = useCallback(() => {
    void syncDraftToServer({ force: true, stepOverride: step })
  }, [syncDraftToServer, step])

  const publishErrorFields = useMemo(() => uniqueBlockerFields(publishBlockers), [publishBlockers])

  const hasPublishFieldError = useCallback(
    (field: PublishFieldKey) => publishErrorFields.includes(field),
    [publishErrorFields]
  )

  const clearPublishFieldError = useCallback((field: PublishFieldKey) => {
    setPublishBlockers((prev) => prev.filter((b) => b.field !== field))
  }, [])

  useEffect(() => {
    if (categoryManualLock || !browse || categorySuggestionsLoading) return

    const leafId =
      categorySuggestMeta.recommendedLeafId &&
      categorySuggestions.some((s) => s.leafId === categorySuggestMeta.recommendedLeafId)
        ? categorySuggestMeta.recommendedLeafId
        : topCategorySuggestion?.leafId ?? null

    const pick =
      categorySuggestions.find((s) => s.leafId === leafId) ?? topCategorySuggestion

    if (!pick?.leafId) {
      setPendingCategoryConfirm(null)
      return
    }

    const confirmOk =
      categorySuggestMeta.autoApplyRecommended ||
      shouldSuggestCategoryConfirmation({
        confidence: pick.confidence ?? 0,
        suggestionSource: pick.suggestionSource,
        hasImage: Boolean(images[0]?.trim()),
      })

    if (!confirmOk) {
      setPendingCategoryConfirm(null)
      return
    }
    if (categoryId === pick.leafId) {
      setPendingCategoryConfirm(null)
      return
    }

    const fingerprint = `${images[0] ?? ""}|${debouncedName}|${pick.leafId}`
    if (dismissedCategoryFingerprintsRef.current.has(fingerprint)) return

    setPendingCategoryConfirm((prev) => {
      if (prev?.fingerprint === fingerprint) return prev
      return {
        leafId: pick.leafId,
        breadcrumb: pick.breadcrumb,
        confidence: pick.confidence ?? 0,
        reason: pick.aiReason ?? null,
        fingerprint,
      }
    })
  }, [
    browse,
    categoryId,
    categoryManualLock,
    categorySuggestMeta.autoApplyRecommended,
    categorySuggestMeta.recommendedLeafId,
    categorySuggestions,
    categorySuggestionsLoading,
    debouncedName,
    images,
    topCategorySuggestion,
  ])

  const confirmPendingCategory = useCallback(() => {
    if (!pendingCategoryConfirm || !browse) return
    const path = pathFromLeafId(pendingCategoryConfirm.leafId, browse.nodes)
    if (!path?.length) return
    applyCategory(pendingCategoryConfirm.leafId, path, "suggested")
    clearPublishFieldError("category")
    setPendingCategoryConfirm(null)
    toast.success("Catégorie confirmée", {
      description: pendingCategoryConfirm.breadcrumb,
    })
  }, [applyCategory, browse, clearPublishFieldError, pendingCategoryConfirm])

  const dismissPendingCategory = useCallback(() => {
    if (pendingCategoryConfirm) {
      dismissedCategoryFingerprintsRef.current.add(pendingCategoryConfirm.fingerprint)
    }
    setPendingCategoryConfirm(null)
    setCategoryManualLock(true)
  }, [pendingCategoryConfirm])

  const applyPublishBlockers = useCallback(
    (blockers: PublishBlocker[]) => {
      if (blockers.length === 0) return

      setPublishBlockers(blockers)
      const specMsgs = blockers.filter((b) => b.field === "specs").map((b) => b.message)
      setSpecFormErrors(specMsgs.length > 0 ? specMsgs : [])

      const first = blockers[0]!
      const targetStep = publishBlockerStep(first.field)
      if (step !== targetStep) trySetStep(targetStep)

      window.setTimeout(() => {
        document
          .getElementById(PUBLISH_FIELD_SCROLL_ID[first.field])
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      }, targetStep !== step ? 120 : 0)

      toast.error(
        blockers.length === 1
          ? blockers[0]!.message
          : `Publication impossible : ${blockers.length} point${blockers.length > 1 ? "s" : ""} à corriger (zones encadrées en rouge).`
      )
    },
    [step, trySetStep]
  )

  const step1Complete = useMemo(
    () =>
      step1Checklist.title &&
      step1Checklist.category &&
      step1Checklist.specs &&
      step1Checklist.images,
    [step1Checklist]
  )

  const step2Complete = useMemo(() => {
    const priceOk = variantSkuPricingActive
      ? minSupplierPriceEurFromSkuRows(advancedSkuRows) != null && !compareError
      : Number(price) > 0 && !priceError && !compareError
    const skuOk =
      skuValidationIssues.length === 0 &&
      (variantFormMode !== "simple" || simpleColorIssues.length === 0)
    return priceOk && skuOk
  }, [
    variantSkuPricingActive,
    advancedSkuRows,
    price,
    priceError,
    compareError,
    skuValidationIssues.length,
    variantFormMode,
    simpleColorIssues.length,
  ])

  useEffect(() => {
    setStep1Valid(step1Complete)
  }, [step1Complete, setStep1Valid])

  useEffect(() => {
    setStep2Valid(step2Complete)
  }, [step2Complete, setStep2Valid])

  useEffect(() => {
    setSkuErrors(skuValidationIssues)
  }, [skuValidationIssues, setSkuErrors])

  const wizardQualityItems: WizardQualityItem[] = useMemo(
    () => [
      { id: "title", label: "Titre", done: step1Checklist.title, anchorId: "p-name" },
      {
        id: "category",
        label: "Catégorie",
        done: step1Checklist.category,
        anchorId: "add-product-classify",
      },
      { id: "specs", label: "Specs", done: step1Checklist.specs, anchorId: "product-spec-fields" },
      { id: "photos", label: "Photos", done: step1Checklist.images, anchorId: "add-product-express" },
      {
        id: "price",
        label: "Prix",
        done: variantSkuPricingActive
          ? minSupplierPriceEurFromSkuRows(advancedSkuRows) != null
          : Number(price) > 0 && !priceError,
        anchorId: "add-product-pricing",
      },
    ],
    [step1Checklist, variantSkuPricingActive, advancedSkuRows, price, priceError]
  )

  const simulationSupplierPrice = useMemo(() => catalogPriceEur ?? 0, [catalogPriceEur])

  const simulationCommission = useMemo(() => {
    if (variantFormMode === "advanced") {
      const filled = advancedSkuRows.filter((r) => r.color.trim())
      if (filled.length > 0) {
        return maxAffiliateCommissionRatePct(filled.map((r) => r.commissionRate))
      }
    }
    const n = Number(commission)
    return Number.isFinite(n) ? Math.round(n) : 0
  }, [variantFormMode, advancedSkuRows, commission])

  const simulationCard = (
    <SupplierSimulationCard
      supplierPriceEur={simulationSupplierPrice}
      commissionPct={simulationCommission}
      compareAtEur={compareAt.trim() ? Number(compareAt) : null}
      shipsFrom={shipsFrom.trim() || undefined}
      deliveryDays={
        deliveryDays.trim() && Number.isFinite(Number(deliveryDays))
          ? Math.round(Number(deliveryDays))
          : null
      }
      warehouseCode={warehouseType || shippingCountry.trim() || null}
      processingDays={
        processingTime.trim() && Number.isFinite(Number(processingTime))
          ? Math.round(Number(processingTime))
          : null
      }
      shippingCostEur={Number(shippingCost) || 0}
      freeShipping={freeShipping}
      className="lg:top-24 lg:sticky"
    />
  )

  const publishValidationContext: Parameters<typeof collectClientPublishBlockers>[0] = {
    name,
    imagesCount: images.length,
    categoryId,
    missingSpecs: specMissing,
    priceError,
    compareError,
    commissionError,
    variantFormMode,
    variantRows,
    advancedSkuRows,
    simpleColorRows,
  }

  const jumpBtnClass =
    "rounded-xl border border-gray-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur-sm transition hover:border-violet-300/80 hover:bg-violet-50/90 hover:text-violet-900 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-violet-600/50 dark:hover:bg-violet-950/40 dark:hover:text-violet-100"

  if (loadingProduct) {
    return (
      <BentoShell>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-3xl border border-violet-200/50 bg-white/80 p-10 shadow-sm shadow-violet-500/5 ring-1 ring-black/[0.03] backdrop-blur-md dark:border-violet-900/35 dark:bg-zinc-950/70 dark:ring-white/10"
            aria-busy
            aria-label="Loading listing"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-35 dark:opacity-[0.16]"
              style={{
                backgroundImage: `
                radial-gradient(ellipse 80% 55% at 15% -10%, rgba(139,92,246,0.2), transparent 50%),
                radial-gradient(ellipse 60% 45% at 92% 8%, rgba(20,184,166,0.12), transparent 45%)
              `,
              }}
              aria-hidden
            />
            <div className="relative flex min-h-[32vh] flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-2xl bg-violet-400/25" aria-hidden />
                <Loader2 className="relative h-10 w-10 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
              </div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{tForm("loadingListing")}</p>
            </div>
          </div>
        </div>
      </BentoShell>
    )
  }

  return (
    <>
      <BentoShell>
        <ProductWizard
          breadcrumb={[
            { label: tForm("breadcrumbCatalog"), href: "/dashboard/supplier/products" },
            {
              label: editId
                ? productIsDraft
                  ? tForm("breadcrumbDraft")
                  : tForm("breadcrumbEdit")
                : tForm("breadcrumbNew"),
            },
          ]}
          onSaveDraft={canSaveDraft ? () => void handleSaveDraftClick() : undefined}
          savingDraft={draftSync === "saving" || saving}
          onBack={onBackToMethods}
          qualityPanel={<SupplierWizardQualityPanel items={wizardQualityItems} />}
        >
          <div className="space-y-10">

            {publishBlockers.length > 0 ? (
              <div
                role="alert"
                className="rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3.5 text-red-950 shadow-sm dark:border-red-700/80 dark:bg-red-950/40 dark:text-red-100"
              >
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-semibold">{tForm("publishBlockedTitle")}</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed">
                      {publishBlockers.map((b, i) => (
                        <li key={`${b.field}-${i}`}>{b.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
            {step === 1 ? (
              <>
                <div className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white/75 px-4 py-3.5 shadow-sm ring-1 ring-black/[0.02] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60 dark:ring-white/[0.04] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    {tForm("onThisPage")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {assistShortcuts ? (
                      <button
                        type="button"
                        className={jumpBtnClass}
                        onClick={() => scrollToSection("add-product-shortcuts")}
                      >
                        {tForm("jumpShortcuts")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={jumpBtnClass}
                      onClick={() => scrollToSection("add-product-express")}
                    >
                      Scan IA
                    </button>
                    <button
                      type="button"
                      className={jumpBtnClass}
                      onClick={() => scrollToSection("add-product-story")}
                    >
                      {tForm("jumpStory")}
                    </button>
                    <button
                      type="button"
                      className={jumpBtnClass}
                      onClick={() => scrollToSection("add-product-classify")}
                    >
                      Category & specs
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
                      <SupplierAiImportAgent
                        categoryAttrs={mergedCategoryAttrs}
                        commissionPct={commission}
                        onApply={handleUrlImportApply}
                      />
                      <SupplierUrlImportPanel
                        categoryAttrs={mergedCategoryAttrs}
                        commissionPct={commission}
                        onApply={handleUrlImportApply}
                      />
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

                <SectionCard
                  id="add-product-express"
                  icon={ScanLine}
                  variant="accent"
                  title="Scan IA — Photo & catégorie"
                  description="Ajoutez d’abord la photo principale et le nom : l’arbre Affisell se remplit tout seul."
                  hasError={hasPublishFieldError("images") || hasPublishFieldError("name")}
                >
                  <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                    <div id="add-product-media">
                      <Label className="text-zinc-900 dark:text-zinc-100">
                        <span className="text-red-600">*</span> Photo principale
                      </Label>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        La vision IA lit cette image pour classer le produit.
                      </p>
                      {hasPublishFieldError("images") ? (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {publishBlockers.find((b) => b.field === "images")?.message}
                        </p>
                      ) : null}
                      <div className="mt-3">
                        <SupplierProductImageUpload
                          initialUrls={images}
                          onImagesChange={(urls) => {
                            setImages(urls)
                            if (urls.length > 0) clearPublishFieldError("images")
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <SupplierExpressTaxonomyRail
                        name={name}
                        imageUrl={images[0] ?? null}
                        categoryPath={categoryPath}
                        categoryId={categoryId}
                        categoryAiTag={categoryAiTag}
                        loading={categorySuggestionsLoading}
                        meta={categorySuggestMeta}
                        topSuggestion={topCategorySuggestion}
                        productInsight={categoryProductInsight}
                        pendingConfirm={pendingCategoryConfirm}
                        onConfirmPending={confirmPendingCategory}
                        onDismissPending={dismissPendingCategory}
                      />
                    </div>
                  </div>
                </SectionCard>

                <div className="grid gap-8 xl:grid-cols-12 xl:gap-x-10 xl:items-start">
                  <div className="space-y-8 xl:col-span-5">
                    <SectionCard
                      id="add-product-story"
                      icon={Package}
                      title="Product story"
                      description="Nom optimisé et description pour les affiliés et votre boutique."
                      hasError={hasPublishFieldError("name")}
                    >
                      <SupplierTitleOptimizer
                        title={name}
                        onTitleChange={(v) => {
                          setName(v)
                          clearPublishFieldError("name")
                        }}
                        description={description}
                        descriptionBullets={descriptionBullets}
                        categoryPathLabel={categoryPathLabel}
                        productGalleryImages={images}
                        onBulletsGenerated={(bullets) =>
                          setDescriptionBullets(bulletsForAiCopy(bullets))
                        }
                        hasError={hasPublishFieldError("name")}
                        errorMessage={publishBlockers.find((b) => b.field === "name")?.message}
                      />
                      <SupplierProductDescriptionField
                        description={description}
                        onDescriptionChange={setDescription}
                        illustrationImages={descriptionIllustrationImages}
                        onIllustrationImagesChange={setDescriptionIllustrationImages}
                        illustrationVideos={descriptionIllustrationVideos}
                        onIllustrationVideosChange={setDescriptionIllustrationVideos}
                        productTitle={name}
                        productGalleryImages={images}
                        descriptionBullets={descriptionBullets}
                        onBulletPointsGenerated={(bullets) =>
                          setDescriptionBullets(bulletsForAiCopy(bullets))
                        }
                        categoryPathLabel={categoryPathLabel}
                        productSpecs={productSpecsForDescription}
                      />
                      <div>
                        <Label className="text-zinc-800 dark:text-zinc-100">Key features</Label>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Up to five selling points shoppers see first on the product page (like marketplace “About
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
                      description="Choisissez la catégorie feuille via les suggestions IA, la recherche ou l’arbre catalogue Affisell."
                      hasError={hasPublishFieldError("category") || hasPublishFieldError("specs")}
                    >
                      <div>
                        <Label className="inline-flex items-center gap-2">
                          <span>
                            Catégorie <span className="text-red-600">*</span>
                          </span>
                          {categoryAiTag ? (
                            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              IA
                            </span>
                          ) : null}
                        </Label>
                        <div
                          className={cn(
                            "mt-1.5 rounded-xl",
                            hasPublishFieldError("category") && "ring-2 ring-red-500/40"
                          )}
                        >
                          <SupplierCategoryPicker
                            browse={browse}
                            recent={recentCategories}
                            value={categoryId}
                            onChange={(leafId, path, origin) => {
                              applyCategory(leafId, path, origin)
                              clearPublishFieldError("category")
                            }}
                            suggestions={categorySuggestions}
                            alternativeSuggestions={categoryAlternativeSuggestions}
                            productInsight={categoryProductInsight}
                            suggestionsLoading={categorySuggestionsLoading}
                            loading={loadingBrowse}
                          />
                        </div>
                      </div>
                      <SupplierAffisellCommissionField
                        categoryId={categoryId}
                        value={affisellCommissionOverride}
                        onChange={setAffisellCommissionOverride}
                        productOverrideBps={loadedAffisellOverrideBps}
                      />
                      <div
                        id="product-spec-fields"
                        className={cn(
                          "rounded-xl border bg-zinc-50/40 p-1 dark:bg-zinc-900/30",
                          hasPublishFieldError("specs")
                            ? "border-red-400 ring-2 ring-red-500/40 dark:border-red-600"
                            : "border-zinc-100 dark:border-zinc-800"
                        )}
                      >
                        <DynamicAttributes
                          categoryId={categoryId}
                          values={specValues}
                          errors={specFormErrors}
                          onChange={(next) => {
                            setSpecValues(next)
                            if (specFormErrors.length > 0) setSpecFormErrors([])
                            clearPublishFieldError("specs")
                          }}
                        />
                      </div>
                    </SectionCard>
                  </div>

                  {editId ? (
                    <div className="space-y-8 xl:col-span-12">
                      <SectionCard
                        id="add-product-media-extra"
                        icon={ImageIcon}
                        title="Vidéo produit"
                        description="Optionnel — vidéo attachée au listing."
                      >
                        <AttachProductVideoActions
                          productId={editId}
                          onAttached={(result) => {
                            setDescriptionIllustrationVideos(result.descriptionIllustrationVideos)
                          }}
                        />
                      </SectionCard>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full shrink-0 bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 sm:w-auto"
                    onClick={() => {
                      const step1Blockers = collectClientPublishBlockers({
                        ...publishValidationContext,
                        priceError: null,
                        compareError: null,
                        commissionError: null,
                      })
                      if (step1Blockers.length > 0) {
                        applyPublishBlockers(step1Blockers)
                        return
                      }
                      setPublishBlockers([])
                      setSpecFormErrors([])
                      nextWizardStep()
                    }}
                  >
                    Continuer — variantes & prix
                  </Button>
                </div>
              </>
            ) : step === 2 ? (
              <>
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(220px,30%)] lg:items-start">
                  <div className="min-w-0 space-y-8">
                <SectionCard
                  id="add-product-pricing"
                  icon={Wallet}
                  title="Prix & stock"
                  description="Votre prix catalogue, stock et prix barré optionnel. Les affiliés fixent le prix client ; vous définissez la commission sur leur marge."
                  hasError={hasPublishFieldError("price") || hasPublishFieldError("compareAt")}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="p-price">
                        {variantSkuPricingActive
                          ? "Prix catalogue affiché (EUR)"
                          : "Votre prix (EUR)"}
                      </Label>
                      <Input
                        id="p-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        readOnly={variantSkuPricingActive}
                        className={cn(
                          "mt-1.5 h-11",
                          variantSkuPricingActive && "bg-zinc-50 text-zinc-800 dark:bg-zinc-900/80",
                          (priceError || hasPublishFieldError("price")) && PUBLISH_INPUT_ERROR_CLASS
                        )}
                        value={
                          variantSkuPricingActive
                            ? catalogPriceEur != null
                              ? catalogPriceEur.toFixed(2)
                              : ""
                            : price
                        }
                        onChange={(e) => {
                          if (variantSkuPricingActive) return
                          setPrice(e.target.value)
                          clearPublishFieldError("price")
                        }}
                        aria-invalid={Boolean(priceError || hasPublishFieldError("price"))}
                      />
                      {variantSkuPricingActive ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Prix le plus bas parmi vos variantes (tableau ci-dessous). Saisissez le prix sur
                          chaque ligne SKU.
                        </p>
                      ) : null}
                      {priceError || hasPublishFieldError("price") ? (
                        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                          {priceError ?? publishBlockers.find((b) => b.field === "price")?.message}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor="p-compare">Prix barré (optionnel)</Label>
                      <Input
                        id="p-compare"
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(
                          "mt-1.5 h-11",
                          (compareError || hasPublishFieldError("compareAt")) && PUBLISH_INPUT_ERROR_CLASS
                        )}
                        value={compareAt}
                        onChange={(e) => {
                          setCompareAt(e.target.value)
                          clearPublishFieldError("compareAt")
                        }}
                        placeholder="MSRP"
                        aria-invalid={Boolean(compareError || hasPublishFieldError("compareAt"))}
                      />
                      {compareError || hasPublishFieldError("compareAt") ? (
                        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                          {compareError ?? publishBlockers.find((b) => b.field === "compareAt")?.message}
                        </p>
                      ) : null}
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
                          advancedSkuRows.some((r) => r.color.trim().length > 0)
                        }
                      />
                      {variantStockHint ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{variantStockHint}</p>
                      ) : null}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  id="add-product-variants"
                  icon={Layers}
                  title="Variantes"
                  description="Un seul article ou plusieurs déclinaisons — le stock total se calcule automatiquement."
                  hasError={hasPublishFieldError("variants")}
                >
                  {hasPublishFieldError("variants") ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
                      {publishBlockers.find((b) => b.field === "variants")?.message}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVariantFormMode("none")
                        clearPublishFieldError("variants")
                      }}
                      className={cn(
                        "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                        !hasVariants
                          ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      )}
                    >
                      Produit simple
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (variantFormMode === "none") {
                          setVariantFormMode("simple")
                          setSimpleColorRows((rows) =>
                            rows.length === 0
                              ? [{ id: newVariantRowId(), name: "", image: "" }]
                              : rows
                          )
                        }
                      }}
                      className={cn(
                        "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                        hasVariants
                          ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      )}
                    >
                      Plusieurs déclinaisons
                    </button>
                  </div>
                  {hasVariants ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Mode :</span>
                      <button
                        type="button"
                        onClick={() => setVariantFormMode("simple")}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium",
                          variantFormMode === "simple"
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400"
                        )}
                      >
                        Couleurs & tailles
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVariantFormMode("advanced")
                          const colors = extractOrderedColorNames(simpleColorRows)
                          const sup = Number(price) > 0 ? Number(price) : 10
                          const comm = Math.round(Number(commission) || 15)
                          if (colors.length > 0) {
                            const generated = generateSkuTableRows({
                              colorsText: colors.join(", "),
                              sizesText: variantSizesText,
                              skuPrefix: "PRD",
                              baseSupplierPrice: sup,
                              defaultCommission: comm,
                            })
                            setAdvancedSkuRows(generated)
                            setVariantRows([])
                          } else if (advancedSkuRows.length === 0) {
                            setAdvancedSkuRows([
                              {
                                id: newVariantRowId(),
                                color: "",
                                size: null,
                                sku: null,
                                supplierPrice: sup,
                                stock: 0,
                                commissionRate: comm,
                                compareAtEur: compareAt.trim()
                                  ? Number(compareAt)
                                  : null,
                                customFields: {},
                              },
                            ])
                          }
                        }}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium",
                          variantFormMode === "advanced"
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400"
                        )}
                      >
                        Tableau SKU détaillé
                      </button>
                    </div>
                  ) : null}
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
                              Une ligne = une couleur (ex. <span className="font-medium">Noir/Rouge</span>). Pas de
                              virgule ni « + » — pour plusieurs axes, utilisez le tableau SKU.
                            </p>
                            {simpleColorIssues.length > 0 ? (
                              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                {simpleColorIssues.length} erreur
                                {simpleColorIssues.length > 1 ? "s" : ""} à corriger ci-dessous.
                              </p>
                            ) : null}
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
                          {simpleColorRows.map((row, i) => {
                            const colorIssue = simpleColorIssues.find((iss) => iss.index === i)
                            return (
                            <div
                              key={row.id}
                              className={cn(
                                "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-start",
                                colorIssue
                                  ? "border-red-400 bg-red-50/50 dark:border-red-600 dark:bg-red-950/30"
                                  : "border-zinc-200/90 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/40"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <Label htmlFor={`v-color-name-${row.id}`} className="text-xs">
                                  Nom
                                </Label>
                                <Input
                                  id={`v-color-name-${row.id}`}
                                  className={cn(
                                    "mt-1.5 h-10",
                                    colorIssue && PUBLISH_INPUT_ERROR_CLASS
                                  )}
                                  value={row.name}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setSimpleColorRows((prev) =>
                                      prev.map((r, j) => (j === i ? { ...r, name: v } : r))
                                    )
                                    clearPublishFieldError("variants")
                                  }}
                                  placeholder="ex. Noir/Rouge"
                                  maxLength={48}
                                  aria-invalid={Boolean(colorIssue)}
                                />
                                {colorIssue ? (
                                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                    {colorIssue.message}
                                  </p>
                                ) : null}
                              </div>
                              <SupplierSimpleColorImageField
                                rowId={row.id}
                                value={row.image}
                                onChange={(image) => {
                                  setSimpleColorRows((prev) =>
                                    prev.map((r, j) => (j === i ? { ...r, image } : r))
                                  )
                                }}
                              />
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
                          )})}
                        </div>
                      </div>
                    </div>
                  ) : variantFormMode === "advanced" ? (
                    <SupplierVariantTable
                      rows={advancedSkuRows}
                      onChange={setAdvancedSkuRows}
                      onValidationChange={setSkuValidationIssues}
                      basePriceEur={catalogPriceEur ?? (Number(price) || 10)}
                      catalogCompareAtEur={
                        compareAt.trim() ? Number(compareAt) : null
                      }
                      defaultCommission={Math.round(Number(commission) || 15)}
                      customColumns={skuCustomColumns}
                      onCustomColumnsChange={setSkuCustomColumns}
                      hiddenColumns={skuHiddenColumns}
                      onHiddenColumnsChange={setSkuHiddenColumns}
                      skuPrefix="PRD"
                      catalogShipsFrom={shipsFrom.trim() || "EU"}
                      catalogDeliveryDays={
                        deliveryDays.trim() && Number.isFinite(Number(deliveryDays))
                          ? Math.round(Number(deliveryDays))
                          : 2
                      }
                      disabled={saving}
                      hideHeaderStats
                    />
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      One sellable unit — no size or color pickers on the product page from this listing.
                    </p>
                  )}
                </SectionCard>
                    <SupplierSkuErrorsAlert issues={skuValidationIssues} />
                    <div className="lg:hidden">{simulationCard}</div>
                  </div>
                  <div className="hidden lg:block">{simulationCard}</div>
                </div>

                <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" size="lg" onClick={prevWizardStep}>
                    Retour à la fiche
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600"
                    disabled={
                      skuErrors.length > 0 ||
                      (variantFormMode === "simple" && simpleColorIssues.length > 0) ||
                      !step2Complete
                    }
                    onClick={() => {
                      const blockers = collectClientPublishBlockers(publishValidationContext)
                      const step2Only = blockers.filter((b) =>
                        ["price", "compareAt", "variants"].includes(b.field)
                      )
                      if (step2Only.length > 0) {
                        applyPublishBlockers(step2Only)
                        return
                      }
                      setPublishBlockers((prev) =>
                        prev.filter((b) => !["price", "compareAt", "variants"].includes(b.field))
                      )
                      nextWizardStep()
                    }}
                  >
                    Continuer — logistique
                  </Button>
                </div>
              </>
            ) : (
              <>
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
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-4 sm:col-span-2 dark:border-amber-900/50 dark:from-amber-950/30 dark:to-zinc-950">
                      <input
                        id="m-luxe"
                        type="checkbox"
                        checked={isLuxury}
                        onChange={(e) => setIsLuxury(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 dark:border-zinc-600"
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor="m-luxe"
                          className="flex items-center gap-2 font-medium leading-snug text-amber-950 dark:text-amber-100"
                        >
                          <Sparkles className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                          Affisell Luxe
                        </Label>
                        <p className="mt-1 text-sm font-normal leading-snug text-amber-900/80 dark:text-amber-200/80">
                          Cochez pour afficher ce produit dans la vitrine premium{" "}
                          <span className="whitespace-nowrap">/luxe</span> une fois qu’un affilié l’a listé.
                          Sans cette case, il n’y apparaît pas.
                        </p>
                      </div>
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
                  className={cn(
                    "scroll-mt-28 overflow-hidden rounded-3xl border bg-gradient-to-br from-violet-50 via-white to-violet-50/50 p-6 shadow-md ring-1 sm:p-7 dark:from-violet-950/40 dark:via-zinc-950 dark:to-violet-950/30",
                    hasPublishFieldError("commission")
                      ? PUBLISH_SECTION_ERROR_CLASS
                      : "border-violet-200/80 ring-violet-500/10 dark:border-violet-900/50 dark:ring-violet-400/10"
                  )}
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
                        {variantFormMode === "advanced" && advancedSkuRows.length > 0
                          ? "Par défaut pour les nouvelles lignes SKU. La commission par choix est définie dans le tableau SKU."
                          : "Part de la marge affiliée (leur prix de vente moins votre coût) à chaque vente."}
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
                      <Label htmlFor="p-comm">
                        Commission proposée (%)
                        {variantFormMode === "advanced" && advancedSkuRows.some((r) => r.color.trim())
                          ? " — défaut nouvelles lignes"
                          : " — facultatif"}
                      </Label>
                      <Input
                        id="p-comm"
                        type="number"
                        min={0}
                        max={commissionMax}
                        step="1"
                        className={cn(
                          "mt-1.5 h-11",
                          (commissionError || hasPublishFieldError("commission")) && PUBLISH_INPUT_ERROR_CLASS
                        )}
                        value={commission}
                        onChange={(e) => {
                          setCommission(e.target.value)
                          clearPublishFieldError("commission")
                        }}
                        aria-invalid={Boolean(commissionError || hasPublishFieldError("commission"))}
                      />
                      {commissionError || hasPublishFieldError("commission") ? (
                        <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                          {commissionError ?? publishBlockers.find((b) => b.field === "commission")?.message}
                        </p>
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
                </div>

                <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="outline" size="lg" onClick={prevWizardStep}>
                    Retour — variantes & prix
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      size="lg"
                      disabled={
                        saving ||
                        (variantFormMode === "simple" && simpleColorIssues.length > 0) ||
                        (variantFormMode === "advanced" && skuValidationIssues.length > 0)
                      }
                      className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600"
                      onClick={() => void handleSubmit()}
                    >
                      {saving
                        ? "Enregistrement…"
                        : editId && !productIsDraft
                          ? "Enregistrer"
                          : "Publier le produit"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </ProductWizard>
      </BentoShell>
    </>
  )
}
