"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bell,
  ChevronRight,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Fragment, useEffect, useMemo, useState, type MouseEvent } from "react"

import { Button } from "@/components/ui/button"
import messages from "@/messages/en.json"
import {
  COLORS,
  VARIANT_GROUP_LABELS,
  isMulticolorSwatch,
} from "@/lib/product-catalog-constants"
import { addGuestCartItem } from "@/lib/guest-cart"
import { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/marketplace-checkout-discount"
import {
  formatStoreCount,
  formatStoreCurrency,
  formatStoreCurrencyFromCents,
  formatStoreDate,
} from "@/lib/market-config"
import {
  comparableImageUrl,
  findColorImageRowForName,
  type ProductColorImageRow,
} from "@/lib/product-color-images"
import type { ProductVariantsJson } from "@/lib/product-variants"

const EMPTY_SIZE_OPTIONS: string[] = []

type StorefrontInfo = {
  name: string
  slug: string
  logoUrl: string | null
  showTrustedSoldBy: boolean
}

export type ListingShippingBlock = {
  deliveryMin: number
  deliveryMax: number
  processingTime: number
  warehouseType: string | null
  warehouseCity: string | null
  shippingCountryLabel: string
  freeShippingThresholdEUR: number | null
}

type RelatedCard = {
  id: string
  href: string
  title: string
  image: string
  priceEur: number
}

type SpecRow = { label: string; value: string }

type Props = {
  listingId: string
  productId: string
  /** Affiliate-chosen default color swatch (must exist in `colorNames`). */
  promotedColor?: string | null
  /** Affiliate-chosen default size (must exist in variant size options). */
  promotedSize?: string | null
  name: string
  description: string
  descriptionBullets?: string[]
  productSpecs?: SpecRow[]
  sellerLabel: string
  storefront: StorefrontInfo | null
  priceDisplay: string
  gallery: string[]
  categories: string[]
  colorNames: string[]
  tags: string[]
  variants: ProductVariantsJson | null
  colorImages: ProductColorImageRow[]
  shipping: ListingShippingBlock
  listingPriceCents: number
  stock: number
  retailPriceEur?: number
  has3D?: boolean
  arModel?: string | null
  oftenBoughtTogether?: RelatedCard[]
  alsoViewed?: RelatedCard[]
  reviewSummary: {
    count: number
    average: number
    sentiment: string
  }
  /** Shown near price when the affiliate listing offers buyer cashback / bonus */
  buyerRewardBadge?: string | null
  ratingBreakdown: Record<number, number>
  reviews: Array<{
    id: string
    rating: number
    author: string
    country: string | null
    date: string
    text: string
    images: string[]
    variant: string | null
    helpful_count: number
    verified: boolean
  }>
}

function fmtMoney(value: number) {
  return formatStoreCurrency(value)
}

function t(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template
  )
}

/** One short honest snippet from the listing—not generic placeholder copy. */
function listingAtAGlance(description: string, name: string, tags: string[]): string | null {
  const d = description.replace(/\s+/g, " ").trim()
  if (d.length >= 28) {
    const max = 220
    if (d.length <= max) return d
    const slice = d.slice(0, max)
    const last = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "))
    const cut = last > 80 ? slice.slice(0, last + 1) : slice
    return `${cut.trim()}…`
  }
  if (tags.length > 0) return tags.slice(0, 5).join(" · ")
  return null
}

/** Pick gallery index for a color (match per-color image URL to gallery, then fall back to color order). */
function imageIndexForColor(
  color: string | null,
  colorNames: string[],
  colorImages: ProductColorImageRow[],
  images: string[]
): number {
  if (!images.length) return 0
  if (!color) return 0
  const row = findColorImageRowForName(colorImages, color)
  const direct = row?.image?.trim()
  if (direct) {
    const hit = images.findIndex((u) => comparableImageUrl(u) === comparableImageUrl(direct))
    if (hit >= 0) return hit
  }
  const idx = colorNames.findIndex((c) => c.trim().toLowerCase() === color.trim().toLowerCase())
  if (idx >= 0 && idx < images.length) return idx
  return 0
}

function StarRatingRow({ value, count }: { value: number; count: number }) {
  const full = Math.round(Math.min(5, Math.max(0, value)))
  return (
    <div className="flex items-center gap-1.5" aria-label={`${value.toFixed(1)} out of 5 stars, ${count} reviews`}>
      <div className="flex text-amber-400" role="presentation">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < full ? "fill-amber-400" : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"}`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}

export function MarketplaceListingDetail({
  listingId,
  productId,
  promotedColor = null,
  promotedSize = null,
  name,
  description,
  descriptionBullets = [],
  productSpecs = [],
  sellerLabel,
  storefront,
  tags,
  priceDisplay,
  gallery,
  categories,
  colorNames,
  variants,
  colorImages,
  shipping,
  listingPriceCents,
  stock,
  retailPriceEur,
  has3D = false,
  arModel,
  oftenBoughtTogether = [],
  alsoViewed = [],
  reviewSummary,
  buyerRewardBadge = null,
  ratingBreakdown,
  reviews,
}: Props) {
  const productT = messages.Product
  const breadcrumbT = messages.Breadcrumb
  const router = useRouter()
  const images = useMemo(() => {
    const g = gallery.filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
    return g.length > 0 ? g : ["/placeholder.png"]
  }, [gallery])
  const sizeOptions = useMemo(() => {
    const s = variants?.size
    return s && s.length > 0 ? s : EMPTY_SIZE_OPTIONS
  }, [variants?.size])

  const initialColor = useMemo(() => {
    const p = promotedColor?.trim()
    if (p && colorNames.includes(p)) return p
    return colorNames[0] ?? null
  }, [colorNames, promotedColor])

  const initialSize = useMemo(() => {
    const p = promotedSize?.trim()
    if (p && sizeOptions.includes(p)) return p
    return sizeOptions[0] ?? null
  }, [promotedSize, sizeOptions])

  const partnerHighlightLabel = useMemo(() => {
    const pc = promotedColor?.trim()
    const ps = promotedSize?.trim()
    const parts: string[] = []
    if (pc && colorNames.includes(pc)) parts.push(pc)
    if (ps && sizeOptions.includes(ps)) parts.push(ps)
    if (parts.length === 0) return null
    return parts.join(" · ")
  }, [colorNames, promotedColor, promotedSize, sizeOptions])

  const [selectedImage, setSelectedImage] = useState(0)
  /** When true, main image follows thumbnail index; when false, follows selected color’s image URL when set. */
  const [galleryHeroLock, setGalleryHeroLock] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string | null>(initialColor)
  const [selectedSize, setSelectedSize] = useState<string | null>(initialSize)

  useEffect(() => {
    setSelectedColor(initialColor)
  }, [initialColor])

  useEffect(() => {
    setSelectedSize(initialSize)
  }, [initialSize])

  /** Sync main + thumbnail index when opening another listing or affiliate default color changes. */
  /* eslint-disable react-hooks/exhaustive-deps -- only reset hero when listing or promoted color changes; omit gallery/colorImages ref churn */
  useEffect(() => {
    setGalleryHeroLock(false)
    setSelectedImage(imageIndexForColor(initialColor, colorNames, colorImages, images))
  }, [listingId, initialColor])
  /* eslint-enable react-hooks/exhaustive-deps */

  const [cartBusy, setCartBusy] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)
  const [showAr, setShowAr] = useState(false)
  const [sizeTip, setSizeTip] = useState<string | null>(null)
  const [showStylist, setShowStylist] = useState(false)
  const [styleIdeas, setStyleIdeas] = useState<string[]>([])
  const [stylistLoading, setStylistLoading] = useState(false)
  const [alertSaved, setAlertSaved] = useState(false)
  const [bundleChecked, setBundleChecked] = useState<Record<string, boolean>>({})
  const [rewardBalanceCents, setRewardBalanceCents] = useState(0)
  const [useRewardCents, setUseRewardCents] = useState(0)

  const colorMeta = useMemo(() => {
    const map = new Map(COLORS.map((c) => [c.name, c]))
    return colorNames.map((n) => ({ name: n, meta: map.get(n) }))
  }, [colorNames])

  const safeImageIndex = Math.min(Math.max(0, selectedImage), Math.max(0, images.length - 1))

  const colorRow = useMemo(
    () => (selectedColor ? findColorImageRowForName(colorImages, selectedColor) : undefined),
    [colorImages, selectedColor]
  )
  const colorDirectUrl = colorRow?.image?.trim() ?? ""

  const hero = useMemo(() => {
    if (!galleryHeroLock && colorDirectUrl) return colorDirectUrl
    return images[safeImageIndex]?.trim() || "/placeholder.png"
  }, [galleryHeroLock, colorDirectUrl, images, safeImageIndex])

  const activeThumbIndex = useMemo(() => {
    if (galleryHeroLock) return safeImageIndex
    if (colorDirectUrl) {
      const hit = images.findIndex((u) => comparableImageUrl(u) === comparableImageUrl(colorDirectUrl))
      if (hit >= 0) return hit
      return -1
    }
    return imageIndexForColor(selectedColor, colorNames, colorImages, images)
  }, [
    galleryHeroLock,
    safeImageIndex,
    colorDirectUrl,
    images,
    selectedColor,
    colorNames,
    colorImages,
  ])
  const listingPriceEur = listingPriceCents / 100
  const hasRetailCompare = typeof retailPriceEur === "number" && retailPriceEur > listingPriceEur
  const discountPct = hasRetailCompare
    ? Math.round(((retailPriceEur - listingPriceEur) / retailPriceEur) * 100)
    : 0
  const glanceText = useMemo(() => listingAtAGlance(description, name, tags), [description, name, tags])

  const bundleCandidates = oftenBoughtTogether.slice(0, 2)
  const bundleSelected = bundleCandidates.filter((p) => bundleChecked[p.id])
  const bundleAddonSum = bundleSelected.reduce((sum, p) => sum + p.priceEur, 0)
  const bundleCrossSubtotal = listingPriceEur + bundleAddonSum
  const BUNDLE_SAVE_PCT = 0.15
  const bundlePayToday =
    bundleAddonSum > 0
      ? Math.round(bundleCrossSubtotal * (1 - BUNDLE_SAVE_PCT) * 100) / 100
      : listingPriceEur
  const bundleSaved = bundleAddonSum > 0 ? Math.round((bundleCrossSubtotal - bundlePayToday) * 100) / 100 : 0

  const buyNowQty = 1
  const buyNowLineSubtotalCents = listingPriceCents * buyNowQty
  const maxApplicableReward = useMemo(() => {
    if (buyNowLineSubtotalCents <= 0) return 0
    return Math.max(
      0,
      Math.min(rewardBalanceCents, buyNowLineSubtotalCents - STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS)
    )
  }, [buyNowLineSubtotalCents, rewardBalanceCents])

  useEffect(() => {
    let cancelled = false
    void fetch("/api/account/buyer-reward-balance", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { balanceCents?: number } | null) => {
        if (cancelled || !j) return
        setRewardBalanceCents(Math.max(0, Math.round(Number(j.balanceCents) || 0)))
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setUseRewardCents((v) => Math.min(Math.max(0, v), maxApplicableReward))
  }, [maxApplicableReward])

  const etaDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + Math.max(shipping.deliveryMax, 1))
    return formatStoreDate(d)
  }, [shipping.deliveryMax])
  const deliveryPlace = shipping.warehouseCity?.trim() || shipping.shippingCountryLabel || "your area"

  useEffect(() => {
    if (typeof window === "undefined") return
    const prevSize = window.localStorage.getItem("last-size")
    if (prevSize && sizeOptions.includes(prevSize)) {
      setSizeTip(`You last picked size ${prevSize} on this device.`)
    }
  }, [sizeOptions])

  useEffect(() => {
    if (typeof window === "undefined" || !selectedSize) return
    window.localStorage.setItem("last-size", selectedSize)
  }, [selectedSize])

  async function addToCart(e?: MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
    setCartBusy(true)
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: listingId,
          quantity: 1,
          selectedColor: selectedColor ?? undefined,
          selectedSize: selectedSize ?? undefined,
        }),
        credentials: "include",
      })
      if (res.status === 401) {
        addGuestCartItem({
          productId: listingId,
          qty: 1,
          title: name,
          imageUrl: hero,
          sellerName: sellerLabel,
          price: listingPriceEur,
          selectedColor: selectedColor ?? undefined,
          selectedSize: selectedSize ?? undefined,
        })
        return
      }
      if (res.ok) router.push("/cart")
    } finally {
      setCartBusy(false)
    }
  }

  async function buyNow() {
    setBuyBusy(true)
    try {
      const applied = Math.min(Math.max(0, Math.round(useRewardCents)), maxApplicableReward)
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: listingId,
          qty: buyNowQty,
          useRewardCents: applied,
          selectedColor: selectedColor ?? undefined,
          selectedSize: selectedSize ?? undefined,
        }),
        credentials: "include",
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/marketplace/${listingId}`)}`)
        return
      }
      const data = (await res.json()) as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setBuyBusy(false)
    }
  }

  async function openStylist() {
    setShowStylist(true)
    setStylistLoading(true)
    try {
      const res = await fetch("/api/ai/style-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          productName: name,
          selectedColor,
          selectedSize,
        }),
      })
      const data = (await res.json()) as { ideas?: string[] }
      setStyleIdeas(Array.isArray(data.ideas) ? data.ideas.slice(0, 3) : [])
    } finally {
      setStylistLoading(false)
    }
  }

  async function savePriceAlert() {
    const target = Math.max(1, Math.round((listingPriceEur * 0.95) * 100) / 100)
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, targetPrice: target }),
      credentials: "include",
    })
    if (res.ok) setAlertSaved(true)
  }

  return (
    <>
      <div className="space-y-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <section className="space-y-4 lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="relative aspect-[4/5] bg-zinc-50 sm:aspect-square dark:bg-zinc-900/80">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic remote URLs */}
                <img
                  key={hero}
                  src={hero}
                  alt={name}
                  className="h-full w-full object-contain p-4 transition duration-300 ease-out animate-in fade-in-0 hover:scale-[1.01]"
                />
                {has3D ? (
                  <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
                    {productT.view360}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:thin] sm:mx-0 sm:px-0">
              {images.slice(0, 12).map((url, i) => (
                <button
                  key={`thumb-${i}`}
                  type="button"
                  aria-pressed={activeThumbIndex >= 0 && activeThumbIndex === i}
                  onClick={(e) => {
                    e.preventDefault()
                    setGalleryHeroLock(true)
                    setSelectedImage(i)
                  }}
                  className={`relative aspect-square w-[4.25rem] shrink-0 overflow-hidden rounded-xl border-2 bg-white transition dark:bg-zinc-950 sm:w-[5.25rem] ${
                    activeThumbIndex >= 0 && activeThumbIndex === i
                      ? "border-violet-600 shadow-sm ring-2 ring-violet-500/25 dark:border-violet-500"
                      : "border-zinc-200/90 opacity-90 ring-1 ring-zinc-200/80 hover:border-zinc-300 hover:opacity-100 dark:border-zinc-700 dark:ring-zinc-800 dark:hover:border-zinc-600"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain p-1.5" />
                </button>
              ))}
            </div>

            {arModel ? (
              <Button
                size="lg"
                variant="outline"
                className="border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
                onClick={() => setShowAr(true)}
              >
                {productT.viewInAR}
              </Button>
            ) : null}
          </section>

          <aside className="space-y-5 lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200">
                {breadcrumbT.home}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              <Link href="/marketplace" className="hover:text-zinc-900 dark:hover:text-zinc-200">
                Marketplace
              </Link>
              {categories.slice(0, 2).map((c) => (
                <Fragment key={c}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                  <span className="max-w-[10rem] truncate font-medium text-zinc-600 dark:text-zinc-300">{c}</span>
                </Fragment>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                <Package className="h-3.5 w-3.5" aria-hidden />
                {stock > 0 ? (
                  <>
                    In stock
                    {stock <= 20 ? ` · ${stock} left` : null}
                  </>
                ) : (
                  "Out of stock"
                )}
              </span>
              {shipping.freeShippingThresholdEUR != null && shipping.freeShippingThresholdEUR > 0 ? (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Free shipping over {fmtMoney(shipping.freeShippingThresholdEUR)}
                </span>
              ) : null}
            </div>

            <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[2rem] sm:leading-tight">
              {name}
            </h1>

            {partnerHighlightLabel ? (
              <p className="rounded-xl border border-violet-200/80 bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/35 dark:text-violet-100">
                <span className="font-semibold">Partner highlight:</span> {partnerHighlightLabel}. Shoppers can still
                pick other colors or sizes below.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StarRatingRow value={reviewSummary.average} count={reviewSummary.count} />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {reviewSummary.average.toFixed(1)}
              </span>
              <a href="#listing-reviews" className="text-sm font-medium text-violet-700 hover:underline dark:text-violet-400">
                {t(productT.reviews, { count: formatStoreCount(reviewSummary.count) })}
              </a>
              {reviewSummary.count > 0 && reviewSummary.average >= 4.2 ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {productT.topVentes}
                </span>
              ) : null}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white via-violet-50/30 to-white p-4 shadow-sm dark:border-zinc-700/80 dark:from-zinc-900 dark:via-violet-950/20 dark:to-zinc-950">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/10" aria-hidden />
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700/90 dark:text-violet-300/90">
                Your price
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 tabular-nums dark:text-white">{priceDisplay}</p>
              {buyerRewardBadge ? (
                <p className="mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/90 bg-teal-50/90 px-3 py-1.5 text-xs font-semibold text-teal-900 shadow-sm dark:border-teal-800 dark:bg-teal-950/70 dark:text-teal-100">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    Store offer · {buyerRewardBadge}
                  </span>
                </p>
              ) : null}
              {hasRetailCompare ? (
                <p className="mt-2">
                  <span className="inline-flex rounded-full bg-gradient-to-r from-rose-600 to-orange-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                    −{discountPct}% vs anchor {fmtMoney(retailPriceEur ?? 0)}
                  </span>
                </p>
              ) : null}
            </div>

            {stock <= 5 && stock > 0 ? (
              <p className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                {t(productT.onlyLeft, { count: Math.max(1, stock) })}
              </p>
            ) : null}

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-3 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
              <div className="flex flex-col items-center gap-1 px-1">
                <Truck className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Ships
                </span>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {shipping.deliveryMin}–{shipping.deliveryMax} days
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 border-x border-zinc-200/80 px-1 dark:border-zinc-700">
                <RotateCcw className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Returns
                </span>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{productT.return30d}</span>
              </div>
              <div className="flex flex-col items-center gap-1 px-1">
                <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Checkout
                </span>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{productT.securePayment}</span>
              </div>
            </div>
            <p className="-mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {t(productT.deliveryTo, {
                city: deliveryPlace,
                date: etaDate,
              })}
            </p>

            {colorMeta.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Color</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colorMeta.map(({ name: cn, meta }) => (
                    <button
                      key={cn}
                      type="button"
                      onClick={() => {
                        setGalleryHeroLock(false)
                        setSelectedColor(cn)
                        setSelectedImage(imageIndexForColor(cn, colorNames, colorImages, images))
                      }}
                      className={`h-9 w-9 rounded-full border-2 transition ${
                        selectedColor === cn ? "border-zinc-900 dark:border-white" : "border-zinc-300 dark:border-zinc-600"
                      }`}
                      style={
                        meta && !isMulticolorSwatch(meta)
                          ? { backgroundColor: meta.hex }
                          : { background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }
                      }
                      title={cn}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {sizeOptions.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{VARIANT_GROUP_LABELS.size}</p>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                        selectedSize === s
                          ? "border-violet-600 bg-violet-600 text-white shadow-sm dark:border-violet-500 dark:bg-violet-600"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {sizeTip ? (
              <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                {sizeTip}
              </p>
            ) : null}

            <div className="relative rounded-[1.65rem] border border-zinc-200/90 bg-gradient-to-b from-white via-zinc-50/40 to-zinc-50/90 p-5 shadow-[0_22px_56px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] dark:border-zinc-700/90 dark:from-zinc-900/90 dark:via-zinc-950/80 dark:to-zinc-950 dark:shadow-black/50 dark:ring-white/[0.04]">
              <div className="mb-4 flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25">
                  <Zap className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{productT.actionStackHint}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500 dark:text-zinc-500">
                    {productT.securePayment} · {shipping.deliveryMin}–{shipping.deliveryMax} day delivery
                  </span>
                </p>
              </div>

              {rewardBalanceCents > 0 && maxApplicableReward > 0 ? (
                <div className="mb-4 rounded-2xl border border-teal-200/80 bg-teal-50/70 px-4 py-3 dark:border-teal-900/50 dark:bg-teal-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-teal-950 dark:text-teal-100">Use store credit</p>
                    <Link
                      href="/dashboard/wallet"
                      className="text-xs font-medium text-teal-800 underline-offset-2 hover:underline dark:text-teal-300"
                    >
                      Wallet
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-teal-900/90 dark:text-teal-200/90">
                    Balance {formatStoreCurrencyFromCents(rewardBalanceCents)} · up to{" "}
                    {formatStoreCurrencyFromCents(maxApplicableReward)} on this checkout (
                    {formatStoreCurrency(STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS / 100)} card minimum).
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={maxApplicableReward}
                      step={1}
                      value={Math.min(useRewardCents, maxApplicableReward)}
                      onChange={(e) => setUseRewardCents(Number(e.target.value))}
                      className="min-w-[10rem] flex-1 accent-teal-600"
                      aria-label="Store credit to apply"
                    />
                    <span className="text-sm font-semibold tabular-nums text-teal-950 dark:text-teal-50">
                      {formatStoreCurrencyFromCents(Math.min(useRewardCents, maxApplicableReward))}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-teal-300 bg-white px-2 py-0.5 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/50"
                      onClick={() => setUseRewardCents(maxApplicableReward)}
                    >
                      Max
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-teal-300 bg-white px-2 py-0.5 text-xs font-medium text-teal-900 hover:bg-teal-50 dark:border-teal-700 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/50"
                      onClick={() => setUseRewardCents(0)}
                    >
                      None
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <motion.button
                  type="button"
                  disabled={cartBusy || stock <= 0}
                  whileHover={{ scale: stock > 0 && !cartBusy ? 1.01 : 1 }}
                  whileTap={{ scale: stock > 0 && !cartBusy ? 0.99 : 1 }}
                  onClick={(e) => void addToCart(e)}
                  className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-violet-600 via-violet-600 to-fuchsia-600 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:shadow-xl hover:shadow-violet-500/35 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-violet-900/40"
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden />
                  <ShoppingBag className="relative h-5 w-5 shrink-0" aria-hidden />
                  <span className="relative">{cartBusy ? "Adding…" : productT.addToCart}</span>
                </motion.button>

                <motion.button
                  type="button"
                  disabled={buyBusy || stock <= 0}
                  whileHover={{ scale: stock > 0 && !buyBusy ? 1.01 : 1 }}
                  whileTap={{ scale: stock > 0 && !buyBusy ? 0.99 : 1 }}
                  onClick={() => void buyNow()}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-zinc-900 bg-white text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
                >
                  {buyBusy ? (
                    "Redirecting…"
                  ) : (
                    <>
                      {productT.buyNowOneClick}
                      <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
                    </>
                  )}
                </motion.button>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={stylistLoading}
                    onClick={() => void openStylist()}
                    className="flex flex-col items-start gap-0.5 rounded-2xl border border-zinc-200/90 bg-zinc-100/80 px-3.5 py-3 text-left text-sm font-semibold text-zinc-900 transition hover:border-violet-300/80 hover:bg-violet-50/60 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-violet-600/50 dark:hover:bg-violet-950/30"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                      {productT.howToWear}
                    </span>
                    <span className="text-[10px] font-normal leading-tight text-zinc-500 dark:text-zinc-400">
                      {productT.howToStyleSub}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePriceAlert()}
                    className="flex flex-col items-start gap-0.5 rounded-2xl border border-zinc-200/90 bg-zinc-100/80 px-3.5 py-3 text-left text-sm font-semibold text-zinc-900 transition hover:border-amber-300/80 hover:bg-amber-50/50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-amber-700/50 dark:hover:bg-amber-950/25"
                  >
                    <span className="flex items-center gap-1.5">
                      <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                      {alertSaved ? "Saved" : productT.alertPriceDrop}
                    </span>
                    <span className="text-[10px] font-normal leading-tight text-zinc-500 dark:text-zinc-400">
                      {alertSaved ? productT.priceAlertSavedSub : productT.priceAlertSub}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {glanceText ? (
              <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-teal-50/40 px-4 py-3 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-950 dark:to-teal-950/20">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
                  From the listing
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{glanceText}</p>
              </div>
            ) : null}

            {bundleCandidates.length > 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Complete the basket</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Add items below — 15% off the combined total (this SKU + selections).
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
                    <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{priceDisplay}</span>
                  </div>
                  {bundleCandidates.map((row) => (
                    <label
                      key={row.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-100 px-3 py-2 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-violet-600"
                        checked={Boolean(bundleChecked[row.id])}
                        onChange={(e) =>
                          setBundleChecked((prev) => ({ ...prev, [row.id]: e.target.checked }))
                        }
                      />
                      <span className="line-clamp-1 flex-1 text-sm text-zinc-800 dark:text-zinc-200">
                        {row.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums font-medium text-zinc-600 dark:text-zinc-400">
                        +{fmtMoney(row.priceEur)}
                      </span>
                    </label>
                  ))}
                </div>
                <motion.div
                  key={`${bundlePayToday}-${bundleAddonSum}`}
                  initial={{ opacity: 0.6, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800"
                >
                  <div className="flex justify-between font-medium text-zinc-700 dark:text-zinc-300">
                    <span>Subtotal ({bundleSelected.length ? "items + SKU" : "this SKU"})</span>
                    <span className="tabular-nums">{fmtMoney(bundleAddonSum > 0 ? bundleCrossSubtotal : listingPriceEur)}</span>
                  </div>
                  {bundleAddonSum > 0 ? (
                    <>
                      <div className="mt-1 flex justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <span>Bundle discount (15%)</span>
                        <span className="tabular-nums">−{fmtMoney(bundleSaved)}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-base font-bold text-zinc-900 dark:text-white">
                        <span>You pay</span>
                        <span className="tabular-nums">{fmtMoney(bundlePayToday)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Tick add-ons to see bundle pricing. Checkout adds one line at a time today.
                    </p>
                  )}
                </motion.div>
              </div>
            ) : null}

            {storefront ? (
              <Link
                href={`/store/${encodeURIComponent(storefront.slug)}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-4 transition hover:border-violet-200 hover:bg-violet-50/40 dark:border-zinc-800 dark:hover:border-violet-900/50 dark:hover:bg-violet-950/20"
              >
                {storefront.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- storefront logo URL */
                  <img
                    src={storefront.logoUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl border border-zinc-100 bg-white object-contain p-1 dark:border-zinc-700"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-teal-50 text-lg font-bold text-violet-800 dark:from-violet-950 dark:to-teal-950 dark:text-violet-200">
                    {storefront.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Sold by
                  </p>
                  <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{storefront.name}</p>
                  {storefront.showTrustedSoldBy ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Verified storefront</p>
                  ) : null}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
              </Link>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(productT.byStore, { store: sellerLabel })}</p>
            )}
          </aside>
        </div>
      </div>

      <section className="mt-10 space-y-3">
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700" open>
          <summary className="cursor-pointer font-semibold">Description</summary>
          {descriptionBullets.length > 0 ? (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                About this item
              </p>
              <ul className="mt-2 list-none space-y-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                {descriptionBullets.map((line, i) => (
                  <li key={`bullet-${i}`} className="flex gap-2.5">
                    <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className={descriptionBullets.length > 0 ? "mt-6 border-t border-zinc-100 pt-5 dark:border-zinc-800" : ""}>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
              Full detail
            </p>
            <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{description}</p>
          </div>
        </details>
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer font-semibold">Specifications</summary>
          {productSpecs.length > 0 ? (
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {productSpecs.map((row) => (
                <div
                  key={`${row.label}:${row.value.slice(0, 32)}`}
                  className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800 sm:border-0 sm:pb-0"
                >
                  <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{row.label}</dt>
                  <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <ul
            className={`mt-2 text-sm text-zinc-700 dark:text-zinc-300 ${productSpecs.length > 0 ? "mt-4 border-t border-dashed border-zinc-100 pt-4 dark:border-zinc-800" : ""}`}
          >
            {storefront ? (
              <li>
                <Link
                  href={`/store/${encodeURIComponent(storefront.slug)}`}
                  className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                >
                  Visit {storefront.name}
                </Link>
              </li>
            ) : (
              <li className="text-zinc-600 dark:text-zinc-400">Sold by {sellerLabel}</li>
            )}
            <li>Colour options: {colorNames.length || "—"}</li>
            <li>Average rating: {reviewSummary.average.toFixed(1)} / 5</li>
          </ul>
        </details>
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer font-semibold">Shipping</summary>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Delivery {shipping.deliveryMin}-{shipping.deliveryMax} business days. Processing in{" "}
            {shipping.processingTime} day(s).
          </p>
        </details>
        <details id="listing-reviews" className="scroll-mt-28 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <summary className="cursor-pointer font-semibold">Reviews</summary>
          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="mb-2">
              <Star className="mr-1 inline h-4 w-4 fill-yellow-400 text-yellow-400" />
              {reviewSummary.average.toFixed(1)} ({formatStoreCount(reviewSummary.count)} reviews)
            </p>
            <p>5★: {ratingBreakdown[5] ?? 0} · 4★: {ratingBreakdown[4] ?? 0} · 3★: {ratingBreakdown[3] ?? 0}</p>
            {reviews.slice(0, 3).map((r) => (
              <p key={r.id} className="mt-2 rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-800">
                <q className="not-italic text-zinc-800 dark:text-zinc-200">{r.text.slice(0, 140)}</q>
              </p>
            ))}
          </div>
        </details>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Frequently bought together</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {oftenBoughtTogether.slice(0, 3).map((p) => (
            <Link key={p.id} href={p.href} className="rounded-xl border border-zinc-200 p-3 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-50 hover:shadow-2xl dark:border-zinc-700 dark:hover:bg-zinc-900">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium">{p.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{fmtMoney(p.priceEur)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Customers also viewed</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {alsoViewed.slice(0, 3).map((p) => (
            <Link key={p.id} href={p.href} className="rounded-xl border border-zinc-200 p-3 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-50 hover:shadow-2xl dark:border-zinc-700 dark:hover:bg-zinc-900">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium">{p.title}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{fmtMoney(p.priceEur)}</p>
            </Link>
          ))}
        </div>
      </section>

      {showAr ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">AR Preview</h3>
              <button type="button" onClick={() => setShowAr(false)} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Close
              </button>
            </div>
            {arModel ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Open the model in a new tab for AR-enabled viewer.
                </p>
                <a
                  href={arModel}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Open AR Model
                </a>
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No AR model available.</p>
            )}
          </div>
        </div>
      ) : null}
      {showStylist ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI Stylist</h3>
              <button type="button" onClick={() => setShowStylist(false)} className="rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Close
              </button>
            </div>
            {stylistLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Generating outfit ideas...</p>
            ) : (
              <ul className="space-y-2 text-sm">
                <li className="rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
                  Personalized for {selectedColor ?? "your selected color"} / size {selectedSize ?? "your selected size"}
                </li>
                {styleIdeas.map((idea, idx) => (
                  <li key={`${idx}-${idea}`} className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
                    {idea}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
