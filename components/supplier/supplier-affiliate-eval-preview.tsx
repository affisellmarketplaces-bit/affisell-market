"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  BadgePercent,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Layers,
  Package,
  Sparkles,
  Store,
  Truck,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { SupplierAffiliatePreviewProduct } from "@/lib/supplier-affiliate-preview-types"
import { listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { shippingCountryLabel } from "@/lib/product-shipping-display"
import { parseProductColorImagesFromDb } from "@/lib/product-color-images"
import {
  formatVariantCommissionRange,
  formatVariantWholesaleRange,
  variantSkuPricingSummary,
  variantsFromDb,
} from "@/lib/product-variants"
import { formatStoreCurrency, formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

const KIND_LABEL_EN: Record<string, string> = {
  PHYSICAL: "Physical",
  SOFTWARE: "Digital",
  SUBSCRIPTION: "Subscription",
}

const KIND_LABEL_FR: Record<string, string> = {
  PHYSICAL: "Physique",
  SOFTWARE: "Digital",
  SUBSCRIPTION: "Abonnement",
}

export type SupplierAffiliatePreviewPresentation = "supplier-dashboard" | "storefront-catalog"

export type AffiliateEvalExampleRow = {
  /** Opaque handle (e.g. APS-…); no storefront URL or partner identity. */
  partnerListingRef: string
}

type ProductShape = SupplierAffiliatePreviewProduct

function imgUnopt(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/uploads")
}

export function SupplierAffiliateEvalPreview({
  product,
  editHref,
  catalogHref,
  listedAffiliateCount,
  example,
  presentation = "supplier-dashboard",
  storeName,
}: {
  product: ProductShape
  editHref?: string
  catalogHref: string
  /** Distinct affiliates with a live listed offer for this SKU (AFFILIATE role). */
  listedAffiliateCount: number
  example: AffiliateEvalExampleRow | null
  presentation?: SupplierAffiliatePreviewPresentation
  storeName?: string
}) {
  const isCatalog = presentation === "storefront-catalog"
  const kindLabels = isCatalog ? KIND_LABEL_FR : KIND_LABEL_EN
  const gallery = useMemo(() => listingGalleryUrls([], product.images ?? []), [product.images])
  const [activeIdx, setActiveIdx] = useState(0)
  const [descOpen, setDescOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedPartnerRef, setCopiedPartnerRef] = useState(false)

  const hero = gallery[activeIdx] ?? gallery[0] ?? "/placeholder.png"
  const compareNum = product.compareAt != null ? Number(product.compareAt) : null
  const baseUsd = product.basePriceCents / 100
  const hasDeal = compareNum != null && Number.isFinite(compareNum) && compareNum > baseUsd
  const kindKey = String(product.listingKind ?? "").toUpperCase()
  const kindShort = kindLabels[kindKey] ?? kindKey.replace(/_/g, " ").toLowerCase()

  const variantSummary = variantsFromDb(product.variants)
  const skuPricing = useMemo(
    () => variantSkuPricingSummary(variantSummary, product.basePriceCents),
    [variantSummary, product.basePriceCents]
  )
  const colorRows = parseProductColorImagesFromDb(product.colorImages) ?? []
  const visible = product.active && !product.isDraft
  const desc = product.description?.trim() ?? ""
  const descLong = desc.length > 420

  async function copyId() {
    try {
      await navigator.clipboard.writeText(product.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function copyPartnerRef() {
    if (!example) return
    try {
      await navigator.clipboard.writeText(example.partnerListingRef)
      setCopiedPartnerRef(true)
      window.setTimeout(() => setCopiedPartnerRef(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const checklist = isCatalog
    ? [
        { ok: visible, label: visible ? "Visible dans Discover" : "Non publié" },
        { ok: product.stock > 0, label: product.stock > 0 ? "En stock" : "Rupture" },
        { ok: product.commissionRate > 0, label: "Commission configurée" },
        {
          ok: Boolean(product.shippingCountry || product.shippingType),
          label: "Expédition renseignée",
        },
      ]
    : [
        { ok: visible, label: visible ? "Discoverable by partners" : "Not yet discoverable" },
        { ok: product.stock > 0, label: product.stock > 0 ? "In stock" : "Zero stock" },
        { ok: product.commissionRate > 0, label: "Commission configured" },
        {
          ok: Boolean(product.shippingCountry || product.shippingType),
          label: "Shipping context set",
        },
      ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100/90 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/95">
      {/* App bar */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href={catalogHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {isCatalog ? "Retour au catalogue" : "Products"}
          </Link>
          <div className="hidden h-4 w-px bg-zinc-200 sm:block dark:bg-zinc-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
              {isCatalog ? "Fiche catalogue partenaires" : "Partner preview"}
            </p>
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {storeName ? (
                <>
                  <span className="text-zinc-500 dark:text-zinc-400">{storeName} · </span>
                  {product.name}
                </>
              ) : (
                product.name
              )}
            </p>
          </div>
          {!isCatalog && editHref ? (
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => void copyId()}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5 border-zinc-200 font-normal dark:border-zinc-700"
                )}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? "Copied" : "Product ID"}
              </button>
              <Link
                href={editHref}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                )}
              >
                Edit listing
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* Lens callout — compact */}
        <div className="flex flex-col gap-4 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-teal-50/40 p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-teal-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/25">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                {isCatalog ? "Ce que voient les créateurs affiliés" : "How partners read your SKU"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {isCatalog ? (
                  <>
                    Prix catalogue, commission et logistique — la même lecture que dans Discover avant d&apos;ajouter le
                    SKU à leur boutique. Ce n&apos;est pas la fiche acheteur (panier / checkout).
                  </>
                ) : (
                  <>
                    Economics and catalog facts they use before listing—
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">not</span> the shopper cart.
                    Checkout only appears on a live partner listing.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-medium text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100">
              {kindShort}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                visible
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              )}
            >
              {visible
                ? isCatalog
                  ? "Publié"
                  : "Published"
                : product.isDraft
                  ? isCatalog
                    ? "Brouillon"
                    : "Draft"
                  : isCatalog
                    ? "En pause"
                    : "Paused"}
            </span>
          </div>
        </div>

        {!visible ? (
          <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            {product.isDraft
              ? "Partners won’t see this SKU until you publish and activate it."
              : "This SKU is hidden from partner discovery while inactive."}
          </div>
        ) : null}

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Media column */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-50 shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
                <Image
                  src={hero}
                  alt=""
                  fill
                  className="object-contain p-6"
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  priority
                  unoptimized={imgUnopt(hero)}
                />
              </div>
              {gallery.length > 1 ? (
                <div className="border-t border-zinc-200/80 bg-white/90 p-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Gallery · {gallery.length} assets
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {gallery.map((url, i) => (
                      <button
                        key={`${url}-${i}`}
                        type="button"
                        onClick={() => setActiveIdx(i)}
                        className={cn(
                          "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition",
                          i === activeIdx
                            ? "border-violet-600 ring-2 ring-violet-500/30"
                            : "border-zinc-200 opacity-80 hover:opacity-100 dark:border-zinc-700"
                        )}
                      >
                        <Image src={url} alt="" fill className="object-cover" unoptimized={imgUnopt(url)} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Partner readiness */}
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <Package className="h-3.5 w-3.5" aria-hidden />
                {isCatalog ? "État catalogue" : "Partner readiness"}
              </p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {checklist.map((row) => (
                  <li key={row.label} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2
                      className={cn("h-4 w-4 shrink-0", row.ok ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-300 dark:text-zinc-600")}
                      aria-hidden
                    />
                    {row.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sticky briefing column */}
          <div className="lg:col-span-5">
            <div className="space-y-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
              <div>
                <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl lg:text-[1.65rem] lg:leading-tight">
                  {product.name}
                </h1>
                {desc ? (
                  <div className="mt-4">
                    <div
                      className={cn(
                        "relative text-sm leading-relaxed text-zinc-600 dark:text-zinc-400",
                        !descOpen && descLong && "max-h-[7.5rem] overflow-hidden"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{desc}</p>
                      {!descOpen && descLong ? (
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent dark:from-zinc-950" />
                      ) : null}
                    </div>
                    {descLong ? (
                      <button
                        type="button"
                        onClick={() => setDescOpen((o) => !o)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 dark:text-violet-400 dark:hover:text-violet-300"
                      >
                        {descOpen ? (
                          <>
                            Show less <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          </>
                        ) : (
                          <>
                            Full description <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-500">No description on file.</p>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <Box className="h-3 w-3" aria-hidden />
                    {isCatalog ? "Prix catalogue" : "Catalog anchor"}
                  </p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {formatStoreCurrencyFromCents(product.basePriceCents)}
                  </p>
                  {hasDeal && compareNum != null ? (
                    <p className="text-compare-at mt-1 text-xs tabular-nums line-through">
                      {formatStoreCurrency(compareNum)}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-violet-200/90 bg-violet-50/80 p-4 dark:border-violet-900/60 dark:bg-violet-950/40">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    <BadgePercent className="h-3 w-3" aria-hidden />
                    {isCatalog ? "Commission offerte" : "Commission offered"}
                  </p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-violet-950 dark:text-violet-100">
                    {skuPricing ? formatVariantCommissionRange(skuPricing) : `${product.commissionRate}%`}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-violet-800/90 dark:text-violet-200/80">
                    {skuPricing ? "Par choix SKU (lignes)" : "Part de la marge partenaire"}
                  </p>
                </div>
                <div className="col-span-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {isCatalog ? "Stock" : "Inventory"}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-white">
                    {product.stock} {isCatalog ? "unités" : "units"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {isCatalog
                      ? "Signal de disponibilité visible dans Discover."
                      : "Partners inherit this stock signal in their tools."}
                  </p>
                </div>
              </div>

              {skuPricing ? (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    Tarifs par choix (SKU lines) — coût fournisseur &amp; commission
                  </p>
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Choix</th>
                        <th className="px-3 py-2">Coût</th>
                        <th className="px-3 py-2">Comm.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skuPricing.rows.map((row) => (
                        <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{row.name}</td>
                          <td className="px-3 py-2 tabular-nums text-zinc-700 dark:text-zinc-300">
                            {formatStoreCurrencyFromCents(
                              row.priceCents > 0 ? row.priceCents : product.basePriceCents
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-violet-800 dark:text-violet-300">
                            {row.commission}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800">
                    Fourchette coût :{" "}
                    {formatVariantWholesaleRange(skuPricing, formatStoreCurrencyFromCents)} · Commission :{" "}
                    {formatVariantCommissionRange(skuPricing)}
                  </p>
                </div>
              ) : null}

              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Partners set their own resale price and storefront presentation; those shopper-facing details are not
                shown here for partner confidentiality.
              </p>

              {listedAffiliateCount > 0 ? (
                <div className="rounded-2xl border border-teal-200/90 bg-gradient-to-br from-teal-50 to-white p-5 dark:border-teal-900/60 dark:from-teal-950/40 dark:to-zinc-950">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white">
                      <Store className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-teal-950 dark:text-teal-50">
                        {isCatalog ? "Créateurs qui listent" : "Partner listings"}
                      </p>
                      <p className="mt-2 text-3xl font-bold tabular-nums text-teal-950 dark:text-teal-50">
                        {listedAffiliateCount}
                      </p>
                      <p className="mt-1 text-xs font-medium text-teal-900/95 dark:text-teal-100/95">
                        {isCatalog
                          ? listedAffiliateCount === 1
                            ? "créateur a ce produit en boutique live"
                            : "créateurs ont ce produit en boutique live"
                          : listedAffiliateCount === 1
                            ? "affiliate has this product in a live shop listing"
                            : "affiliates have this product in live shop listings"}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-teal-900/90 dark:text-teal-100/90">
                        For confidentiality, you cannot see their names, resale prices, or storefronts from this screen.
                      </p>
                      {!isCatalog && example ? (
                        <>
                          <p className="mt-3 text-xs leading-relaxed text-teal-900/85 dark:text-teal-100/85">
                            <span className="font-semibold text-teal-950 dark:text-teal-100">Affisell reference</span>{" "}
                            (one recent listing; for support only):{" "}
                            <code className="rounded bg-teal-100/80 px-1.5 py-0.5 font-mono text-[11px] text-teal-950 dark:bg-teal-900/50 dark:text-teal-50">
                              {example.partnerListingRef}
                            </code>
                          </p>
                          <button
                            type="button"
                            onClick={() => void copyPartnerRef()}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "mt-3 gap-1.5 border-teal-300 text-teal-900 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-100 dark:hover:bg-teal-950/50"
                            )}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            {copiedPartnerRef ? "Copied" : "Copy reference"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : visible ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-4 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">No partner listing yet</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    When a partner publishes this product, you will see an Affisell-only reference here confirming that a
                    listing exists—without their identity, resale price, or shop link.
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  Catalog facts · inherited
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {kindShort}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    <Truck className="h-3 w-3 text-zinc-500" aria-hidden />
                    ~{product.deliveryMin}–{product.deliveryMax}d · {product.handlingDays}d handle ·{" "}
                    <span className="capitalize">{product.shippingType}</span>
                  </span>
                  <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                    {shippingCountryLabel(product.shippingCountry)}
                  </span>
                </div>
                {(product.categories?.length ?? 0) > 0 ? (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Categories</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {product.categories.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {(variantSummary?.size?.length ?? 0) > 0 || colorRows.length > 0 ? (
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                    Variants and colorways from your listing flow through when partners publish.
                  </p>
                ) : null}
                {(product.tags?.length ?? 0) > 0 ? (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {product.tags.slice(0, 16).map((t) => (
                        <span key={t} className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
