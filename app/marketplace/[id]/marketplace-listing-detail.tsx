"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  MousePointerClick,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  TrendingUp,
  Truck,
  Zap,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"

import { ReviewsEngine } from "@/components/reviews/ReviewsEngine"
import { BookingComingSoonRail } from "@/components/booking/booking-coming-soon-rail"

import { ListingPriceActionCard } from "@/components/marketplace/listing-price-action-card"
import { MarketplacePurchaseQuantity } from "@/components/marketplace/marketplace-purchase-quantity"
import { SupplierTrustBadge } from "@/components/suppliers/supplier-trust-badge"
import { Button } from "@/components/ui/button"
import { MobilePdpBuyPanel } from "@/components/product/mobile-pdp-buy-panel"
import { ProductListingColorPicker } from "@/components/product/product-listing-color-picker"
import { ProductMediaGallery } from "@/components/product/product-media-gallery"
import { ProductOfferBadge } from "@/components/product/product-offer-badge"
import { ListingLogisticsStrip } from "@/components/product/listing-logistics-strip"
import type { ListingLogisticsInput } from "@/lib/listing-logistics-display"
import type { OfferModeBadge } from "@/lib/product-offer-mode"
import { ProductVideoPlayer } from "@/components/product/product-video-player"
import { ProductVideoWishlistOverlay } from "@/components/product/product-video-wishlist-overlay"
import { DescriptionRichContent } from "@/components/product/description-rich-content"
import { descriptionHasImageMarkers } from "@/lib/description-rich-content"
import type { AppLocale } from "@/lib/i18n-locale"
import { CLIENT_MESSAGES } from "@/lib/i18n-load-messages"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { buildMarketplaceColorMeta, shouldShowMarketplaceColorSwatches, shopperColorLabelsMatch } from "@/lib/marketplace-color-meta"
import { shopperCategoryEyebrow, shopperVisibleTags } from "@/lib/product-shopper-tags"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { WishlistHeart } from "@/components/wishlist-heart"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { buyNowWithoutLogin } from "@/lib/guest-buy-now-client"
import {
  isBookingCheckoutBlocked,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/checkout-live"
import {
  isBookableListingKind,
  isExperienceListingKind,
  isServiceListingKind,
} from "@/lib/booking/types"
import { BookingSlotPicker } from "@/components/booking/booking-slot-picker"
import { BookingNamedSeatPicker } from "@/components/booking/booking-named-seat-picker"
import { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/marketplace-checkout-discount"
import {
  clampPurchaseQuantity,
  resolveListingAvailableStock,
} from "@/lib/marketplace-purchase-quantity"
import {
  formatStoreCount,
  formatStoreCurrency,
  formatStoreCurrencyFromCents,
  formatStoreDate,
} from "@/lib/market-config"
import { resolveUsableProductImageUrl } from "@/lib/product-image-url"
import {
  colorForImageIndex,
  galleryIndexForImageUrl,
  imageIndexForColor,
  resolveColorHeroImageUrl,
  type ProductColorImageRow,
} from "@/lib/product-color-images"
import {
  findVariantRowForShopperSelection,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import type { CustomColumn } from "@/types/product"
import {
  marketplaceRetailPriceEurForOption,
  marketplaceSellingPriceCentsForOption,
  type ProductVariantsJson,
} from "@/lib/product-variants"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import { cn } from "@/lib/utils"

const EMPTY_SIZE_OPTIONS: string[] = []

type StorefrontInfo = {
  name: string
  slug: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  showTrustedSoldBy: boolean
}

export type ListingShippingBlock = ListingLogisticsInput & {
  processingTime: number
  freeShippingThresholdEUR: number | null
}

type RelatedCard = {
  id: string
  href: string
  title: string
  image: string
  priceEur: number
  soldCount?: number
}

function BuyerRelatedListingTile({ p }: { p: RelatedCard }) {
  return (
    <Link
      href={p.href}
      className="group rounded-xl border border-zinc-200 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-violet-200/80 hover:bg-zinc-50 hover:shadow-lg hover:shadow-violet-500/5 dark:border-zinc-700 dark:hover:border-violet-800/50 dark:hover:bg-zinc-900"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        {p.soldCount ? <ProductSalesBadge count={p.soldCount} variant="overlay" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.image}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{p.title}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{fmtMoney(p.priceEur)}</p>
    </Link>
  )
}

type SpecRow = { label: string; value: string }

type Props = {
  /** Buyer-facing pages hide wholesale / partner seller attribution. */
  audience?: "customer" | "merchant"
  listingId: string
  productId: string
  listingKind?: string
  /** Affiliate-chosen default color swatch (must exist in `colorNames`). */
  promotedColor?: string | null
  /** Affiliate-chosen default size (must exist in variant size options). */
  promotedSize?: string | null
  name: string
  description: string
  descriptionBullets?: string[]
  descriptionIllustrationImages?: string[]
  descriptionIllustrationVideos?: string[]
  productSpecs?: SpecRow[]
  sellerLabel: string
  isVerifiedSupplier?: boolean
  supplierTrustTier?: string | null
  storefront: StorefrontInfo | null
  gallery: string[]
  categories: string[]
  colorNames: string[]
  storageOptions?: string[]
  customColumns?: CustomColumn[]
  tags: string[]
  variants: ProductVariantsJson | null
  colorImages: ProductColorImageRow[]
  shipping: ListingShippingBlock
  listingPriceCents: number
  basePriceCents: number
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
    ugcCount?: number
  }
  writeReviewOrderId?: string | null
  openWriteReview?: boolean
  /** Shown near price when the affiliate listing offers buyer cashback / bonus */
  buyerRewardBadge?: string | null
  /** Supplier-declared product condition (refurbished, second-hand, etc.) */
  offerBadge?: OfferModeBadge | null
  /** Loaded client-side via ReviewsEngine → /api/reviews/product/[id] */
  ratingBreakdown?: Record<number, number>
  /** PDP views in the last 24h (analytics) — powers a “trending” signal when high enough. */
  viewsLast24h?: number
  /** Paid units on this listing (AffiliateProduct.conversions). */
  salesCount?: number
  /** Supplier listing clip shown under the photo gallery (9:16). */
  galleryListingVideoUrl?: string | null
  /** Affiliate shop PDP (`/shops/:slug`) — use Brand Studio colors instead of Affisell violet. */
  brandedStorefront?: boolean
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
  const visibleTags = shopperVisibleTags(tags)
  if (visibleTags.length > 0) return visibleTags.slice(0, 5).join(" · ")
  return null
}

/** Split long marketplace titles into a scannable headline + supporting line. */
function splitListingTitle(name: string): { headline: string; subline: string | null } {
  const trimmed = name.trim()
  if (!trimmed) return { headline: "", subline: null }

  const comma = trimmed.indexOf(",")
  if (comma >= 12 && comma <= 96) {
    const headline = trimmed.slice(0, comma).trim()
    const subline = trimmed.slice(comma + 1).trim()
    if (headline.length >= 8 && subline.length >= 10) {
      return { headline, subline }
    }
  }

  const dash = trimmed.match(/^(.{12,72})\s[-–—]\s+(.{8,})$/u)
  if (dash) {
    return { headline: dash[1].trim(), subline: dash[2].trim() }
  }

  if (trimmed.length > 78) {
    const cut = trimmed.lastIndexOf(" ", 78)
    if (cut >= 28) {
      return { headline: trimmed.slice(0, cut).trim(), subline: trimmed.slice(cut).trim() }
    }
  }

  return { headline: trimmed, subline: null }
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

function DescriptionIllustrativeMedia({
  productId,
  images,
  videos,
}: {
  productId: string
  images: string[]
  videos: string[]
}) {
  if (images.length === 0 && videos.length === 0) return null
  return (
    <div className="mt-5 space-y-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
        Photos & videos
      </p>
      {images.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((src, imageIndex) => (
            <li
              key={`illustration-img-${imageIndex}`}
              className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote supplier / CDN URLs */}
              <img src={src} alt="" className="max-h-80 w-full object-contain p-2" loading="lazy" />
            </li>
          ))}
        </ul>
      ) : null}
      {videos.length > 0 ? (
        <ul className="space-y-4">
          {videos.map((url, videoIndex) => (
            <li key={`illustration-video-${videoIndex}`}>
              <ProductVideoWishlistOverlay
                productId={productId}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-black/5 dark:border-zinc-700"
              >
                <ProductVideoPlayer url={url} />
              </ProductVideoWishlistOverlay>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function MarketplaceListingDetail({
  audience = "customer",
  listingId,
  productId,
  listingKind = "PHYSICAL",
  promotedColor = null,
  promotedSize = null,
  name,
  description,
  descriptionBullets = [],
  descriptionIllustrationImages = [],
  descriptionIllustrationVideos = [],
  productSpecs = [],
  sellerLabel,
  isVerifiedSupplier = false,
  supplierTrustTier = null,
  storefront,
  tags,
  gallery,
  categories,
  colorNames,
  storageOptions = [],
  customColumns = [],
  variants,
  colorImages,
  shipping,
  listingPriceCents,
  basePriceCents,
  stock,
  retailPriceEur,
  has3D = false,
  arModel,
  oftenBoughtTogether = [],
  alsoViewed = [],
  reviewSummary,
  buyerRewardBadge = null,
  offerBadge = null,
  ratingBreakdown,
  writeReviewOrderId = null,
  openWriteReview = false,
  viewsLast24h = 0,
  salesCount = 0,
  galleryListingVideoUrl = null,
  brandedStorefront = false,
}: Props) {
  const locale = useLocale() as AppLocale
  const brand = storefrontPdpBrandClasses(brandedStorefront)
  const messages = CLIENT_MESSAGES[locale] as typeof import("@/messages/en.json")
  const productT = messages.Product
  const breadcrumbT = messages.Breadcrumb
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const purchaseDockRef = useRef<HTMLDivElement>(null)
  const mobilePurchaseRef = useRef<HTMLElement>(null)
  const [showStickyBuy, setShowStickyBuy] = useState(false)
  const [titleExpanded, setTitleExpanded] = useState(false)
  const { headline: titleHeadline, subline: titleSubline } = useMemo(() => splitListingTitle(name), [name])
  const titleSublineLong = Boolean(titleSubline && titleSubline.length > 110)
  const categoryEyebrow = shopperCategoryEyebrow(categories, tags)
  const images = useMemo(() => {
    const g = gallery.filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
    return g.length > 0 ? g : ["/placeholder.png"]
  }, [gallery])
  const sizeOptions = useMemo(() => {
    const s = variants?.size
    return s && s.length > 0 ? s : EMPTY_SIZE_OPTIONS
  }, [variants?.size])

  const initialStorage = useMemo(() => storageOptions[0] ?? null, [storageOptions])

  const initialColor = useMemo(() => {
    const p = promotedColor?.trim()
    if (p) {
      const exact = colorNames.find((c) => c === p)
      if (exact) return exact
      const fuzzy = colorNames.find((c) => shopperColorLabelsMatch(c, p))
      if (fuzzy) return fuzzy
    }
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
  const [selectedStorage, setSelectedStorage] = useState<string | null>(initialStorage)
  const [descExpanded, setDescExpanded] = useState(false)

  const descriptionIsLong = useMemo(
    () => description.replace(/\s+/g, " ").trim().length > 960,
    [description]
  )

  const descriptionGalleryImages = useMemo(
    () =>
      descriptionHasImageMarkers(description) ? [] : descriptionIllustrationImages,
    [description, descriptionIllustrationImages]
  )

  useEffect(() => {
    setSelectedColor(initialColor)
  }, [initialColor])

  useEffect(() => {
    setSelectedSize(initialSize)
  }, [initialSize])

  useEffect(() => {
    setDescExpanded(false)
    setTitleExpanded(false)
  }, [listingId])


  useEffect(() => {
    const pickTarget = () => {
      if (typeof window === "undefined") return purchaseDockRef.current
      return window.matchMedia("(max-width: 1023px)").matches
        ? mobilePurchaseRef.current
        : purchaseDockRef.current
    }
    const el = pickTarget()
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const past = !entry.isIntersecting && entry.boundingClientRect.top < 96
        setShowStickyBuy(past)
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" }
    )
    io.observe(el)
    const mq = window.matchMedia("(max-width: 1023px)")
    const onMq = () => {
      io.disconnect()
      const next = pickTarget()
      if (next) io.observe(next)
    }
    mq.addEventListener("change", onMq)
    return () => {
      mq.removeEventListener("change", onMq)
      io.disconnect()
    }
  }, [listingId, stock])

  /** Sync main + thumbnail index when opening another listing or affiliate default color changes. */
  /* eslint-disable react-hooks/exhaustive-deps -- only reset hero when listing or promoted color changes; omit gallery/colorImages ref churn */
  useEffect(() => {
    setGalleryHeroLock(false)
    setSelectedImage(imageIndexForColor(initialColor, colorNames, colorImages, images))
  }, [listingId, initialColor])
  /* eslint-enable react-hooks/exhaustive-deps */

  const selectColor = useCallback(
    (colorName: string) => {
      setGalleryHeroLock(false)
      setSelectedColor(colorName)
      setSelectedImage(imageIndexForColor(colorName, colorNames, colorImages, images))
    },
    [colorNames, colorImages, images]
  )

  const selectGalleryImage = useCallback(
    (index: number) => {
      const mappedColor = colorForImageIndex(index, colorNames, colorImages, images)
      if (mappedColor) {
        setGalleryHeroLock(false)
        setSelectedColor(mappedColor)
        setSelectedImage(index)
        return
      }
      setGalleryHeroLock(true)
      setSelectedImage(index)
    },
    [colorNames, colorImages, images]
  )

  const [cartBusy, setCartBusy] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)
  const [purchaseQty, setPurchaseQty] = useState(1)
  const [showAr, setShowAr] = useState(false)
  const [sizeTip, setSizeTip] = useState<string | null>(null)
  const [alertSaved, setAlertSaved] = useState(false)
  const [selectedBookingSlotId, setSelectedBookingSlotId] = useState<string | null>(null)
  const [selectedSlotSeatsLeft, setSelectedSlotSeatsLeft] = useState<number | null>(null)
  const [selectedSeatLabels, setSelectedSeatLabels] = useState<string[]>([])
  const [slotUsesNamedSeats, setSlotUsesNamedSeats] = useState(false)
  const bookingCheckoutBlocked = isBookingCheckoutBlocked(listingKind)
  const bookingCheckoutLive =
    isBookableListingKind(listingKind) && isBookingCheckoutLiveForKind(listingKind)
  const serviceBookingLive = isServiceListingKind(listingKind) && bookingCheckoutLive
  const experienceBookingLive = isExperienceListingKind(listingKind) && bookingCheckoutLive
  const multiGuestBookingLive = bookingCheckoutLive && !serviceBookingLive
  const bookingSlotRequired = bookingCheckoutLive && !selectedBookingSlotId
  const bookingSeatsRequired =
    experienceBookingLive && slotUsesNamedSeats && selectedSeatLabels.length === 0
  const [rewardBalanceCents, setRewardBalanceCents] = useState(0)
  const [useRewardCents, setUseRewardCents] = useState(0)

  const colorMeta = useMemo(
    () => buildMarketplaceColorMeta(colorNames, colorImages),
    [colorNames, colorImages]
  )

  const showColorSwatches = shouldShowMarketplaceColorSwatches(colorMeta)

  const shopperSelection: ShopperVariantSelection = useMemo(
    () => ({
      selectedPrimary: selectedColor,
      selectedStorage,
      selectedSize,
    }),
    [selectedColor, selectedStorage, selectedSize]
  )

  const activeVariantRow = useMemo(
    () =>
      findVariantRowForShopperSelection({
        variants,
        customColumns,
        selection: shopperSelection,
      }),
    [variants, customColumns, shopperSelection]
  )

  /** Cart / checkout: reuse `selectedSize` when there is no size axis (storage-only). */
  const cartSelectedSize = selectedSize ?? selectedStorage ?? undefined

  const safeImageIndex = Math.min(Math.max(0, selectedImage), Math.max(0, images.length - 1))

  const colorVariantIndex = useMemo(
    () => imageIndexForColor(selectedColor, colorNames, colorImages, images),
    [selectedColor, colorNames, colorImages, images]
  )

  const colorHeroUrl = useMemo(
    () => resolveColorHeroImageUrl(selectedColor, colorNames, colorImages, images),
    [selectedColor, colorNames, colorImages, images]
  )

  const hero = useMemo(() => {
    if (galleryHeroLock) {
      return resolveUsableProductImageUrl(images[safeImageIndex], images)
    }
    return colorHeroUrl
  }, [galleryHeroLock, colorHeroUrl, images, safeImageIndex])

  const activeThumbIndex = useMemo(() => {
    if (galleryHeroLock) return safeImageIndex
    const heroIdx = galleryIndexForImageUrl(colorHeroUrl, images)
    if (heroIdx >= 0) return heroIdx
    return colorVariantIndex
  }, [galleryHeroLock, colorHeroUrl, images, safeImageIndex, colorVariantIndex])
  const activeListingPriceCents = useMemo(() => {
    if (activeVariantRow && activeVariantRow.priceCents > 0) {
      const sell = Math.max(0, Math.round(listingPriceCents))
      const base = Math.max(0, Math.round(basePriceCents))
      const wholesale = activeVariantRow.priceCents
      return Math.max(0, sell + (wholesale - base))
    }
    return marketplaceSellingPriceCentsForOption({
      listingSellingPriceCents: listingPriceCents,
      productBasePriceCents: basePriceCents,
      variants,
      optionName: selectedColor,
    })
  }, [activeVariantRow, listingPriceCents, basePriceCents, variants, selectedColor])

  const activeRetailPriceEur = useMemo(() => {
    if (activeVariantRow && activeVariantRow.priceCents > 0 && retailPriceEur != null) {
      const base = Math.max(0, Math.round(basePriceCents))
      return retailPriceEur + (activeVariantRow.priceCents - base) / 100
    }
    return marketplaceRetailPriceEurForOption({
      retailPriceEur,
      productBasePriceCents: basePriceCents,
      variants,
      optionName: selectedColor,
    })
  }, [activeVariantRow, retailPriceEur, basePriceCents, variants, selectedColor])

  const priceDisplay = useMemo(
    () => formatStoreCurrencyFromCents(activeListingPriceCents),
    [activeListingPriceCents]
  )

  const listingPriceEur = activeListingPriceCents / 100
  const hasRetailCompare =
    typeof activeRetailPriceEur === "number" && activeRetailPriceEur > listingPriceEur
  const glanceText = useMemo(() => listingAtAGlance(description, name, tags), [description, name, tags])

  /** Short excerpt for the footer details panel (SEO / second entry point without repeating the full body). */
  const descriptionFooterExcerpt = useMemo(() => {
    const d = description.replace(/\s+/g, " ").trim()
    if (!d) return null
    const max = 420
    if (d.length <= max) return d
    const slice = d.slice(0, max)
    const cut = slice.lastIndexOf(" ")
    return `${(cut > 200 ? slice.slice(0, cut) : slice).trimEnd()}…`
  }, [description])

  const availableStock = useMemo(() => {
    if (activeVariantRow) return Math.max(0, Math.round(activeVariantRow.stock) || 0)
    return resolveListingAvailableStock({
      productStock: stock,
      variants,
      selectedColor,
      selectedSize,
    })
  }, [activeVariantRow, stock, variants, selectedColor, selectedSize])

  useEffect(() => {
    setPurchaseQty((q) => clampPurchaseQuantity(q, availableStock))
  }, [availableStock, selectedColor, selectedSize, selectedStorage, listingId])

  useEffect(() => {
    if (availableStock <= 0) setShowStickyBuy(false)
  }, [availableStock])

  const bookingTicketStock =
    multiGuestBookingLive && selectedSlotSeatsLeft != null
      ? Math.min(availableStock, selectedSlotSeatsLeft)
      : availableStock

  const handleSelectBookingSlot = useCallback(
    (
      slotId: string | null,
      meta?: { seatsLeft: number; capacity: number; occupiedSeats: number }
    ) => {
      setSelectedBookingSlotId(slotId)
      setSelectedSlotSeatsLeft(slotId ? (meta?.seatsLeft ?? null) : null)
      setSelectedSeatLabels([])
      setSlotUsesNamedSeats(false)
    },
    []
  )

  useEffect(() => {
    if (selectedSeatLabels.length > 0) {
      setPurchaseQty(selectedSeatLabels.length)
    }
  }, [selectedSeatLabels])

  useEffect(() => {
    if (!multiGuestBookingLive || selectedSlotSeatsLeft == null) return
    setPurchaseQty((prev) => clampPurchaseQuantity(prev, bookingTicketStock))
  }, [multiGuestBookingLive, selectedSlotSeatsLeft, bookingTicketStock])

  const buyNowLineSubtotalCents = activeListingPriceCents * (serviceBookingLive ? 1 : purchaseQty)
  const maxApplicableReward = useMemo(() => {
    if (buyNowLineSubtotalCents <= 0) return 0
    return Math.max(
      0,
      Math.min(rewardBalanceCents, buyNowLineSubtotalCents - STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS)
    )
  }, [buyNowLineSubtotalCents, rewardBalanceCents])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sessionRes = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" })
        if (!sessionRes.ok || cancelled) return
        const session = (await sessionRes.json()) as { user?: { id?: string; role?: string } } | null
        if (cancelled) return
        if (!session?.user?.id || cancelled) return
        const br = await fetch("/api/account/buyer-reward-balance", {
          credentials: "include",
          cache: "no-store",
        })
        if (!br.ok || cancelled) return
        const j = (await br.json()) as { balanceCents?: number }
        setRewardBalanceCents(Math.max(0, Math.round(Number(j.balanceCents) || 0)))
      } catch {
        /* store credit is optional on PDP */
      }
    })()
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
    if (bookingCheckoutBlocked) return
    if (bookingCheckoutLive) return
    setCartBusy(true)
    try {
      const result = await addToBuyerCart({
        productId: listingId,
        qty: purchaseQty,
        title: name,
        imageUrl: hero,
        sellerName: sellerLabel,
        price: listingPriceEur,
        selectedColor: selectedColor ?? undefined,
        selectedSize: cartSelectedSize ?? undefined,
      })
      if (!result.ok) return
      if (result.mode === "server") {
        router.push("/cart")
        return
      }
      const { toast } = await import("sonner")
      toast.success(messages.cart.guestAdded, { description: messages.cart.guestAddedBody })
    } finally {
      setCartBusy(false)
    }
  }

  async function buyNow() {
    if (bookingCheckoutBlocked) return
    if (bookingSlotRequired || bookingSeatsRequired) {
      const { toast } = await import("sonner")
      toast.error(
        bookingSeatsRequired
          ? productT.booking.selectSeatsRequired
          : productT.booking.selectSlotRequired
      )
      return
    }
    setBuyBusy(true)
    try {
      const applied = Math.min(Math.max(0, Math.round(useRewardCents)), maxApplicableReward)
      const checkoutQty =
        selectedSeatLabels.length > 0 ? selectedSeatLabels.length : serviceBookingLive ? 1 : purchaseQty
      await buyNowWithoutLogin(
        {
          productId: listingId,
          qty: checkoutQty,
          bookingSlotId: selectedBookingSlotId ?? undefined,
          bookingSeatLabels:
            selectedSeatLabels.length > 0 ? selectedSeatLabels : undefined,
          useRewardCents: applied,
          selectedColor: selectedColor ?? undefined,
          selectedSize: cartSelectedSize ?? undefined,
          cancelPath: `/marketplace/${listingId}`,
        },
        {
          productId: listingId,
          title: name,
          imageUrl: hero,
          sellerName: sellerLabel,
          price: listingPriceEur,
          selectedColor: selectedColor ?? undefined,
          selectedSize: cartSelectedSize ?? undefined,
        }
      )
    } finally {
      setBuyBusy(false)
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
      <div className="relative mb-10 max-w-full max-lg:overflow-x-clip lg:mb-14 lg:overflow-visible">
        <motion.div
          className={brand.cardGlowOrb}
          aria-hidden
        />
        <motion.div
          className={brand.cardGlowOrbTeal}
          aria-hidden
        />
        <motion.div
          initial={reduceMotion ? false : { y: 20 }}
          animate={{ y: 0 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.62, ease: [0.22, 1, 0.36, 1] }
          }
          className="relative max-w-full max-lg:overflow-x-clip overflow-y-visible rounded-2xl border border-white/75 bg-white/80 p-2 shadow-[0_36px_120px_-40px_rgba(91,33,217,0.32),0_0_0_1px_rgba(255,255,255,0.55)_inset] backdrop-blur-2xl sm:rounded-[2rem] sm:p-7 lg:overflow-visible lg:p-9 dark:border-white/[0.08] dark:bg-zinc-950/65 dark:shadow-[0_40px_120px_-48px_rgba(0,0,0,0.65)]"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_-8%,rgba(139,92,246,0.16),transparent_58%)] dark:bg-[radial-gradient(120%_85%_at_50%_-8%,rgba(167,139,250,0.14),transparent_58%)]"
            aria-hidden
          />
          <motion.div className="relative grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-12 lg:items-start lg:gap-x-12 lg:gap-y-8">
            <nav
              aria-label="Breadcrumb"
              className="order-first col-span-full hidden flex-wrap items-center gap-1 border-b border-zinc-200/70 pb-2 text-[11px] text-zinc-500 sm:flex lg:pb-4 lg:text-xs dark:border-zinc-800/80 dark:text-zinc-400"
            >
              <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200">
                {breadcrumbT.home}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              <Link
                href={PUBLIC_MARKETPLACE_BROWSE_PATH}
                className="hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Marketplace
              </Link>
              {categories.slice(0, 2).map((c) => (
                <Fragment key={c}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                  <span className="max-w-[12rem] truncate font-medium text-zinc-600 dark:text-zinc-300">{c}</span>
                </Fragment>
              ))}
            </nav>

          <motion.div
            className="order-2 flex min-w-0 flex-col gap-2 sm:gap-3 lg:order-none lg:col-span-7 lg:row-start-2 lg:gap-8 lg:overflow-visible"
            initial={reduceMotion ? false : { y: 10 }}
            animate={{ y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
          <section className="min-w-0 space-y-2 lg:space-y-4 lg:overflow-visible">
            <div className="max-lg:sticky max-lg:top-[calc(var(--site-header-offset,3.75rem)+0.35rem)] max-lg:z-20 max-lg:space-y-2 max-lg:bg-gradient-to-b max-lg:from-white max-lg:via-white/98 max-lg:to-white/90 max-lg:pb-2 max-lg:backdrop-blur-md dark:max-lg:from-zinc-950 dark:max-lg:via-zinc-950/98 dark:max-lg:to-zinc-950/90 sm:max-lg:space-y-3">
            <div className="relative max-lg:overflow-hidden max-lg:rounded-xl lg:overflow-visible">
              <ProductMediaGallery
                images={images}
                heroSrc={hero}
                activeThumbIndex={activeThumbIndex}
                onSelectImage={selectGalleryImage}
                videoUrl={galleryListingVideoUrl}
                productId={productId}
                alt={name}
                overlay={
                  <>
                    {offerBadge ? <ProductOfferBadge badge={offerBadge} /> : null}
                    {has3D ? (
                      <span
                        className={`pointer-events-none absolute left-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow-md ${
                          offerBadge ? "top-10" : "top-4"
                        }`}
                      >
                        {productT.view360}
                      </span>
                    ) : null}
                  </>
                }
              />
              <div className="absolute right-2 top-2 z-10 lg:hidden">
                <div className="rounded-full bg-white/95 p-1 shadow-md ring-1 ring-black/5 backdrop-blur-sm dark:bg-zinc-950/90 dark:ring-white/10">
                  <WishlistHeart productId={productId} />
                </div>
              </div>
            </div>

            {colorMeta.length > 0 ? (
              <ProductListingColorPicker
                colorMeta={colorMeta}
                showColorSwatches={showColorSwatches}
                selectedColor={selectedColor}
                onSelectColor={selectColor}
                colorLabel={productT.colorLabel}
                variants={variants}
                customColumns={customColumns}
                selection={shopperSelection}
                listingPriceCents={listingPriceCents}
                basePriceCents={basePriceCents}
                sizeOptions={sizeOptions}
                brandedStorefront={brandedStorefront}
                className="mx-1 sm:mx-0"
              />
            ) : null}
            {colorMeta.length > 0 ? (
              <p className="mx-1 text-center text-[11px] leading-snug text-zinc-500 sm:mx-0 lg:text-left dark:text-zinc-400">
                {productT.gallery.colorPreviewHint}
              </p>
            ) : null}
            </div>

            {arModel ? (
              <Button
                size="lg"
                variant="outline"
                className="hidden border-zinc-300 text-zinc-900 hover:bg-zinc-50 sm:inline-flex dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900"
                onClick={() => setShowAr(true)}
              >
                {productT.viewInAR}
              </Button>
            ) : null}

            <MobilePdpBuyPanel
              ref={mobilePurchaseRef}
              className="lg:hidden"
              titleHeadline={titleHeadline}
              titleSubline={titleSubline}
              categoryEyebrow={categoryEyebrow}
              listingPriceEur={listingPriceEur}
              activeRetailPriceEur={hasRetailCompare ? activeRetailPriceEur : null}
              hasRetailCompare={hasRetailCompare}
              salesCount={salesCount}
              reviewAverage={reviewSummary.average}
              reviewCount={reviewSummary.count}
              colorMeta={colorMeta}
              showColorSwatches={showColorSwatches}
              brandedStorefront={brandedStorefront}
              hideColorPicker
              selectedColor={selectedColor}
              onSelectColor={selectColor}
              storageOptions={storageOptions}
              selectedStorage={selectedStorage}
              onSelectStorage={setSelectedStorage}
              isStorageOptionDisabled={(cap) => {
                const row = findVariantRowForShopperSelection({
                  variants,
                  customColumns,
                  selection: {
                    selectedPrimary: selectedColor,
                    selectedStorage: cap,
                    selectedSize,
                  },
                })
                return row != null && row.stock <= 0
              }}
              sizeOptions={sizeOptions}
              selectedSize={selectedSize}
              onSelectSize={setSelectedSize}
              availableStock={availableStock}
              purchaseQty={purchaseQty}
              onQuantityChange={setPurchaseQty}
              cartBusy={cartBusy}
              buyBusy={buyBusy}
              onAddToCart={(e) => void addToCart(e)}
              onBuyNow={() => void buyNow()}
              buyNowLineSubtotalCents={buyNowLineSubtotalCents}
              priceFluidityNote={productT.priceFluidityNote}
              buyerRewardBadge={buyerRewardBadge}
              reduceMotion={reduceMotion ?? false}
              productId={productId}
              formatReviewCount={formatStoreCount}
              labels={{
                colorLabel: productT.colorLabel,
                storageLabel: productT.storageLabel,
                sizeLabel: productT.sizeLabel,
                priceLabel: productT.priceLabel,
                addToCart: productT.addToCart,
                buyNowShort: productT.buyNowShort,
                inStock: productT.inStock,
                outOfStock: productT.outOfStock,
                quantityOption: (count) => t(productT.quantityOption, { count }),
                quantityAria: productT.quantityAria,
                reviews: (count) => t(productT.reviews, { count }),
              }}
            />
            <div className="px-4 pb-3 lg:hidden">
              <ListingLogisticsStrip logistics={shipping} compact />
            </div>
          </section>
          </motion.div>

          <aside className="order-3 min-w-0 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:row-span-2 lg:sticky lg:top-28 lg:self-start lg:space-y-4">
            <div className="max-lg:divide-y max-lg:divide-zinc-100 max-lg:overflow-hidden max-lg:rounded-xl max-lg:border max-lg:border-zinc-200/90 max-lg:bg-white max-lg:shadow-sm dark:max-lg:divide-zinc-800 dark:max-lg:border-zinc-800 dark:max-lg:bg-zinc-950">
            <div className="hidden space-y-2.5 lg:block lg:pt-3 lg:pb-3">
            <header className="space-y-2 lg:space-y-3 lg:pt-3">
              <motion.div
                className="relative"
                initial={reduceMotion ? false : { y: 8 }}
                animate={{ y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className={brand.titleAccentBar}
                  aria-hidden
                />
                <div className="pl-0 lg:pl-2">
                  <SupplierTrustBadge
                    tier={supplierTrustTier}
                    isVerifiedSupplier={isVerifiedSupplier}
                    className="mb-2"
                    size="md"
                  />
                  {offerBadge ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <ProductOfferBadge badge={offerBadge} variant="inline" />
                    </div>
                  ) : null}
                </div>
                <h1 className="text-balance pl-0 lg:pl-2">
                  <span className="block text-[1.35rem] font-bold leading-[1.15] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[1.65rem]">
                    {titleHeadline}
                  </span>
                  {titleSubline ? (
                    <span
                      className={`mt-2 block text-sm font-normal leading-relaxed text-zinc-600 dark:text-zinc-400 ${
                        !titleExpanded && titleSublineLong ? "line-clamp-2" : ""
                      }`}
                    >
                      {titleSubline}
                    </span>
                  ) : null}
                </h1>
                {titleSubline && titleSublineLong ? (
                  <button
                    type="button"
                    onClick={() => setTitleExpanded((v) => !v)}
                    className="mt-2 text-xs font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                  >
                    {titleExpanded ? "Show shorter title" : "Show full title"}
                  </button>
                ) : null}
              </motion.div>

              <motion.div
                className="flex flex-wrap items-center gap-2"
                initial={reduceMotion ? false : { y: 6 }}
                animate={{ y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                {categoryEyebrow ? (
                  <span className={brand.categoryBadge}>
                    {categoryEyebrow}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  <Package className="h-3.5 w-3.5" aria-hidden />
                  {availableStock > 0 ? (
                    <>
                      {productT.inStock}
                      {availableStock <= 20 ? ` · ${availableStock} left` : null}
                    </>
                  ) : (
                    productT.outOfStock
                  )}
                </span>
                {shipping.freeShippingThresholdEUR != null && shipping.freeShippingThresholdEUR > 0 ? (
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Free shipping over {fmtMoney(shipping.freeShippingThresholdEUR)}
                  </span>
                ) : null}
              </motion.div>
            </header>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              {salesCount > 0 ? (
                <ProductSalesBadge count={salesCount} variant="detail" className="w-full sm:w-auto" />
              ) : null}
              <StarRatingRow value={reviewSummary.average} count={reviewSummary.count} />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {reviewSummary.average.toFixed(1)}
              </span>
              <a href="#listing-reviews" className={cn("text-sm", brand.accentText)}>
                {t(productT.reviews, { count: formatStoreCount(reviewSummary.count) })}
              </a>
              {viewsLast24h >= 12 ? (
                <span className="hidden rounded-full border border-orange-200/90 bg-gradient-to-r from-orange-50 to-amber-50 px-2 py-0.5 text-[10px] font-semibold text-orange-900 sm:inline-flex dark:border-orange-900/50 dark:from-orange-950/50 dark:to-amber-950/40 dark:text-orange-100">
                  <TrendingUp className="mr-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {t(productT.trendingViews24h, { count: formatStoreCount(viewsLast24h) })}
                </span>
              ) : null}
              {reviewSummary.count > 0 && reviewSummary.average >= 4.2 ? (
                <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 sm:inline dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {productT.topVentes}
                </span>
              ) : null}
            </div>

            {bookingCheckoutBlocked ? (
              <BookingComingSoonRail listingKind={listingKind} className="max-lg:hidden" />
              ) : bookingCheckoutLive ? (
                <>
                  <BookingSlotPicker
                    productId={productId}
                    listingKind={listingKind}
                    selectedSlotId={selectedBookingSlotId}
                    onSelectSlot={handleSelectBookingSlot}
                    className="max-lg:hidden"
                  />
                  {experienceBookingLive && selectedBookingSlotId ? (
                    <BookingNamedSeatPicker
                      className="max-lg:hidden"
                      productId={productId}
                      slotId={selectedBookingSlotId}
                      selectedLabels={selectedSeatLabels}
                      onChangeLabels={setSelectedSeatLabels}
                      onMapReady={setSlotUsesNamedSeats}
                    />
                  ) : null}
                </>
              ) : (
            <ListingPriceActionCard
              className="max-lg:hidden"
              brandedStorefront={brandedStorefront}
              priceLabel={productT.priceLabel}
              listingPriceEur={listingPriceEur}
              activeRetailPriceEur={hasRetailCompare ? activeRetailPriceEur : null}
              hasRetailCompare={hasRetailCompare}
              buyerRewardBadge={buyerRewardBadge}
              buyNowLineSubtotalCents={buyNowLineSubtotalCents}
              buyBusy={buyBusy}
              availableStock={availableStock}
              onBuyNow={() => void buyNow()}
              priceFluidityNote={productT.priceFluidityNote}
              buyNowShort={productT.buyNowShort}
              reduceMotion={reduceMotion ?? false}
            />
            )}
            </div>

            <div className="hidden space-y-2 px-4 py-2.5 lg:block lg:space-y-4 lg:px-0 lg:py-0">
            {availableStock <= 5 && availableStock > 0 ? (
              <p className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 lg:rounded-xl lg:py-2 lg:text-sm">
                {t(productT.onlyLeft, { count: Math.max(1, availableStock) })}
              </p>
            ) : null}

            <ListingLogisticsStrip logistics={shipping} className="lg:rounded-2xl" />
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-2.5 text-center dark:border-zinc-800 dark:bg-zinc-900/40 lg:rounded-2xl lg:p-3">
              <div className="flex flex-col items-center gap-1 px-1">
                <RotateCcw className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Returns
                </span>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{productT.return30d}</span>
              </div>
              <div className="flex flex-col items-center gap-1 border-l border-zinc-200/80 px-1 dark:border-zinc-700">
                <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Checkout
                </span>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{productT.securePayment}</span>
              </div>
            </div>
            <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 lg:-mt-3 lg:text-xs">
              {t(productT.deliveryTo, {
                city: deliveryPlace,
                date: etaDate,
              })}
            </p>
            </div>

            <div className="hidden space-y-3 px-4 py-3 lg:block lg:space-y-4 lg:px-0 lg:py-0">
            {partnerHighlightLabel ? (
              <p className={brand.partnerHighlight}>
                <span className="font-semibold">Partner highlight:</span> {partnerHighlightLabel}
              </p>
            ) : null}

            {storageOptions.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 lg:text-sm lg:normal-case lg:tracking-normal lg:text-zinc-900 dark:lg:text-zinc-100">
                    {productT.storageLabel}
                  </p>
                  {selectedStorage ? (
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 lg:text-sm">
                      {selectedStorage}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {storageOptions.map((cap) => {
                    const row = findVariantRowForShopperSelection({
                      variants,
                      customColumns,
                      selection: {
                        selectedPrimary: selectedColor,
                        selectedStorage: cap,
                        selectedSize,
                      },
                    })
                    const out = row != null && row.stock <= 0
                    const optionCents =
                      row && row.priceCents > 0
                        ? Math.max(
                            0,
                            listingPriceCents + (row.priceCents - Math.max(0, basePriceCents))
                          )
                        : activeListingPriceCents
                    return (
                      <button
                        key={cap}
                        type="button"
                        disabled={out}
                        onClick={() => setSelectedStorage(cap)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          selectedStorage === cap
                            ? brand.chipSelected
                            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                        } ${out ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <span className="block leading-tight">{cap}</span>
                        <span
                          className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                            selectedStorage === cap ? "text-white/90" : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {formatStoreCurrencyFromCents(optionCents)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {sizeOptions.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 lg:text-sm lg:normal-case lg:font-semibold lg:text-zinc-900 dark:lg:text-zinc-100">
                    {productT.sizeLabel}
                  </p>
                  {selectedSize ? (
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 lg:text-sm">
                      {selectedSize}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                        selectedSize === s
                          ? brand.chipSelected
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
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-100 lg:rounded-xl lg:text-sm">
                {sizeTip}
              </p>
            ) : null}
            </div>

            <motion.div
              ref={purchaseDockRef}
              id="listing-purchase-dock"
              className="relative hidden scroll-mt-28 rounded-[1.65rem] border border-zinc-200/90 bg-white p-5 shadow-[0_22px_56px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] dark:border-zinc-700/90 dark:bg-zinc-950 dark:shadow-black/50 dark:ring-white/[0.04] lg:block"
              initial={reduceMotion ? false : { y: 10 }}
              animate={{ y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              {bookingCheckoutBlocked ? (
                <BookingComingSoonRail listingKind={listingKind} />
              ) : bookingCheckoutLive ? (
                <>
                  <BookingSlotPicker
                    productId={productId}
                    listingKind={listingKind}
                    selectedSlotId={selectedBookingSlotId}
                    onSelectSlot={handleSelectBookingSlot}
                  />
                  {experienceBookingLive && selectedBookingSlotId ? (
                    <BookingNamedSeatPicker
                      productId={productId}
                      slotId={selectedBookingSlotId}
                      selectedLabels={selectedSeatLabels}
                      onChangeLabels={setSelectedSeatLabels}
                      onMapReady={setSlotUsesNamedSeats}
                    />
                  ) : null}
                </>
              ) : (
              <>
              <div className="mb-3 hidden items-start gap-2.5 lg:flex">
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
                      href="/marketplace/account/wallet"
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

              <MarketplacePurchaseQuantity
                className="mb-1"
                quantity={purchaseQty}
                onQuantityChange={setPurchaseQty}
                availableStock={multiGuestBookingLive && !slotUsesNamedSeats ? bookingTicketStock : availableStock}
                inStockLabel={productT.inStock}
                outOfStockLabel={productT.outOfStock}
                quantityOptionLabel={(count) => t(productT.quantityOption, { count })}
                quantityAriaLabel={productT.quantityAria}
                  disabled={cartBusy || buyBusy || bookingCheckoutBlocked || bookingSlotRequired || bookingSeatsRequired || serviceBookingLive || slotUsesNamedSeats}
              />

              <div className="flex flex-col gap-2.5 lg:gap-3">
                <div className="flex gap-2 lg:block">
                <motion.button
                  type="button"
                  disabled={cartBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingCheckoutLive}
                  whileHover={{ scale: availableStock > 0 && !cartBusy ? 1.01 : 1 }}
                  whileTap={{ scale: availableStock > 0 && !cartBusy ? 0.99 : 1 }}
                  onClick={(e) => void addToCart(e)}
                  className={cn("group flex h-12 min-w-0 flex-1 lg:w-full", brand.ctaPrimary)}
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition group-hover:opacity-100" aria-hidden />
                  <ShoppingBag className="relative h-5 w-5 shrink-0" aria-hidden />
                  <span className="relative">{cartBusy ? "Adding…" : productT.addToCart}</span>
                </motion.button>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900/60 lg:hidden"
                  aria-label={messages.wishlist.title}
                >
                  <WishlistHeart productId={productId} />
                </div>
                </div>

                <motion.button
                  type="button"
                  disabled={buyBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingSlotRequired || bookingSeatsRequired}
                  whileHover={{ scale: availableStock > 0 && !buyBusy ? 1.012 : 1 }}
                  whileTap={{ scale: availableStock > 0 && !buyBusy ? 0.988 : 1 }}
                  onClick={() => void buyNow()}
                  className={cn("group flex h-12 w-full", brand.ctaSecondary)}
                >
                  <MousePointerClick className={cn("h-4 w-4 shrink-0 lg:hidden", brand.accentIcon)} aria-hidden />
                  <span className="relative">{buyBusy ? "Redirecting…" : productT.buyNowShort}</span>
                  <ArrowRight className={cn("hidden h-5 w-5 shrink-0 lg:block", brand.accentIcon)} aria-hidden />
                </motion.button>

                <button
                  type="button"
                  onClick={() => void savePriceAlert()}
                  className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-zinc-200/90 bg-zinc-100/80 px-3 py-2.5 text-left text-xs font-semibold text-zinc-900 transition hover:border-amber-300/80 hover:bg-amber-50/50 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-amber-700/50 dark:hover:bg-amber-950/25 lg:rounded-2xl lg:px-3.5 lg:py-3 lg:text-sm"
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
              </>
              )}
            </motion.div>
            </div>

            <motion.div
              initial={reduceMotion ? false : { y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-950/80 dark:ring-white/[0.04]"
              aria-label="Product details"
            >
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-violet-50/80 via-white to-teal-50/40 px-4 py-2.5 dark:border-zinc-800 dark:from-violet-950/30 dark:via-zinc-950 dark:to-teal-950/20">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  Details
                </p>
                <span className="text-[10px] font-medium tabular-nums text-zinc-400 dark:text-zinc-500">
                  {reviewSummary.count > 0
                    ? `${reviewSummary.average.toFixed(1)}★ · ${formatStoreCount(reviewSummary.count)}`
                    : "No reviews yet"}
                </span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                <details
                  id="listing-description-footer"
                  className="group scroll-mt-28 [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                      Description
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="space-y-2 border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                    {descriptionFooterExcerpt ? (
                      <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">{descriptionFooterExcerpt}</p>
                    ) : (
                      <p className="text-xs italic text-zinc-500 dark:text-zinc-400">No written description for this listing.</p>
                    )}
                    <a
                      href="#product-description"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                    >
                      Full story in About this product
                      <span aria-hidden>↑</span>
                    </a>
                  </div>
                </details>
                <details
                  id="listing-specs"
                  className="group scroll-mt-28 [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                      Specifications
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                    {productSpecs.length > 0 ? (
                      <dl className="grid gap-x-4 gap-y-2.5">
                        {productSpecs.map((row) => (
                          <div
                            key={`${row.label}:${row.value.slice(0, 32)}`}
                            className="grid grid-cols-[minmax(0,38%)_1fr] gap-x-2 gap-y-0.5 border-b border-zinc-100/80 pb-2 last:border-0 last:pb-0 dark:border-zinc-800/80"
                          >
                            <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{row.label}</dt>
                            <dd className="text-xs text-zinc-900 dark:text-zinc-100">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <ul
                      className={`space-y-1 text-xs text-zinc-700 dark:text-zinc-300 ${productSpecs.length > 0 ? "mt-3 border-t border-dashed border-zinc-200/80 pt-3 dark:border-zinc-700" : ""}`}
                    >
                      <li>Colour options: {colorNames.length || "—"}</li>
                      <li>Average rating: {reviewSummary.average.toFixed(1)} / 5</li>
                    </ul>
                  </div>
                </details>
                <details className="group [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                      Shipping
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                    Delivery {shipping.deliveryMin}-{shipping.deliveryMax} business days. Processing in{" "}
                    {shipping.processingTime} day(s).
                  </p>
                </details>
                <details
                  id="listing-reviews-summary"
                  className="group scroll-mt-28 [&[open]>summary]:bg-violet-50/80 dark:[&[open]>summary]:bg-violet-950/30"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50/80 dark:text-zinc-100 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden />
                      Reviews snapshot
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="border-t border-zinc-100/80 bg-zinc-50/40 px-4 py-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                    <p className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">
                      {reviewSummary.average.toFixed(1)} ({formatStoreCount(reviewSummary.count)} reviews)
                    </p>
                    {ratingBreakdown ? (
                      <p className="text-zinc-600 dark:text-zinc-400">
                        5★: {ratingBreakdown[5] ?? 0} · 4★: {ratingBreakdown[4] ?? 0} · 3★:{" "}
                        {ratingBreakdown[3] ?? 0}
                      </p>
                    ) : null}
                  </div>
                </details>
              </div>
            </motion.div>

            {storefront ? (
              <Link
                href={`/store/${encodeURIComponent(storefront.slug)}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 transition hover:border-violet-200 hover:bg-violet-50/40 max-lg:mx-0 max-lg:mt-2 lg:rounded-2xl lg:p-4 dark:border-zinc-800 dark:hover:border-violet-900/50 dark:hover:bg-violet-950/20"
              >
                {storefront.aiAvatarUrl || storefront.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- storefront logo / AI avatar URLs */
                  <img
                    src={storefront.aiAvatarUrl || storefront.logoUrl || ""}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl border border-zinc-100 bg-white object-cover object-center p-0.5 dark:border-zinc-700"
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
            ) : audience === "merchant" ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{t(productT.byStore, { store: sellerLabel })}</p>
            ) : null}
          </aside>

          <motion.div
            className="order-4 flex min-w-0 flex-col gap-6 lg:order-none lg:col-span-7 lg:row-start-3"
            initial={reduceMotion ? false : { y: 10 }}
            animate={{ y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              aria-hidden
              className="hidden h-px w-full bg-gradient-to-r from-transparent via-zinc-200/90 to-transparent dark:via-zinc-700/80 lg:block"
            />

            <motion.div
              id="product-description"
              initial={reduceMotion ? false : { y: 12 }}
              animate={{ y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="relative max-w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/80 p-4 shadow-sm sm:p-6 dark:border-zinc-700/80 dark:from-zinc-900/90 dark:to-zinc-950/80"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent dark:via-violet-500/25"
                aria-hidden
              />
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <FileText className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">About this product</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Full copy from the listing · specs below</p>
                </div>
              </div>
              {glanceText ? (
                <blockquote className="mt-5 border-l-4 border-violet-500/60 bg-violet-50/50 py-3 pl-4 pr-3 text-sm italic leading-relaxed text-zinc-800 dark:border-violet-500/40 dark:bg-violet-950/25 dark:text-zinc-200">
                  {glanceText}
                </blockquote>
              ) : null}
              {descriptionBullets.length > 0 ? (
                <div className={glanceText ? "mt-6" : "mt-5"}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                    Highlights
                  </p>
                  <ul className="mt-3 list-none space-y-2.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {descriptionBullets.map((line, i) => (
                      <li key={`hero-bullet-${i}`} className="flex gap-3">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm shadow-violet-500/30"
                          aria-hidden
                        />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className={descriptionBullets.length > 0 ? "mt-8 border-t border-zinc-100 pt-6 dark:border-zinc-800" : "mt-5"}>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Full detail</p>
                <div
                  className={cn(
                    "relative mt-3",
                    !descExpanded && descriptionIsLong && "max-h-[min(420px,55vh)] overflow-hidden"
                  )}
                >
                  <DescriptionRichContent description={description} images={descriptionIllustrationImages} />
                  {!descExpanded && descriptionIsLong ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-zinc-900 dark:via-zinc-900/90"
                      aria-hidden
                    />
                  ) : null}
                </div>
                {descriptionIsLong ? (
                  <button
                    type="button"
                    onClick={() => setDescExpanded((v) => !v)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50/60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/30"
                  >
                    {descExpanded ? "Show less" : "Show full description"}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${descExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                ) : null}
                <DescriptionIllustrativeMedia
                  productId={productId}
                  images={descriptionGalleryImages}
                  videos={descriptionIllustrationVideos}
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
                <a
                  href="#listing-specs"
                  className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                >
                  Technical specs
                </a>
                <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                  ·
                </span>
                <a
                  href="#listing-reviews"
                  className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                >
                  {t(productT.reviews, { count: formatStoreCount(reviewSummary.count) })}
                </a>
              </div>
            </motion.div>
          </motion.div>
          </motion.div>
        </motion.div>
        </div>


      <section className="mt-12 max-w-full overflow-x-clip border-t border-zinc-200/80 pt-10 dark:border-zinc-800">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          }
        >
          <ReviewsEngine
            productId={productId}
            productName={name}
            listingId={listingId}
            initialSummary={{
              averageRating: reviewSummary.average,
              reviewCount: reviewSummary.count,
              ugcCount: reviewSummary.ugcCount ?? 0,
              distribution: ratingBreakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            }}
            canWriteReview={Boolean(writeReviewOrderId)}
            writeReviewOrderId={writeReviewOrderId}
            openWriteOnMount={openWriteReview}
          />
        </Suspense>
      </section>

      {oftenBoughtTogether.length > 0 ? (
      <section className="mt-10">
        <h2 className="text-xl font-bold">Frequently bought together</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {oftenBoughtTogether.slice(0, 3).map((p) => (
            <BuyerRelatedListingTile key={p.id} p={p} />
          ))}
        </div>
      </section>
      ) : null}

      {alsoViewed.length > 0 ? (
      <section className="mt-10">
        <h2 className="text-xl font-bold">Customers also viewed</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {alsoViewed.slice(0, 3).map((p) => (
            <BuyerRelatedListingTile key={p.id} p={p} />
          ))}
        </div>
      </section>
      ) : null}

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

      <motion.div
        role="region"
        aria-label={t(productT.stickyBuyHint)}
        aria-hidden={!(availableStock > 0 && showStickyBuy && !showAr)}
        className="fixed inset-x-0 bottom-0 z-[85] max-w-[100vw] px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:z-40"
        initial={false}
        animate={
          reduceMotion
            ? { opacity: availableStock > 0 && showStickyBuy && !showAr ? 1 : 0 }
            : {
                y: availableStock > 0 && showStickyBuy && !showAr ? 0 : 120,
                opacity: availableStock > 0 && showStickyBuy && !showAr ? 1 : 0,
              }
        }
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        style={{
          pointerEvents:
            availableStock > 0 && showStickyBuy && !showAr && !bookingCheckoutBlocked
              ? "auto"
              : "none",
        }}
      >
        <div className={brand.stickyBar}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
              {titleHeadline}
            </p>
            <p className={brand.stickyPrice}>
              {priceDisplay}
            </p>
          </div>
          <Button
            type="button"
            disabled={buyBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingSlotRequired}
            onClick={() => void buyNow()}
            className={brand.stickySecondaryBtn}
          >
            {productT.buyNowShort}
          </Button>
          <Button
            type="button"
            disabled={cartBusy || availableStock <= 0 || bookingCheckoutBlocked || bookingCheckoutLive}
            onClick={(e) => void addToCart(e)}
            className={brand.ctaPrimarySticky}
          >
            {cartBusy ? "…" : productT.addToCart}
          </Button>
        </div>
      </motion.div>
    </>
  )
}
