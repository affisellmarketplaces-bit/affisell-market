"use client"

import Image from "next/image"
import { ArrowRight, Loader2, Package, ShieldCheck, Truck } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { VariantSelector } from "@/app/marketplace/[id]/components/VariantSelector"
import { SizeSelector } from "@/app/marketplace/[id]/components/SizeSelector"
import { ProductListingColorPicker } from "@/components/product/product-listing-color-picker"
import {
  resolveAffiliateSellingPriceCentsForOption,
  type AffiliateVariantPricingMap,
} from "@/lib/affiliate-variant-pricing"
import type { ResellerBoutiqueProductDetail } from "@/lib/boutique/load-reseller-storefront.server"
import { formatResellerVariantOptionsLabel } from "@/lib/boutique/reseller-listing-variants-shared"
import {
  buildMarketplaceColorMeta,
  shouldShowMarketplaceColorSwatches,
} from "@/lib/marketplace-color-meta"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { resolveListingAvailableStock } from "@/lib/marketplace-purchase-quantity"
import {
  findVariantRowForShopperSelection,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import { resolveColorHeroImageUrl } from "@/lib/product-color-images"
import { cn } from "@/lib/utils"

type Props = {
  storeSlug: string
  product: ResellerBoutiqueProductDetail
}

type CreateResellerOrderResponse = {
  success?: boolean
  checkoutUrl?: string
  orderId?: string
  marginCents?: number
  error?: string
}

const ORDER_ERROR_HINTS: Record<string, string> = {
  out_of_stock: "Ce produit est en rupture de stock.",
  affiliate_commission_required: "Commission fournisseur manquante — contactez le support.",
  stripe_minimum_not_met: "Montant trop faible pour Stripe (min. 0,50 €).",
  delivery_destination_unavailable: "Livraison indisponible pour ce produit.",
  stripe_unavailable: "Paiement temporairement indisponible.",
  stripe_session_failed: "Session Stripe impossible — réessayez.",
  listing_not_found: "Produit introuvable ou non listé.",
  invalid_variant: "Cette combinaison de variantes n'est pas disponible.",
}

const brandedChipSelected =
  "border-transparent text-white shadow-md [background-image:var(--boutique-button-gradient)]"

export function ResellerBoutiqueProductDetailPanel({ storeSlug, product }: Props) {
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.defaultSelection.selectedColor
  )
  const [selectedSize, setSelectedSize] = useState<string | null>(
    product.defaultSelection.selectedSize
  )
  const [selectedStorage, setSelectedStorage] = useState<string | null>(
    product.defaultSelection.selectedStorage
  )
  const [loading, setLoading] = useState(false)

  const colorMeta = useMemo(
    () => buildMarketplaceColorMeta(product.colorNames, product.colorImages),
    [product.colorImages, product.colorNames]
  )
  const showColorSwatches = shouldShowMarketplaceColorSwatches(colorMeta)
  const variantPricing = (product.variantPricing ?? {}) as AffiliateVariantPricingMap

  const shopperSelection: ShopperVariantSelection = useMemo(
    () => ({
      selectedPrimary: selectedColor,
      selectedStorage,
      selectedSize,
    }),
    [selectedColor, selectedSize, selectedStorage]
  )

  const activeVariantRow = useMemo(
    () =>
      findVariantRowForShopperSelection({
        variants: product.variants,
        customColumns: product.customColumns,
        selection: shopperSelection,
      }),
    [product.customColumns, product.variants, shopperSelection]
  )

  const activePriceCents = useMemo(() => {
    const optionName = activeVariantRow?.name?.trim() || selectedColor
    return resolveAffiliateSellingPriceCentsForOption({
      listingSellingPriceCents: product.listingPriceCents,
      productBasePriceCents: product.basePriceCents,
      variants: product.variants,
      optionName,
      variantPricing,
    })
  }, [
    activeVariantRow?.name,
    product.basePriceCents,
    product.listingPriceCents,
    product.variants,
    selectedColor,
    variantPricing,
  ])

  const resolvedStock = activeVariantRow
    ? Math.max(0, Math.round(activeVariantRow.stock) || 0)
    : resolveListingAvailableStock({
        productStock: product.catalogStock,
        variants: product.variants,
        selectedColor,
        selectedSize,
      })

  const isOutOfStock = resolvedStock <= 0
  const priceLabel = formatStoreCurrencyFromCents(activePriceCents)
  const optionsLabel = formatResellerVariantOptionsLabel(product.variantSummary)

  const heroUrl = useMemo(
    () =>
      resolveColorHeroImageUrl(selectedColor, product.colorNames, product.colorImages, product.gallery) ||
      product.gallery[0] ||
      product.imageUrl,
    [product.colorImages, product.colorNames, product.gallery, product.imageUrl, selectedColor]
  )

  const handleBuyNow = useCallback(async () => {
    if (isOutOfStock) return

    setLoading(true)
    try {
      const res = await fetch("/api/store/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          productId: product.listingId,
          selectedColor,
          selectedSize,
          selectedStorage,
        }),
      })
      const data = (await res.json()) as CreateResellerOrderResponse
      if (!res.ok || !data.success || !data.checkoutUrl) {
        toast.error("Commande impossible", {
          description:
            (data.error && ORDER_ERROR_HINTS[data.error]) ||
            "Réessayez dans un instant.",
        })
        return
      }

      window.location.assign(data.checkoutUrl)
    } catch {
      toast.error("Erreur réseau", { description: "Vérifiez votre connexion." })
    } finally {
      setLoading(false)
    }
  }, [isOutOfStock, product.listingId, selectedColor, selectedSize, selectedStorage, storeSlug])

  const hasVariantPickers =
    product.variantSummary.hasMultipleOptions ||
    colorMeta.length > 0 ||
    product.sizeOptions.length > 0 ||
    product.storageOptions.length > 0

  return (
    <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
      <div
        className="overflow-hidden rounded-[1.75rem] border shadow-lg backdrop-blur-sm"
        style={{
          backgroundColor: "var(--boutique-card-bg)",
          borderColor: "var(--boutique-card-border)",
        }}
      >
        <div className="relative aspect-square" style={{ background: "var(--boutique-card-image-bg)" }}>
          <Image
            src={heroUrl}
            alt={product.title}
            fill
            className="object-contain p-6 transition duration-500"
            sizes="(max-width: 1024px) 100vw, 560px"
            priority
            unoptimized={heroUrl.startsWith("http") || heroUrl.startsWith("/uploads")}
          />
        </div>
        {product.gallery.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-t p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {product.gallery.slice(0, 8).map((url) => (
              <div
                key={url}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border",
                  url === heroUrl ? "ring-2 ring-[var(--boutique-hero-accent)]" : "opacity-80"
                )}
                style={{ borderColor: "var(--boutique-card-border)" }}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-contain p-1"
                  sizes="64px"
                  unoptimized={url.startsWith("http") || url.startsWith("/uploads")}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="rounded-[1.75rem] border p-6 backdrop-blur-xl sm:p-8"
        style={{
          backgroundColor: "var(--boutique-card-bg)",
          borderColor: "var(--boutique-card-border)",
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--boutique-header-muted)" }}
        >
          {optionsLabel ?? "Produit"}
        </p>
        <h2
          className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--boutique-card-title)" }}
        >
          {product.title}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p
            className="bg-clip-text text-3xl font-bold tabular-nums text-transparent"
            style={{ backgroundImage: "var(--boutique-price-gradient)" }}
          >
            {priceLabel}
          </p>
          <span
            className={
              isOutOfStock
                ? "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-800"
                : "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800"
            }
          >
            <Package className="h-3.5 w-3.5" aria-hidden />
            {isOutOfStock ? "Rupture de stock" : "En stock"}
          </span>
        </div>

        {hasVariantPickers ? (
          <div className="mt-6 space-y-4">
            <ProductListingColorPicker
              colorMeta={colorMeta}
              showColorSwatches={showColorSwatches}
              selectedColor={selectedColor}
              onSelectColor={setSelectedColor}
              colorLabel="Couleur"
              optionLabel="Option"
              variants={product.variants}
              customColumns={product.customColumns}
              selection={shopperSelection}
              listingPriceCents={product.listingPriceCents}
              variantPricing={variantPricing}
              basePriceCents={product.basePriceCents}
              sizeOptions={product.sizeOptions}
              brandedStorefront
              className="border-[var(--boutique-card-border)] bg-[var(--boutique-powered-bg)]"
            />
            <VariantSelector
              storageOptions={product.storageOptions}
              selectedStorage={selectedStorage}
              onSelectStorage={setSelectedStorage}
              storageLabel="Capacité"
              variants={product.variants}
              customColumns={product.customColumns}
              selection={shopperSelection}
              listingPriceCents={product.listingPriceCents}
              basePriceCents={product.basePriceCents}
              activeListingPriceCents={activePriceCents}
              brandedChipSelected={brandedChipSelected}
            />
            <SizeSelector
              sizeOptions={product.sizeOptions}
              selectedSize={selectedSize}
              onSelectSize={setSelectedSize}
              sizeLabel="Taille"
              isShoeProduct={false}
              productName={product.title}
              brandedChipSelected={brandedChipSelected}
            />
          </div>
        ) : null}

        {product.descriptionExcerpt ? (
          <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--boutique-card-muted)" }}>
            {product.descriptionExcerpt}
          </p>
        ) : null}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium"
            style={{
              borderColor: "var(--boutique-card-border)",
              backgroundColor: "var(--boutique-badge-bg)",
              color: "var(--boutique-card-title)",
            }}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            Paiement sécurisé Affisell
          </div>
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium"
            style={{
              borderColor: "var(--boutique-card-border)",
              backgroundColor: "var(--boutique-badge-bg)",
              color: "var(--boutique-card-title)",
            }}
          >
            <Truck className="h-4 w-4" style={{ color: "var(--boutique-hero-accent)" }} aria-hidden />
            Checkout reseller 1-clic
          </div>
        </div>

        {isOutOfStock ? (
          <button
            type="button"
            disabled
            aria-disabled
            className="mt-8 inline-flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 text-base font-bold text-zinc-500"
          >
            Rupture de stock
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleBuyNow()}
            className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundImage: "var(--boutique-button-gradient)",
              boxShadow: "var(--boutique-button-shadow)",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Création en cours…
              </>
            ) : (
              <>
                Acheter maintenant
                <ArrowRight className="h-5 w-5" aria-hidden />
              </>
            )}
          </button>
        )}
        <p className="mt-3 text-center text-[11px] opacity-70">
          {isOutOfStock
            ? "Cette variante est indisponible — choisissez une autre option."
            : "Commande reseller sécurisée — variante sélectionnée transmise au checkout."}
        </p>
      </div>
    </section>
  )
}
