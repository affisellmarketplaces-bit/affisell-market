"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Zap } from "lucide-react"
import { toast } from "sonner"

import { BentoShell } from "@/components/affisell/bento-ui"
import { CategoryAutosuggest } from "@/components/product/CategoryAutosuggest"
import { SmartMarginAiPanel } from "@/components/supplier/smart-margin-ai-panel"
import { ProductLivePreview } from "@/components/supplier/product-live-preview"
import type { BrowsePayload } from "@/components/supplier/supplier-category-picker"
import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"
import { WizardV2Chrome } from "@/components/supplier/wizard-v2/wizard-v2-chrome"
import { WizardV2ZeroWaitUpload } from "@/components/supplier/wizard-v2/wizard-v2-zero-wait-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  trackWizardV2Abandon,
  trackWizardV2PublishBlocked,
  trackWizardV2PublishSuccess,
  trackWizardV2StepComplete,
  trackWizardV2View,
} from "@/lib/analytics/wizard-v2-posthog"
import { buildWizardV2PublishBody } from "@/lib/product-wizard-v2/build-publish-payload"
import type { ProductVariantInput } from "@/lib/product-variant-sku"
import { stripDescriptionImageMarkers, stripImportOptionsFromDescription } from "@/lib/description-rich-content"
import { advancedSkuRowsFromExpressImport } from "@/lib/express-handoff-skus"
import {
  hasShopifyIntegration,
  shopifyDomainFromIntegrations,
} from "@/lib/product-wizard-v2/shopify-detect"
import { resolveWizardV2Mode } from "@/lib/product-wizard-v2/feature-flag"
import {
  supplierExpressHandoffWizardUrl,
  writeSupplierAddProductDraftCache,
  type SupplierSimpleColorRow,
} from "@/lib/supplier-add-product-draft-cache"
import { DELIVERY_WORLDWIDE } from "@/lib/supplier-delivery-countries"
import { buildUrlImportFormPatch, type UrlImportFormPatch } from "@/lib/url-import-apply"
import { publishBlockedUploadMessage } from "@/lib/upload/zero-wait-uploader"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

type MerchantDefaults = {
  countryCode: string | null
  warehouseType: string | null
  offerMode: string | null
  defaultCommissionPct: number | null
}

type Props = {
  ownerUserId: string
}

export function SupplierProductWizardV2({ ownerUserId }: Props) {
  const { push, replace, mounted } = useSafeAppRouter()
  const searchParams = useSearchParams()
  const mode = resolveWizardV2Mode(searchParams.get("mode"))
  const startedAt = useRef(Date.now())
  const stepStartedAt = useRef(Date.now())

  const [defaults, setDefaults] = useState<MerchantDefaults | null>(null)
  const [shopifyDomain, setShopifyDomain] = useState<string | null>(null)
  const [browse, setBrowse] = useState<BrowsePayload | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [skuVariants, setSkuVariants] = useState<{
    hasVariants: boolean
    variants: ProductVariantInput[]
  } | null>(null)
  const [expressImportPatch, setExpressImportPatch] = useState<UrlImportFormPatch | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [categoryBreadcrumb, setCategoryBreadcrumb] = useState("")
  const [price, setPrice] = useState("")
  const [expressUrl, setExpressUrl] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [commissionPct, setCommissionPct] = useState(15)
  const lastStepRef = useRef(mode === "express" ? "express" : "pro")

  useEffect(() => {
    trackWizardV2View({ mode, entry_point: "compose" })
    return () => {
      trackWizardV2Abandon({
        mode,
        last_step: lastStepRef.current,
        duration_ms: Date.now() - startedAt.current,
      })
    }
  }, [mode])

  useEffect(() => {
    if (!mounted) return
    const raw = searchParams.get("mode")?.trim().toLowerCase()
    if (raw !== "guided" && raw !== "instantscan") return
    const qs = new URLSearchParams(searchParams.toString())
    qs.set("wizard", "v2")
    qs.set("mode", "express")
    replace(`/dashboard/supplier/products/new?${qs.toString()}`, { scroll: false })
  }, [mounted, replace, searchParams])

  useEffect(() => {
    void fetch("/api/supplier/merchant-defaults", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { defaults?: MerchantDefaults } | null) => {
        if (j?.defaults) setDefaults(j.defaults)
      })
      .catch(() => {})

    void fetch("/api/categories/browse?lite=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: BrowsePayload | null) => {
        if (j?.nodes) setBrowse(j)
      })
      .catch(() => {})

    void fetch("/api/supplier/integrations", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) return
        const integrations = rows
          .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
          .map((r) => ({
            platform: String(r.platform ?? ""),
            shopDomain:
              typeof (r.config as Record<string, unknown> | undefined)?.shop === "string"
                ? String((r.config as Record<string, unknown>).shop)
                : null,
            name: typeof r.name === "string" ? r.name : null,
          }))
        if (hasShopifyIntegration(integrations)) {
          setShopifyDomain(shopifyDomainFromIntegrations(integrations))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (defaults?.defaultCommissionPct != null) {
      setCommissionPct(defaults.defaultCommissionPct)
    }
  }, [defaults?.defaultCommissionPct])

  const catalogPriceEur = useMemo(() => {
    const n = Number(price)
    if (Number.isFinite(n) && n > 0) return n
    return 0
  }, [price])

  const previewDescription = useMemo(
    () => stripDescriptionImageMarkers(description),
    [description]
  )

  const previewData = useMemo(
    () => ({
      name,
      description: previewDescription,
      price: Number(price) || 0,
      imageUrl: images[0] ?? null,
    }),
    [name, previewDescription, price, images]
  )

  const completeStep = useCallback(
    (step: string) => {
      trackWizardV2StepComplete({
        step,
        duration_ms: Date.now() - stepStartedAt.current,
        method: mode,
      })
      stepStartedAt.current = Date.now()
    },
    [mode]
  )

  const handleApplySmartMargin = useCallback(
    (margin: number) => {
      setCommissionPct(margin)
      completeStep("smart_margin")
    },
    [completeStep]
  )

  const openFullWizardPrefilled = useCallback(() => {
    if (!name.trim()) {
      toast.error("Importez d'abord un produit")
      return
    }

    const patch = expressImportPatch
    const simpleColorRows: SupplierSimpleColorRow[] =
      patch?.variants.mode === "simple"
        ? (patch.variants.simpleColors ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            image: row.image,
          }))
        : []

    const advancedSkuRows = advancedSkuRowsFromExpressImport({ skuVariants, patch })
    const hasAdvancedSkus = advancedSkuRows.length >= 2
    const cleanDescription = stripImportOptionsFromDescription(
      stripDescriptionImageMarkers(description.trim())
    )

    writeSupplierAddProductDraftCache(ownerUserId, {
      mode: "compose",
      step: hasAdvancedSkus ? 2 : 1,
      name: name.trim(),
      description: cleanDescription,
      categoryId: categoryId.trim(),
      images,
      price: price.trim(),
      compareAt: patch?.compareAt ?? "",
      stock:
        patch?.stock ??
        String(
          skuVariants?.hasVariants
            ? skuVariants.variants.reduce((acc, row) => acc + Math.max(0, row.stock), 0)
            : 99
        ),
      listingKind: "PHYSICAL",
      commission: String(commissionPct),
      shippingCountry: patch?.shippingCountry || defaults?.countryCode || "FR",
      warehouseType:
        patch?.warehouseType ||
        (defaults?.warehouseType === "local" ||
        defaults?.warehouseType === "regional" ||
        defaults?.warehouseType === "international"
          ? defaults.warehouseType
          : "regional"),
      deliveryCountryCodes: [DELIVERY_WORLDWIDE],
      processingTime: patch?.processingTime ?? "1",
      deliveryMin: patch?.deliveryMin ?? "2",
      deliveryMax: patch?.deliveryMax ?? "7",
      shippingCost: patch?.shippingCost ?? "0",
      shipsFrom: "",
      deliveryDays: "",
      freeShipping: patch?.shippingCost === "0",
      offerMode: defaults?.offerMode ?? "NEW",
      minOrderQuantity: 1,
      supplierTag: "express-import",
      specValues: patch?.specValuesPatch ?? {},
      descriptionBullets: [],
      descriptionIllustrationImages:
        patch?.illustrationImages?.length
          ? patch.illustrationImages
          : images.slice(1, 24),
      descriptionIllustrationVideos: patch?.illustrationVideos ?? [],
      variantFormMode: hasAdvancedSkus
        ? "advanced"
        : patch?.variants.mode === "simple"
          ? "simple"
          : "none",
      variantSizesText:
        patch?.variants.mode === "simple" ? patch.variants.sizes.join(", ") : "",
      variantColorsText:
        patch?.variants.mode === "simple" ? simpleColorRows.map((row) => row.name).join(", ") : "",
      simpleColorRows,
      variantRows: [],
      advancedSkuRows,
      skuCustomColumns: [],
      skuHiddenColumns: [],
    })

    push(supplierExpressHandoffWizardUrl())
  }, [
    categoryId,
    commissionPct,
    defaults?.countryCode,
    defaults?.offerMode,
    defaults?.warehouseType,
    description,
    expressImportPatch,
    images,
    name,
    ownerUserId,
    price,
    push,
    skuVariants,
  ])

  const runExpressImport = useCallback(async () => {
    if (publishing) return
    const u = expressUrl.trim()
    if (!/^https?:\/\//i.test(u)) {
      toast.error("URL invalide")
      return
    }
    setPublishing(true)
    try {
      const res = await fetch("/api/import-china", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: u, options: { aiRewrite: true, markup: 2.5, fast: true } }),
      })
      const data = (await res.json()) as {
        products?: unknown[]
        error?: string
        warnings?: string[]
        method?: string
        category?: { leafId?: string | null; breadcrumb?: string } | null
        skuVariants?: {
          hasVariants?: boolean
          variants?: ProductVariantInput[]
        } | null
      }
      if (!res.ok) throw new Error(data.error ?? "import_failed")
      const raw = Array.isArray(data.products) ? data.products[0] : null
      const p =
        raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
      if (!p) throw new Error("no_product")
      const patch = buildUrlImportFormPatch(p, {
        markup: 2.5,
        categoryAttrs: [],
        commissionPct: String(defaults?.defaultCommissionPct ?? 15),
      })
      setExpressImportPatch(patch)
      const title =
        patch.name.trim() ||
        (typeof p.ai_title === "string" ? p.ai_title.trim() : "") ||
        (typeof p.title === "string" ? p.title.trim() : "")
      if (!title) throw new Error("Titre introuvable — réessayez ou passez en mode Pro")
      setName(title.slice(0, 500))
      setDescription(
        stripImportOptionsFromDescription(stripDescriptionImageMarkers(patch.description))
      )
      if (patch.price) setPrice(String(patch.price))
      const catFromProduct =
        (typeof p.categoryId === "string" && p.categoryId.trim()) ||
        data.category?.leafId?.trim() ||
        ""
      if (catFromProduct) {
        setCategoryId(catFromProduct)
        setCategoryBreadcrumb(
          (typeof p.categoryBreadcrumb === "string" && p.categoryBreadcrumb) ||
            data.category?.breadcrumb ||
            ""
        )
      } else if (patch.categoryId) {
        setCategoryId(patch.categoryId)
        setCategoryBreadcrumb(patch.categoryBreadcrumb ?? "")
      }
      setImages(patch.images)
      const markup = 2.5
      const commission = defaults?.defaultCommissionPct ?? 15
      if (data.skuVariants?.hasVariants && Array.isArray(data.skuVariants.variants)) {
        const scaled = data.skuVariants.variants.map((v) => ({
          ...v,
          supplierPrice: Math.round(v.supplierPrice * markup * 100) / 100,
          publicPrice: Math.round((v.publicPrice ?? v.supplierPrice) * markup * 100) / 100,
          commissionRate: commission,
        }))
        setSkuVariants({ hasVariants: true, variants: scaled })
      } else {
        setSkuVariants(null)
      }
      setShowAdvanced(true)
      completeStep("express_import")
      const warn = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : []
      if (warn[0]) toast.message(warn[0], { duration: 5000 })
      const imgN = patch.images.length
      const specN =
        p.specs && typeof p.specs === "object" && !Array.isArray(p.specs)
          ? Object.keys(p.specs as object).length
          : 0
      toast.success(
        data.method?.includes("aliexpress")
          ? `AliExpress importé — ${imgN} photo${imgN > 1 ? "s" : ""}, ${specN} caractéristique${specN > 1 ? "s" : ""}`
          : "Produit importé — vérifiez l'aperçu"
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible")
    } finally {
      setPublishing(false)
    }
  }, [completeStep, defaults?.defaultCommissionPct, expressUrl, publishing])

  const publish = useCallback(async () => {
    if (publishing) return
    if (!defaults) {
      toast.error("Chargement des préférences…")
      return
    }
    if (uploadBusy) {
      const msg = publishBlockedUploadMessage(
        images.map((url, i) => ({
          id: String(i),
          fileName: "image",
          status: "uploading" as const,
          progress: 50,
          previewUrl: url,
          durableUrl: url.startsWith("http") ? url : null,
          error: null,
        }))
      )
      trackWizardV2PublishBlocked({ mode, reason: msg ?? "upload_busy", field: "images" })
      toast.error(msg ?? "Upload en cours")
      return
    }
    if (!name.trim()) {
      trackWizardV2PublishBlocked({ mode, reason: "missing_name", field: "name" })
      toast.error("Titre requis")
      return
    }
    if (!categoryId.trim()) {
      trackWizardV2PublishBlocked({ mode, reason: "missing_category", field: "category" })
      toast.error("Catégorie requise — choisissez une catégorie ou passez en mode Pro")
      return
    }
    if (images.length === 0 || !images[0]?.startsWith("http")) {
      trackWizardV2PublishBlocked({ mode, reason: "images_not_ready", field: "images" })
      toast.error("Photo CDN requise")
      return
    }
    const priceN = Number(price)
    if (!Number.isFinite(priceN) || priceN <= 0) {
      trackWizardV2PublishBlocked({ mode, reason: "invalid_price", field: "price" })
      toast.error("Prix catalogue invalide")
      return
    }

    setPublishing(true)
    try {
      const body = buildWizardV2PublishBody(
        {
          name,
          description: stripDescriptionImageMarkers(description),
          price: priceN,
          categoryId,
          images,
          commission: commissionPct,
          descriptionIllustrationImages: expressImportPatch?.illustrationImages,
          skuVariants,
        },
        defaults
      )

      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string; id?: string }
      if (!res.ok) throw new Error(data.error ?? "publish_failed")

      void fetch("/api/supplier/gamification/award-product", {
        method: "POST",
        credentials: "include",
      }).catch((e) => {
        console.warn("[wizard-v2] award-product", e instanceof Error ? e.message : String(e))
      })

      trackWizardV2PublishSuccess({
        mode,
        duration_total_ms: Date.now() - startedAt.current,
        ai_used: false,
        image_count: images.length,
      })

      toast.success("🎉 Produit publié — +10 XP")
      push("/dashboard/supplier/products")
    } catch (err) {
      const reason = err instanceof Error ? err.message : "publish_failed"
      trackWizardV2PublishBlocked({ mode, reason, field: "api" })
      toast.error(reason)
    } finally {
      setPublishing(false)
    }
  }, [
    categoryId,
    commissionPct,
    defaults,
    description,
    expressImportPatch,
    images,
    mode,
    name,
    price,
    publishing,
    push,
    skuVariants,
    uploadBusy,
  ])

  if (mode === "pro") {
    return (
      <BentoShell>
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <WizardV2Chrome mode="pro" ownerUserId={ownerUserId} shopifyDomain={shopifyDomain} />
          <SupplierAddProductForm ownerUserId={ownerUserId} embeddedInWizardV2 />
        </div>
      </BentoShell>
    )
  }

  return (
    <BentoShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <WizardV2Chrome mode="express" ownerUserId={ownerUserId} shopifyDomain={shopifyDomain} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="express-heading" className="space-y-4">
              <h2 id="express-heading" className="flex items-center gap-2 text-lg font-semibold">
                <Zap className="h-5 w-5 text-amber-500" aria-hidden />
                Express — collez une URL
              </h2>
              <Label htmlFor="express-url">URL produit (AliExpress, Shopify, marketplace…)</Label>
              <Input
                id="express-url"
                value={expressUrl}
                onChange={(e) => setExpressUrl(e.target.value)}
                placeholder="https://www.aliexpress.com/item/… ou Shopify"
                className="h-11"
              />
              <Button type="button" disabled={publishing} onClick={() => void runExpressImport()}>
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Analyser l&apos;URL
              </Button>
              <p className="text-xs text-zinc-500">
                AliExpress : API officielle si connectée, sinon analyse directe de la page (fr / www).
                Shopify et autres marketplaces restent en scrape Express. Mode Pro pour une fiche manuelle.
              </p>
            </section>

            <div className="space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              {images.length === 0 ? (
                <WizardV2ZeroWaitUpload onUrlsChange={setImages} onBusyChange={setUploadBusy} />
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.slice(0, 12).map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  ))}
                  {images.length > 12 ? (
                    <span className="flex h-16 items-center text-xs text-zinc-500">
                      +{images.length - 12}
                    </span>
                  ) : null}
                </div>
              )}
              <div>
                <Label htmlFor="v2-express-name">Titre</Label>
                <Input
                  id="v2-express-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="v2-express-desc">Description & caractéristiques</Label>
                <textarea
                  id="v2-express-desc"
                  className="mt-1 min-h-[120px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={description}
                  onChange={(e) => setDescription(stripDescriptionImageMarkers(e.target.value))}
                />
                {images.length > 1 ? (
                  <p className="text-xs text-zinc-500">
                    {images.length} photos dans la galerie — elles s&apos;affichent dans l&apos;aperçu et
                    à la publication (plus de balises [[img:N]]).
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="v2-express-price">Prix (EUR)</Label>
                <Input
                  id="v2-express-price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                {categoryId && categoryBreadcrumb ? (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    {categoryBreadcrumb}
                  </p>
                ) : null}
                <CategoryAutosuggest
                  title={name}
                  description={description}
                  imageUrl={images[0] ?? null}
                  browse={browse}
                  categoryId={categoryId}
                  onChange={(leafId, path) => {
                    setCategoryId(leafId)
                    setCategoryBreadcrumb(path.map((s) => s.name).join(" > "))
                  }}
                />
              </div>
              {skuVariants?.hasVariants ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {skuVariants.variants.length} variantes SKU importées — synchronisées à la
                  publication
                </p>
              ) : null}

              {(categoryId || name.trim()) && catalogPriceEur > 0 ? (
                <SmartMarginAiPanel
                  categoryId={categoryId}
                  title={name}
                  catalogPriceEur={catalogPriceEur}
                  currentMargin={commissionPct}
                  onApplyMargin={handleApplySmartMargin}
                />
              ) : null}

              <button
                type="button"
                className="text-sm font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((v) => !v)}
              >
                Avancé — logistique & commission
              </button>
              {showAdvanced && defaults ? (
                <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                  <p>Pays : {defaults.countryCode}</p>
                  <p>Zone : {defaults.warehouseType}</p>
                  <p>Commission affiliés : {commissionPct} %</p>
                  {expressImportPatch ? (
                    <Button type="button" variant="outline" onClick={openFullWizardPrefilled}>
                      Ouvrir tous les détails préremplis
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600"
                disabled={publishing || uploadBusy}
                onClick={() => void publish()}
              >
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Publier le produit
              </Button>
              <p className="text-xs text-zinc-500">
                {expressImportPatch ? (
                  <button
                    type="button"
                    className="mb-2 block text-left font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                    onClick={openFullWizardPrefilled}
                  >
                    Compléter automatiquement le reste des détails dans le wizard complet
                  </button>
                ) : null}
                <a href="?wizard=v1&compose=1" className="underline">
                  Ouvrir le wizard classique (v1)
                </a>
              </p>
            </div>
          </div>

          <ProductLivePreview data={previewData} variant="sidebar" />
        </div>
        <ProductLivePreview data={previewData} variant="drawer" />
      </div>
    </BentoShell>
  )
}
