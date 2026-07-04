"use client"

import type { FormEvent, MouseEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Rocket, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { flushAllMerchantDrafts, registerMerchantDraftFlush } from "@/lib/merchant-draft-flush"

import { AiPricingOptimizer } from "@/components/affiliate/ai-pricing-optimizer"
import {
  AffiliateVariantMarginEditor,
  initialVariantMarginEuroByKey,
} from "@/components/affiliate/affiliate-variant-margin-editor"
import {
  buildVariantPricingFromMargins,
  parseAffiliateVariantPricingJson,
  sellingPriceCentsFromMargin,
  serializeVariantPricingForDb,
} from "@/lib/affiliate-variant-pricing"
import {
  clampBuyerRewardPercent,
  maxAffordableBuyerRewardPercent,
  normalizeBuyerRewardKind,
  type BuyerRewardKind,
} from "@/lib/affiliate-buyer-reward"
import { productSizeOptions } from "@/lib/affiliate-promoted-variant"
import {
  buildAffiliateVariantOptions,
  initialPromotedVariantPick,
  promotedVariantKeysFromPick,
} from "@/lib/affiliate-storefront-variants"
import { DEFAULT_AFFISELL_COMMISSION_BPS } from "@/lib/affisell-platform-commission"
import {
  LUXURY_TIER_COLLECTION,
  LUXURY_TIER_LUXE,
  LUXURY_TIER_NONE,
  type LuxuryTier,
} from "@/lib/luxury-constants"
import { computeMarketplaceOrderSettlement } from "@/lib/marketplace-order-settlement"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { formatWarrantyBadgeLabel, resolveProductWarrantyMonths } from "@/lib/product-warranty"
import { cn } from "@/lib/utils"

type CatalogProduct = {
  id: string
  name: string
  description?: string
  images: string[]
  basePriceCents: number
  commissionRate?: number
  supplierCommissionRateBps?: number | null
  colors?: string[]
  variants?: unknown
  hasVariants?: boolean
  productVariants?: Array<{
    color: string | null
    size: string | null
    stock: number
    customData?: unknown
  }>
}

export type SerializedListing = {
  id: string
  productId: string
  sellingPriceCents: number
  customTitle?: string | null
  customDescription?: string | null
  customImages: string[]
  customSlug?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  collections: string[]
  luxuryTier?: string
  luxuryCollectionId?: string | null
  isListed: boolean
  isFeatured?: boolean
  auctionEligible?: boolean
  clicks?: number
  conversions?: number
  position?: number
  buyerRewardKind?: string | null
  buyerRewardPercent?: number | null
  promotedColor?: string | null
  promotedSize?: string | null
  promotedVariantKeys?: string[]
  variantPricing?: unknown
  pricingAutoAdjust?: boolean
  showWarranty?: boolean
}

type Props = {
  open: boolean
  product: CatalogProduct | null
  listing: SerializedListing | null
  storeSlug: string | null
  onClose: () => void
  onSaved: (result?: { listingId?: string; published?: boolean }) => void
  /** Swipe feed: pre-fill selling price at base × (1 + rate). */
  suggestedMarkupRate?: number
  /** Disable silent draft autosave (swipe cancel must not create drafts). */
  enableAutosave?: boolean
  context?: "catalog" | "swipe" | "onboarding"
}

const COLLECTIONS = ["Featured", "Black Friday", "Tech Deals"] as const

function clampNumber(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

type FormFields = {
  step: 1 | 2
  customTitle: string
  customDescription: string
  useAllSupplierImages: boolean
  imagePick: Record<string, boolean>
  extraUrls: string
  priceEUR: string
  selectedCollections: Record<string, boolean>
  customSlug: string
  seoTitle: string
  seoDesc: string
  listInStore: boolean
  buyerRewardKind: BuyerRewardKind
  buyerRewardPercent: number
  promotedColor: string
  promotedSize: string
  promotedVariantPick: Record<string, boolean>
  variantMarginEUR: Record<string, string>
  pricingAutoAdjust: boolean
  showWarranty: boolean
  luxuryTier: LuxuryTier
  luxuryCollectionId: string
}

function getListingFormDefaults(
  product: CatalogProduct,
  listing: SerializedListing | null,
  variantOptions: ReturnType<typeof buildAffiliateVariantOptions>,
  suggestedMarkupRate?: number
): Omit<FormFields, "step"> {
  const urls = product.images?.filter(Boolean) ?? []
  const L = listing
  const imagePick: Record<string, boolean> = {}
  urls.forEach((u) => {
    imagePick[u] = Boolean(L?.customImages?.includes(u))
  })
  const selectedCollections: Record<string, boolean> = {}
  COLLECTIONS.forEach((c) => {
    selectedCollections[c] = L?.collections.includes(c) ?? false
  })
  const suggestedCents =
    suggestedMarkupRate != null && Number.isFinite(suggestedMarkupRate) && suggestedMarkupRate >= 0
      ? Math.round(product.basePriceCents * (1 + suggestedMarkupRate))
      : null

  return {
    customTitle: L?.customTitle ?? "",
    customDescription: L?.customDescription ?? product.description ?? "",
    useAllSupplierImages: !L || L.customImages.length === 0,
    imagePick,
    extraUrls: L?.customImages.filter((u) => !urls.includes(u)).join("\n") ?? "",
    priceEUR:
      L?.sellingPriceCents != null
        ? (L.sellingPriceCents / 100).toFixed(2)
        : suggestedCents != null
          ? (suggestedCents / 100).toFixed(2)
          : (product.basePriceCents / 100).toFixed(2),
    selectedCollections,
    customSlug: L?.customSlug ?? "",
    seoTitle: L?.seoTitle ?? "",
    seoDesc: L?.seoDescription ?? "",
    listInStore: L ? L.isListed : true,
    buyerRewardKind: normalizeBuyerRewardKind(L?.buyerRewardKind),
    buyerRewardPercent: clampBuyerRewardPercent(L?.buyerRewardPercent ?? 0),
    promotedColor: L?.promotedColor?.trim() ?? "",
    promotedSize: L?.promotedSize?.trim() ?? "",
    promotedVariantPick: initialPromotedVariantPick(
      variantOptions,
      L?.promotedVariantKeys
    ),
    variantMarginEUR: initialVariantMarginEuroByKey({
      options: variantOptions,
      variantPricing: parseAffiliateVariantPricingJson(L?.variantPricing),
      globalMarginEuro:
        L?.sellingPriceCents != null
          ? (L.sellingPriceCents - product.basePriceCents) / 100
          : suggestedCents != null
            ? (suggestedCents - product.basePriceCents) / 100
            : null,
    }),
    pricingAutoAdjust: Boolean(L?.pricingAutoAdjust),
    showWarranty: Boolean(L?.showWarranty),
    luxuryTier:
      L?.luxuryTier === LUXURY_TIER_LUXE || L?.luxuryTier === LUXURY_TIER_COLLECTION
        ? (L.luxuryTier as LuxuryTier)
        : LUXURY_TIER_NONE,
    luxuryCollectionId: L?.luxuryCollectionId ?? "",
  }
}

type BodyProps = {
  product: CatalogProduct
  listing: SerializedListing | null
  storeSlug: string | null
  onClose: () => void
  onSaved: (result?: { listingId?: string; published?: boolean }) => void
  suggestedMarkupRate?: number
  enableAutosave: boolean
  context: "catalog" | "swipe" | "onboarding"
}

function ListingBuilderModalBody({
  product,
  listing,
  storeSlug,
  onClose,
  onSaved,
  suggestedMarkupRate,
  enableAutosave,
  context,
}: BodyProps) {
  const tFirstListing = useTranslations("affiliateDashboard.firstListing")
  const onboardingFlow = context === "onboarding"
  const supplierUrls = useMemo(() => product.images?.filter(Boolean) ?? [], [product.images])
  const variantOptions = useMemo(
    () =>
      buildAffiliateVariantOptions({
        colors: product.colors ?? [],
        variants: product.variants,
        basePriceCents: product.basePriceCents,
        hasVariants: product.hasVariants,
        productVariants: product.productVariants,
      }),
    [product]
  )
  const supplierWarrantyMonths = useMemo(
    () =>
      resolveProductWarrantyMonths({
        variants: product.variants,
        hasVariants: product.hasVariants,
        productVariants: product.productVariants,
      }),
    [product]
  )
  const supplierWarrantyLabel =
    supplierWarrantyMonths != null && supplierWarrantyMonths > 0
      ? formatWarrantyBadgeLabel(supplierWarrantyMonths)
      : null
  const [form, setForm] = useState<FormFields>(() => ({
    step: 1,
    ...getListingFormDefaults(product, listing, variantOptions, suggestedMarkupRate),
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [pricingAiToast, setPricingAiToast] = useState<string | null>(null)
  const [pricingGreenToast, setPricingGreenToast] = useState<string | null>(null)
  const [pricePulse, setPricePulse] = useState(false)
  const lastDraftFingerprint = useRef("")

  const marginEUR = useMemo(() => {
    const pp = Number(String(form.priceEUR).replace(",", "."))
    if (!Number.isFinite(pp)) return null
    return pp - product.basePriceCents / 100
  }, [form.priceEUR, product])

  const marginPct = useMemo(() => {
    const sup = product.basePriceCents / 100
    if (marginEUR == null || !Number.isFinite(marginEUR) || sup <= 0) return null
    return (marginEUR / sup) * 100
  }, [marginEUR, product])

  const settlementPreview = useMemo(() => {
    const euro = Number(String(form.priceEUR).replace(",", "."))
    if (!Number.isFinite(euro) || euro <= 0) return null
    const clientLineHtCents = Math.round(euro * 100)
    const supplierCommissionRateBps =
      product.supplierCommissionRateBps ??
      Math.round((Number(product.commissionRate) || 11) * 100)
    return computeMarketplaceOrderSettlement({
      sellingPriceCents: clientLineHtCents,
      supplierPriceCents: product.basePriceCents,
      supplierCommissionRateBps,
      affisellFeeBaseCents: clientLineHtCents,
      affisellCommissionRateBps: DEFAULT_AFFISELL_COMMISSION_BPS,
    })
  }, [form.priceEUR, product])

  const topVariantSettlement = useMemo(() => {
    if (variantOptions.length <= 1) return null
    const supplierCommissionRateBps =
      product.supplierCommissionRateBps ??
      Math.round((Number(product.commissionRate) || 11) * 100)

    let best: { label: string; sellCents: number } | null = null
    for (const opt of variantOptions) {
      if (!form.promotedVariantPick[opt.key]) continue
      const marginRaw = form.variantMarginEUR[opt.key]
      const marginEuro = Number(String(marginRaw ?? "").replace(",", "."))
      if (!Number.isFinite(marginEuro) || marginEuro < 0) continue
      const sellCents = sellingPriceCentsFromMargin({
        wholesaleCents: opt.wholesaleCents,
        marginEuro,
      })
      if (!best || sellCents > best.sellCents) {
        best = { label: opt.label, sellCents }
      }
    }
    if (!best) return null
    return {
      ...best,
      settlement: computeMarketplaceOrderSettlement({
        sellingPriceCents: best.sellCents,
        supplierPriceCents: product.basePriceCents,
        supplierCommissionRateBps,
        affisellFeeBaseCents: best.sellCents,
        affisellCommissionRateBps: DEFAULT_AFFISELL_COMMISSION_BPS,
      }),
    }
  }, [form.promotedVariantPick, form.variantMarginEUR, product, variantOptions])

  const sellingPriceCentsPreview = useMemo(() => {
    const euro = Number(String(form.priceEUR).replace(",", "."))
    if (!Number.isFinite(euro)) return product.basePriceCents
    return Math.round(euro * 100)
  }, [form.priceEUR, product.basePriceCents])

  const maxBuyerRewardPct = useMemo(
    () => maxAffordableBuyerRewardPercent(sellingPriceCentsPreview, product.basePriceCents),
    [sellingPriceCentsPreview, product.basePriceCents]
  )

  const tListingBuilder = useTranslations("affiliateDashboard.listingBuilder")
  const multiVariantSelectedKeys = useMemo(
    () => promotedVariantKeysFromPick(variantOptions, form.promotedVariantPick),
    [form.promotedVariantPick, variantOptions]
  )

  const highlightColorOptions = useMemo(
    () => (product.colors ?? []).map((c) => c.trim()).filter(Boolean),
    [product.colors]
  )
  const highlightSizeOptions = useMemo(() => productSizeOptions(product.variants), [product.variants])

  useEffect(() => {
    if (!pricingAiToast) return
    const t = window.setTimeout(() => setPricingAiToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [pricingAiToast])

  useEffect(() => {
    if (!pricingGreenToast) return
    const t = window.setTimeout(() => setPricingGreenToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [pricingGreenToast])

  function marginPercentFromPrice(price: number): number | null {
    const sup = product.basePriceCents / 100
    if (sup <= 0 || !Number.isFinite(price)) return null
    return ((price - sup) / sup) * 100
  }

  function priceFromMarginPercent(pct: number): number {
    const sup = product.basePriceCents / 100
    const raw = sup * (1 + pct / 100)
    return Math.round(Math.max(raw, sup + 0.01) * 100) / 100
  }

  function toggleCollection(c: string) {
    setForm((f) => ({
      ...f,
      selectedCollections: { ...f.selectedCollections, [c]: !f.selectedCollections[c] },
    }))
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setUploadBusy(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 5)) {
        const fd = new FormData()
        fd.set("file", file)
        const res = await fetch("/api/affiliate/uploads", { method: "POST", body: fd, credentials: "include" })
        const j = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed")
        urls.push(typeof window !== "undefined" ? `${window.location.origin}${j.url}` : j.url)
      }
      setForm((f) => ({
        ...f,
        extraUrls: (f.extraUrls.trim() ? `${f.extraUrls.trim()}\n` : "") + urls.join("\n"),
      }))
    } finally {
      setUploadBusy(false)
    }
  }

  function buildCollectionsArray() {
    return COLLECTIONS.filter((c) => form.selectedCollections[c])
  }

  function builtCustomImages(): string[] {
    const extras = form.extraUrls
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
    const subset = form.useAllSupplierImages
      ? supplierUrls
      : supplierUrls.filter((u) => form.imagePick[u])
    const merged = [...subset, ...extras]
    const seen = new Set<string>()
    return merged.filter((u) => (seen.has(u) ? false : (seen.add(u), true))).slice(0, 20)
  }

  async function submit(saveDraft: boolean, opts?: { silent?: boolean }) {
    setBusy(true)
    if (!opts?.silent) setError(null)
    try {
      const promotedVariantKeys =
        variantOptions.length > 0
          ? promotedVariantKeysFromPick(variantOptions, form.promotedVariantPick)
          : []

      const variantPricingMap =
        variantOptions.length > 1
          ? buildVariantPricingFromMargins({
              options: variantOptions.map((o) => ({
                key: o.key,
                wholesaleCents: o.wholesaleCents,
              })),
              pick: form.promotedVariantPick,
              marginEuroByKey: form.variantMarginEUR,
            })
          : {}
      const variantPricingPayload = serializeVariantPricingForDb(variantPricingMap)

      if (
        !saveDraft &&
        variantOptions.length > 1 &&
        promotedVariantKeys.length > 0 &&
        Object.keys(variantPricingMap).length === 0
      ) {
        throw new Error("Définissez une marge pour chaque variante sélectionnée.")
      }

      if (
        !saveDraft &&
        variantOptions.length > 0 &&
        promotedVariantKeys.length === 0
      ) {
        throw new Error("Sélectionnez au moins une variante à afficher sur votre boutique.")
      }

      const collections = buildCollectionsArray()
      let euro = Number(String(form.priceEUR).replace(",", "."))
      if (saveDraft && (!Number.isFinite(euro) || euro <= 0)) {
        euro = product.basePriceCents / 100
      }

      if (!saveDraft && form.buyerRewardKind !== "NONE") {
        if (maxBuyerRewardPct <= 0) {
          throw new Error("Raise your price above supplier cost to offer a buyer reward.")
        }
        if (form.buyerRewardPercent > maxBuyerRewardPct) {
          throw new Error(
            `Buyer reward cannot exceed ${maxBuyerRewardPct}% at this price (your margin). Lower the % or increase your selling price.`
          )
        }
      }

      if (listing?.id) {
        const bodyObj: Record<string, unknown> = {
          sellingPriceEUR: euro,
          customTitle: form.customTitle.trim(),
          customDescription: form.customDescription.trim(),
          customImages: builtCustomImages(),
          collections,
          customSlug: form.customSlug.trim(),
          seoTitle: form.seoTitle.trim(),
          seoDescription: form.seoDesc.trim(),
          isListed: saveDraft ? false : form.listInStore,
          isFeatured: collections.includes("Featured"),
          buyerRewardKind: form.buyerRewardKind,
          buyerRewardPercent: form.buyerRewardPercent,
          promotedColor: form.promotedColor.trim() || null,
          promotedSize: form.promotedSize.trim() || null,
          promotedVariantKeys,
          ...(variantPricingPayload ? { variantPricing: variantPricingPayload } : {}),
          pricingAutoAdjust: form.pricingAutoAdjust,
          showWarranty: form.showWarranty,
          luxuryTier: form.luxuryTier,
          luxuryCollectionId:
            form.luxuryTier === LUXURY_TIER_COLLECTION ? form.luxuryCollectionId || null : null,
        }
        const res = await fetch(`/api/affiliate/products/${listing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(bodyObj),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) {
          if (
            !saveDraft &&
            res.status === 403 &&
            j.error === "merchant_verification_pending"
          ) {
            await submit(true, { silent: true })
            if (!opts?.silent) {
              setError(tFirstListing("kycDraftSaved"))
              onSaved({ published: false })
              onClose()
            }
            return
          }
          throw new Error(j.error ?? "Save failed")
        }
        if (!opts?.silent) {
          onSaved({ listingId: listing.id, published: !saveDraft })
          onClose()
        }
      } else {
        const extrasParsed = form.extraUrls
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean)
        const supplierSelected = supplierUrls.filter((u) => form.imagePick[u])

        const bodyObj: Record<string, unknown> = {
          productId: product.id,
          sellingPriceEUR: euro,
          customTitle: form.customTitle.trim(),
          customDescription: form.customDescription.trim(),
          supplierImagesSelectedUrls: form.useAllSupplierImages ? undefined : supplierSelected,
          useAllSupplierImages: form.useAllSupplierImages,
          additionalImageUrls: extrasParsed,
          collections,
          customSlug: form.customSlug.trim(),
          seoTitle: form.seoTitle.trim(),
          seoDescription: form.seoDesc.trim(),
          listInStore: form.listInStore,
          saveDraft,
          publish: !saveDraft,
          publishToStore: !saveDraft,
          buyerRewardKind: form.buyerRewardKind,
          buyerRewardPercent: form.buyerRewardPercent,
          promotedColor: form.promotedColor.trim() || null,
          promotedSize: form.promotedSize.trim() || null,
          promotedVariantKeys,
          ...(variantPricingPayload ? { variantPricing: variantPricingPayload } : {}),
          pricingAutoAdjust: form.pricingAutoAdjust,
          showWarranty: form.showWarranty,
          luxuryTier: form.luxuryTier,
          luxuryCollectionId:
            form.luxuryTier === LUXURY_TIER_COLLECTION ? form.luxuryCollectionId || null : null,
        }

        const res = await fetch("/api/affiliate/products/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(bodyObj),
        })
        const j = (await res.json()) as { error?: string; id?: string }
        if (!res.ok) {
          if (
            !saveDraft &&
            res.status === 403 &&
            j.error === "merchant_verification_pending"
          ) {
            await submit(true, { silent: true })
            if (!opts?.silent) {
              setError(tFirstListing("kycDraftSaved"))
              onSaved({ published: false })
              onClose()
            }
            return
          }
          throw new Error(j.error ?? "Could not create listing")
        }
        if (!opts?.silent) {
          onSaved({ listingId: j.id, published: !saveDraft })
          onClose()
        }
      }
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  const saveDraftSilent = useCallback(async () => {
    if (!enableAutosave || busy) return
    const fp = JSON.stringify({ productId: product.id, listingId: listing?.id, form })
    if (fp === lastDraftFingerprint.current) return
    try {
      await submit(true, { silent: true })
      lastDraftFingerprint.current = fp
    } catch {
      /* autosave best-effort */
    }
  }, [busy, enableAutosave, form, listing?.id, product.id])

  useEffect(() => {
    if (!enableAutosave) return
    const timer = window.setTimeout(() => {
      void saveDraftSilent()
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [enableAutosave, form, saveDraftSilent])

  useEffect(() => {
    if (!enableAutosave) return
    const unregister = registerMerchantDraftFlush("affiliate-listing-builder", () => saveDraftSilent())
    return () => {
      void saveDraftSilent()
      unregister()
    }
  }, [enableAutosave, saveDraftSilent])

  async function handleClose() {
    if (enableAutosave) await saveDraftSilent()
    onClose()
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
  }

  const baseEUR = product.basePriceCents / 100

  return (
    <div
      data-testid="affiliate-listing-builder-modal"
      className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-violet-100/80 bg-white shadow-[0_-12px_48px_rgba(88,28,135,0.18)] sm:max-h-[90vh] sm:rounded-2xl sm:shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {onboardingFlow
              ? tFirstListing("modalEyebrow")
              : context === "swipe"
                ? "Swipe → Studio vitrine"
                : "Add to My Store"}
          </p>
          <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
          {context === "swipe" ? (
            <p className="mt-1 text-xs text-violet-700">
              Ajustez marge, titre et SEO avant publication
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleClose()}
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 gap-2 border-b border-gray-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, step: 1 }))}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              form.step === 1 ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {onboardingFlow ? tFirstListing("stepCustomize") : context === "swipe" ? "1 Personnaliser" : "1 Customize"}
          </button>
          {!onboardingFlow ? (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, step: 2 }))}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                form.step === 2 ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {context === "swipe" ? "2 SEO & visibilité" : "2 SEO & Visibility"}
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {form.step === 1 ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-800">Custom Title</label>
                <input
                  value={form.customTitle}
                  onChange={(e) => setForm((f) => ({ ...f, customTitle: e.target.value }))}
                  placeholder={product.name}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none ring-gray-900 focus:ring-2"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank to use original</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">Custom Description</label>
                <textarea
                  value={form.customDescription}
                  onChange={(e) => setForm((f) => ({ ...f, customDescription: e.target.value }))}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder={product.description?.slice(0, 280)}
                />
              </div>

              {variantOptions.length > 1 ? (
                <AffiliateVariantMarginEditor
                  options={variantOptions}
                  pick={form.promotedVariantPick}
                  marginEuroByKey={form.variantMarginEUR}
                  globalMarginEuro={marginEUR}
                  disabled={busy || uploadBusy}
                  onPickChange={(key, checked) =>
                    setForm((f) => ({
                      ...f,
                      promotedVariantPick: { ...f.promotedVariantPick, [key]: checked },
                    }))
                  }
                  onMarginChange={(key, value) =>
                    setForm((f) => ({
                      ...f,
                      variantMarginEUR: { ...f.variantMarginEUR, [key]: value },
                    }))
                  }
                  onSelectAll={() =>
                    setForm((f) => ({
                      ...f,
                      promotedVariantPick: Object.fromEntries(
                        variantOptions.map((o) => [o.key, true])
                      ),
                    }))
                  }
                  onSelectNone={() =>
                    setForm((f) => ({
                      ...f,
                      promotedVariantPick: Object.fromEntries(
                        variantOptions.map((o) => [o.key, false])
                      ),
                    }))
                  }
                  onApplyGlobalMargin={(marginEuro) =>
                    setForm((f) => ({
                      ...f,
                      variantMarginEUR: Object.fromEntries(
                        variantOptions
                          .filter((o) => f.promotedVariantPick[o.key])
                          .map((o) => [o.key, marginEuro.toFixed(2)])
                      ),
                    }))
                  }
                />
              ) : null}

              {highlightColorOptions.length > 0 || highlightSizeOptions.length > 0 ? (
                <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                  <p className="text-sm font-semibold text-gray-900">Default variant for shoppers</p>
                  <p className="mt-1 text-xs text-gray-600">
                    When someone opens this listing, we pre-select this color or size among the variants
                    you promote above.
                  </p>
                  {highlightColorOptions.length > 0 ? (
                    <div className="mt-3">
                      <label htmlFor="promoted-color" className="text-xs font-medium text-gray-700">
                        Highlight color
                      </label>
                      <select
                        id="promoted-color"
                        value={form.promotedColor}
                        onChange={(e) => setForm((f) => ({ ...f, promotedColor: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">First color (supplier order)</option>
                        {highlightColorOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {highlightSizeOptions.length > 0 ? (
                    <div className="mt-3">
                      <label htmlFor="promoted-size" className="text-xs font-medium text-gray-700">
                        Highlight size
                      </label>
                      <select
                        id="promoted-size"
                        value={form.promotedSize}
                        onChange={(e) => setForm((f) => ({ ...f, promotedSize: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="">First size (supplier order)</option>
                        {highlightSizeOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={form.useAllSupplierImages}
                    onChange={(e) => setForm((f) => ({ ...f, useAllSupplierImages: e.target.checked }))}
                  />
                  Use all supplier images
                </label>
                {!form.useAllSupplierImages ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {supplierUrls.map((u) => (
                      <label key={u} className="relative rounded-lg border border-gray-100 p-1">
                        <input
                          type="checkbox"
                          checked={Boolean(form.imagePick[u])}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              imagePick: { ...f.imagePick, [u]: !f.imagePick[u] },
                            }))
                          }
                          className="absolute right-2 top-2 rounded"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u || "/placeholder.png"} alt="" className="aspect-square rounded-md object-contain" />
                      </label>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-sm font-medium text-gray-800">Additional image URLs</p>
                <textarea
                  value={form.extraUrls}
                  onChange={(e) => setForm((f) => ({ ...f, extraUrls: e.target.value }))}
                  rows={3}
                  placeholder="https://… one per line"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-gray-900"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  Upload PNG / JPEG
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    multiple
                    className="hidden"
                    disabled={uploadBusy}
                    onChange={(e) => void uploadFiles(e.target.files)}
                  />
                </label>
              </div>

              <div className="space-y-4">
                {pricingAiToast ? (
                  <p className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800">
                    {pricingAiToast}
                  </p>
                ) : null}

                <AiPricingOptimizer
                  supplierPriceEUR={baseEUR}
                  currentPriceEUR={form.priceEUR}
                  onPriceChange={(nextEUR) =>
                    setForm((f) => ({ ...f, priceEUR: nextEUR.toFixed(2) }))
                  }
                  onNotify={(msg) => {
                    setPricingAiToast(msg)
                    setPricingGreenToast(msg)
                  }}
                  onApplyComplete={() => {
                    setPricePulse(true)
                    window.setTimeout(() => setPricePulse(false), 1000)
                  }}
                  multiVariant={
                    variantOptions.length > 1
                      ? {
                          selectedCount: multiVariantSelectedKeys.length,
                          baseWholesaleCents: product.basePriceCents,
                          options: variantOptions.map((o) => ({
                            key: o.key,
                            wholesaleCents: o.wholesaleCents,
                          })),
                          selectedKeys: multiVariantSelectedKeys,
                          onApplyVariantMargins: (marginsByKey) =>
                            setForm((f) => ({
                              ...f,
                              variantMarginEUR: { ...f.variantMarginEUR, ...marginsByKey },
                            })),
                        }
                      : undefined
                  }
                  autoAdjust={form.pricingAutoAdjust}
                  onAutoAdjustChange={(enabled) =>
                    setForm((f) => ({ ...f, pricingAutoAdjust: enabled }))
                  }
                  persistAutoAdjust
                />

                <label className="block text-sm font-medium text-gray-800">
                  {variantOptions.length > 1
                    ? tListingBuilder("referencePriceLabel")
                    : "Custom Price (EUR)"}
                </label>
                <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                  {variantOptions.length > 1 ? (
                    <p className="text-xs leading-relaxed text-gray-500">
                      {tListingBuilder("referencePriceHint")}
                    </p>
                  ) : null}
                  <p className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm text-gray-600">
                    <span>Supplier: €{baseEUR.toFixed(2)}</span>
                    <span className="text-gray-400">|</span>
                    <label htmlFor="selling-price" className="font-medium text-gray-800">
                      Your selling price
                    </label>
                    <input
                      id="selling-price"
                      name="sellingPrice"
                      type="number"
                      step={0.01}
                      min={baseEUR}
                      value={form.priceEUR}
                      onChange={(e) => setForm((f) => ({ ...f, priceEUR: e.target.value }))}
                      className={`w-28 rounded border border-gray-200 px-2 py-1 text-green-700 transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${pricePulse ? "pulse-green ring-2 ring-green-500 ring-offset-2" : ""}`}
                    />
                    <span className="text-gray-400">|</span>
                    <span>
                      Margin:{" "}
                      <span className="font-semibold text-green-600">
                        {marginEUR != null && Number.isFinite(marginEUR) ? `€${marginEUR.toFixed(2)}` : "—"}
                      </span>
                      {marginPct != null ? (
                        <span className="text-gray-500"> ({marginPct.toFixed(1)}% markup)</span>
                      ) : null}
                    </span>
                  </p>

                  {settlementPreview ? (
                    <p className="rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-violet-950">
                      <span className="font-semibold">Est. per sale (HT, ex-VAT):</span>{" "}
                      Affisell fee{" "}
                      {formatStoreCurrencyFromCents(settlementPreview.affisellFeeCents)} (
                      {(
                        (settlementPreview.affisellFeeCents / settlementPreview.affisellFeeBaseCents) *
                        100
                      ).toFixed(0)}
                      % of line HT) · partner commission{" "}
                      {formatStoreCurrencyFromCents(settlementPreview.affiliateCommissionCents)} · your
                      net markup{" "}
                      {formatStoreCurrencyFromCents(settlementPreview.affiliateMarginRetainedCents)} (
                      total earnings{" "}
                      {formatStoreCurrencyFromCents(
                        settlementPreview.affiliateCommissionCents +
                          settlementPreview.affiliateMarginRetainedCents
                      )}
                      )
                    </p>
                  ) : null}

                  {topVariantSettlement ? (
                    <p className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs leading-relaxed text-emerald-950">
                      <span className="font-semibold">
                        {tListingBuilder("topVariantSettlement", {
                          variant: topVariantSettlement.label,
                          price: formatStoreCurrencyFromCents(topVariantSettlement.sellCents),
                        })}
                      </span>{" "}
                      · net markup{" "}
                      {formatStoreCurrencyFromCents(
                        topVariantSettlement.settlement.affiliateMarginRetainedCents
                      )}{" "}
                      (
                      {formatStoreCurrencyFromCents(
                        topVariantSettlement.settlement.affiliateCommissionCents +
                          topVariantSettlement.settlement.affiliateMarginRetainedCents
                      )}{" "}
                      total)
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="margin-percent" className="block text-xs font-medium text-gray-600">
                        Margin markup %
                      </label>
                      <input
                        id="margin-percent"
                        name="margin"
                        type="number"
                        step={1}
                        min={0}
                        max={250}
                        value={((): number => {
                          const euro = Number(String(form.priceEUR).replace(",", "."))
                          if (!Number.isFinite(euro)) return 0
                          const pct = marginPercentFromPrice(euro)
                          return pct != null ? Math.round(pct) : 0
                        })()}
                        onChange={(e) => {
                          const pct = clampNumber(Number(e.target.value), 0, 250)
                          if (!Number.isFinite(pct)) return
                          const next = priceFromMarginPercent(pct)
                          setForm((f) => ({ ...f, priceEUR: next.toFixed(2) }))
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div className="sm:pt-6">
                      <label htmlFor="margin-slider" className="sr-only">
                        Margin markup slider
                      </label>
                      <input
                        id="margin-slider"
                        type="range"
                        name="marginSlider"
                        min={0}
                        max={120}
                        step={1}
                        value={clampNumber(Math.round(marginPct ?? 0), 0, 120)}
                        onChange={(e) => {
                          const pct = Number(e.target.value)
                          const next = priceFromMarginPercent(pct)
                          setForm((f) => ({ ...f, priceEUR: next.toFixed(2) }))
                        }}
                        className="w-full accent-violet-600"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                        <span>0%</span>
                        <span>120%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-gray-900">Buyer reward (your store)</p>
                <p className="mt-1 text-xs text-gray-600">
                  Optional cashback or bonus for shoppers on this listing. Funded from your margin — max{" "}
                  <span className="font-semibold text-emerald-800">{maxBuyerRewardPct}%</span> at this price.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="buyerRewardKind"
                      checked={form.buyerRewardKind === "NONE"}
                      onChange={() =>
                        setForm((f) => ({ ...f, buyerRewardKind: "NONE", buyerRewardPercent: 0 }))
                      }
                    />
                    None
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-2 text-sm text-gray-800 ${maxBuyerRewardPct <= 0 ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="buyerRewardKind"
                      disabled={maxBuyerRewardPct <= 0}
                      checked={form.buyerRewardKind === "CASHBACK"}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          buyerRewardKind: "CASHBACK",
                          buyerRewardPercent:
                            f.buyerRewardPercent > 0
                              ? Math.min(f.buyerRewardPercent, maxBuyerRewardPct || 1)
                              : Math.min(5, Math.max(1, maxBuyerRewardPct)),
                        }))
                      }
                    />
                    Cashback
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-2 text-sm text-gray-800 ${maxBuyerRewardPct <= 0 ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="buyerRewardKind"
                      disabled={maxBuyerRewardPct <= 0}
                      checked={form.buyerRewardKind === "BONUS"}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          buyerRewardKind: "BONUS",
                          buyerRewardPercent:
                            f.buyerRewardPercent > 0
                              ? Math.min(f.buyerRewardPercent, maxBuyerRewardPct || 1)
                              : Math.min(5, Math.max(1, maxBuyerRewardPct)),
                        }))
                      }
                    />
                    Store bonus
                  </label>
                </div>
                {form.buyerRewardKind !== "NONE" ? (
                  <div className="mt-3">
                    <label htmlFor="buyer-reward-pct" className="text-xs font-medium text-gray-700">
                      Percent of purchase (whole order line)
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id="buyer-reward-pct"
                        type="number"
                        min={1}
                        max={maxBuyerRewardPct > 0 ? maxBuyerRewardPct : 50}
                        step={1}
                        value={form.buyerRewardPercent || ""}
                        onChange={(e) => {
                          const raw = Number(e.target.value)
                          const next = Number.isFinite(raw)
                            ? clampNumber(Math.round(raw), 1, Math.max(1, maxBuyerRewardPct || 50))
                            : 1
                          setForm((f) => ({ ...f, buyerRewardPercent: next }))
                        }}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                    {form.buyerRewardPercent > maxBuyerRewardPct ? (
                      <p className="mt-2 text-xs text-amber-800">
                        Lower the % or raise your selling price (max affordable is {maxBuyerRewardPct}%).
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {supplierWarrantyLabel ? (
                <div className="rounded-xl border border-emerald-100 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">Garantie fournisseur</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Le fournisseur propose{" "}
                    <span className="font-semibold text-emerald-800">{supplierWarrantyLabel}</span> sur ce
                    produit.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={form.showWarranty}
                      onChange={(e) => setForm((f) => ({ ...f, showWarranty: e.target.checked }))}
                      className="mt-0.5 rounded"
                    />
                    <span>Afficher la garantie sur ma boutique et le marketplace</span>
                  </label>
                </div>
              ) : null}

              <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-4 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-zinc-900">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-amber-50">
                  <span aria-hidden>✦</span> Affisell Luxe
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-amber-100/60">
                  Seuls les produits marqués <strong>Luxe</strong> ou rattachés à une{" "}
                  <strong>collection</strong> apparaissent sur /luxe.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      { id: LUXURY_TIER_NONE, label: "Aucun" },
                      { id: LUXURY_TIER_LUXE, label: "Luxe" },
                      { id: LUXURY_TIER_COLLECTION, label: "Collection" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          luxuryTier: opt.id,
                          luxuryCollectionId:
                            opt.id === LUXURY_TIER_COLLECTION ? f.luxuryCollectionId : "",
                        }))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                        form.luxuryTier === opt.id
                          ? "bg-amber-700 text-white ring-amber-800"
                          : "bg-white text-gray-700 ring-gray-200 hover:bg-amber-50 dark:bg-zinc-900 dark:text-amber-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {form.luxuryTier === LUXURY_TIER_COLLECTION ? (
                  <LuxuryCollectionPicker
                    value={form.luxuryCollectionId}
                    onChange={(id) => setForm((f) => ({ ...f, luxuryCollectionId: id }))}
                  />
                ) : null}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-800">Collections</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLLECTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCollection(c)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                        form.selectedCollections[c]
                          ? "bg-gray-900 text-white ring-gray-900"
                          : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-800">URL slug</label>
                <div className="mt-1 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm text-gray-600">
                  <span className="text-gray-400">/store/</span>
                  <span className="text-gray-900">{storeSlug ?? "your-store-slug"}</span>
                  <span className="text-gray-400">/</span>
                  <input
                    value={form.customSlug}
                    onChange={(e) => setForm((f) => ({ ...f, customSlug: e.target.value }))}
                    placeholder="listing-slug"
                    className="min-w-[8rem] flex-1 rounded border-none bg-transparent p-0 text-gray-900 outline-none"
                  />
                </div>
                {!storeSlug ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Finish your Store Profile to set /store/[your slug]
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">SEO Title (max 60)</label>
                <input
                  value={form.seoTitle}
                  maxLength={60}
                  onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">{form.seoTitle.length}/60</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-800">Meta Description (max 160)</label>
                <textarea
                  value={form.seoDesc}
                  maxLength={160}
                  rows={3}
                  onChange={(e) => setForm((f) => ({ ...f, seoDesc: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">{form.seoDesc.length}/160</p>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-900">List in my store</span>
                <input
                  type="checkbox"
                  checked={form.listInStore}
                  onChange={(e) => setForm((f) => ({ ...f, listInStore: e.target.checked }))}
                  className="h-5 w-5 accent-gray-900"
                />
              </label>
            </>
          )}
        </div>

        <div className="relative shrink-0 border-t border-violet-100/80 bg-white/95 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -top-10 left-0 right-0 h-10 bg-gradient-to-t from-white via-white/90 to-transparent"
            aria-hidden
          />

          <div className="flex flex-col gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-stretch sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(true)}
              className="order-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60 sm:order-1 sm:w-auto sm:py-2.5"
            >
              Save Draft
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(false)}
              className={cn(
                "order-1 group relative w-full overflow-hidden rounded-2xl px-5 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-60 sm:order-2 sm:min-w-[220px] sm:flex-1",
                "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600",
                "shadow-[0_8px_32px_rgba(124,58,237,0.45)] hover:shadow-[0_12px_40px_rgba(124,58,237,0.55)] hover:brightness-105"
              )}
            >
              <span
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.22)_50%,transparent_60%)] opacity-0 transition group-hover:opacity-100 group-hover:animate-[shimmer_1.2s_ease-in-out]"
                aria-hidden
              />
              <span className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
              <span className="relative flex items-center justify-center gap-2.5 sm:justify-between">
                <span className="flex flex-col items-center gap-0.5 sm:items-start">
                  <span className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
                    {busy ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      <Rocket className="size-5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    )}
                    {onboardingFlow
                      ? tFirstListing("publishCta")
                      : context === "swipe"
                        ? "Publier en vitrine"
                        : "Push to Store"}
                  </span>
                  {onboardingFlow ? (
                    <span className="text-xs font-medium text-white/85">{tFirstListing("publishHint")}</span>
                  ) : context === "swipe" ? (
                    <span className="text-xs font-medium text-white/85">Publier sur votre vitrine</span>
                  ) : marginEUR != null && Number.isFinite(marginEUR) && marginEUR > 0 ? (
                    <span className="text-xs font-medium text-white/85">
                      +€{marginEUR.toFixed(2)} margin per sale
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-white/80">
                      <Sparkles className="size-3" aria-hidden />
                      Live on your storefront
                    </span>
                  )}
                </span>
              </span>
            </button>
          </div>
        </div>
      </form>

      {pricingGreenToast ? (
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[200] rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
          role="status"
        >
          {pricingGreenToast}
        </div>
      ) : null}
    </div>
  )
}

function LuxuryCollectionPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    void fetch("/api/luxe", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { collections?: Array<{ id: string; name: string }> } | null) => {
        if (data?.collections) setOptions(data.collections)
      })
      .catch(() => {})
  }, [])

  return (
    <label className="mt-3 block text-sm text-gray-800 dark:text-amber-100">
      <span className="font-medium">Collection Luxe</span>
      <select
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-zinc-950 dark:text-amber-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choisir une collection…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ListingBuilderModal({
  open,
  product,
  listing,
  storeSlug,
  onClose,
  onSaved,
  suggestedMarkupRate,
  enableAutosave = true,
  context = "catalog",
}: Props) {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  function onOverlayDown(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).dataset?.overlay === "1") closeRef.current()
  }

  if (!open || !product) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4",
        context === "swipe"
          ? "bg-zinc-950/70 backdrop-blur-md"
          : "bg-black/45 backdrop-blur-[2px]"
      )}
      role="presentation"
      data-overlay="1"
      onMouseDown={onOverlayDown}
    >
      {context === "swipe" ? (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-600/30 blur-[100px]" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-fuchsia-600/25 blur-[90px]" />
        </div>
      ) : null}
      <ListingBuilderModalBody
        key={`${product.id}-${listing?.id ?? "new"}`}
        product={product}
        listing={listing}
        storeSlug={storeSlug}
        onClose={onClose}
        onSaved={onSaved}
        suggestedMarkupRate={suggestedMarkupRate}
        enableAutosave={enableAutosave}
        context={context}
      />
    </div>
  )
}
