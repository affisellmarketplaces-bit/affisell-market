"use client"

import { useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useReducedMotion } from "framer-motion"
import type { GhostOosPayload } from "@/components/checkout/OutOfStockModal"
import { requestPriceAlertPushSubscription } from "@/components/push/request-price-alert-push"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { useBuyNowWithIdentity } from "@/hooks/use-buy-now-with-identity"
import {
  isBookingCheckoutBlocked,
  isBookingCheckoutLiveForKind,
} from "@/lib/booking/checkout-live"
import {
  isBookableListingKind,
  isExperienceListingKind,
  isServiceListingKind,
} from "@/lib/booking/types"
import type { AppLocale } from "@/lib/i18n-locale"
import { appMessagesForLocale } from "@/lib/i18n-app-messages"
import { shopListingPath } from "@/lib/affiliate-routes"
import { buildMarketplaceColorMeta, shouldShowMarketplaceColorSwatches, shopperColorLabelsMatch } from "@/lib/marketplace-color-meta"
import { shopperCategoryEyebrow } from "@/lib/product-shopper-tags"
import {
  clampPurchaseQuantity,
  resolveListingAvailableStock,
} from "@/lib/marketplace-purchase-quantity"
import {
  formatStoreCurrencyFromCents,
  formatStoreDate,
} from "@/lib/market-config"
import { resolveUsableProductImageUrl } from "@/lib/product-image-url"
import {
  colorForImageIndex,
  galleryIndexForImageUrl,
  imageIndexForColor,
  resolveColorHeroImageUrl,
} from "@/lib/product-color-images"
import {
  findVariantRowForShopperSelection,
  type ShopperVariantSelection,
} from "@/lib/marketplace-variant-dimensions"
import {
  marketplaceRetailPriceEurForOption,
} from "@/lib/product-variants"
import {
  resolveAffiliateSellingPriceCentsForOption,
} from "@/lib/affiliate-variant-pricing"
import { storefrontPdpBrandClasses } from "@/lib/storefront-pdp-brand"
import { STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS } from "@/lib/stripe-minimum"
import { descriptionHasImageMarkers, stripDescriptionImageMarkers } from "@/lib/description-rich-content"
import type { ListingDetailProps } from "./listing-detail-types"
import { EMPTY_SIZE_OPTIONS, listingAtAGlance, splitListingTitle, t } from "./listing-detail-utils"

export function useListingDetailController(props: ListingDetailProps) {
  const {
    audience = "customer",
    listingId,
    productId,
    listingKind = "PHYSICAL",
    promotedColor = null,
    promotedSize = null,
    name,
    description,
    descriptionIllustrationImages = [],
    sellerLabel,
    partnerLabel,
    storefront,
    tags,
    gallery,
    categories,
    colorNames,
    storageOptions = [],
    customColumns,
    variants,
    colorImages,
    colorDisplayLabels = null,
    shipping,
    listingPriceCents,
    variantPricing = null,
    basePriceCents,
    stock,
    battleId = null,
    flashPercent = null,
    flashPrice = null,
    isBattleWinner = false,
    retailPriceEur,
    initialRewardBalanceCents = undefined,
    tryOnEnabled = false,
    tryOnGarmentUrl = null,
    tryOnFeatureEnabled = false,
    brandedStorefront = false,
    storeLayoutImmersive = false,
  } = props

  const safeCustomColumns = customColumns ?? []

  const locale = useLocale() as AppLocale
  const brand = storefrontPdpBrandClasses(brandedStorefront)
  const tryOnVariant =
    brandedStorefront && storeLayoutImmersive ? ("immersive" as const) : ("default" as const)
  const messages = appMessagesForLocale(locale)
  const productT = messages.Product
  const checkoutSellerName =
    brandedStorefront && (partnerLabel?.trim() || storefront?.name?.trim())
      ? (partnerLabel?.trim() || storefront!.name.trim())
      : sellerLabel
  const router = useRouter()
  const { buyNow: buyNowWithIdentity, identitySheet } = useBuyNowWithIdentity()
  const reduceMotion = useReducedMotion()
  const [ghostOos, setGhostOos] = useState<GhostOosPayload | null>(null)
  const tryOnReady =
    tryOnFeatureEnabled && tryOnEnabled && Boolean(tryOnGarmentUrl?.trim())
  const purchaseDockRef = useRef<HTMLDivElement>(null)
  const mobilePurchaseRef = useRef<HTMLElement>(null)
  const [tryOnOpen, setTryOnOpen] = useState(false)
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
  const isShoeProduct = useMemo(() => {
    const hay = [...categories, ...tags, name].join(" ").toLowerCase()
    return /chaussure|chauss|shoe|sneaker|basket|footwear|pointure/.test(hay)
  }, [categories, tags, name])
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

  /* eslint-disable react-hooks/exhaustive-deps -- only reset hero when listing or promoted color changes */
  useEffect(() => {
    setGalleryHeroLock(true)
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

  const bookingCheckoutLabels = {
    priceLabel: productT.priceLabel,
    buyNowShort: productT.buyNowShort,
    priceFluidityNote: productT.priceFluidityNote,
    inStock: productT.inStock,
    outOfStock: productT.outOfStock,
    quantityOption: (count: number) => t(productT.quantityOption, { count }),
    quantityAria: productT.quantityAria,
  }
  const [rewardBalanceCents, setRewardBalanceCents] = useState(initialRewardBalanceCents ?? 0)
  const [useRewardCents, setUseRewardCents] = useState(0)

  const colorMeta = useMemo(
    () => buildMarketplaceColorMeta(colorNames, colorImages, colorDisplayLabels),
    [colorNames, colorImages, colorDisplayLabels]
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
        customColumns: safeCustomColumns,
        selection: shopperSelection,
      }),
    [variants, safeCustomColumns, shopperSelection]
  )

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
    const optionName = activeVariantRow?.name?.trim() || selectedColor
    return resolveAffiliateSellingPriceCentsForOption({
      listingSellingPriceCents: listingPriceCents,
      productBasePriceCents: basePriceCents,
      variants,
      optionName,
      variantPricing,
    })
  }, [
    activeVariantRow?.name,
    basePriceCents,
    listingPriceCents,
    selectedColor,
    variantPricing,
    variants,
  ])

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
  const flashUnitCents =
    isBattleWinner &&
    typeof flashPercent === "number" &&
    flashPercent > 0 &&
    flashPercent < 90
      ? Math.max(1, Math.floor(activeListingPriceCents * (1 - flashPercent / 100)))
      : typeof flashPrice === "number" && Number.isFinite(flashPrice) && flashPrice > 0
        ? Math.round(flashPrice * 100)
        : null
  const displayFlashPriceEur =
    typeof flashPrice === "number" && Number.isFinite(flashPrice) && flashPrice > 0
      ? flashPrice
      : flashUnitCents != null
        ? flashUnitCents / 100
        : null
  const unitCentsForBuy = flashUnitCents ?? activeListingPriceCents
  const hasRetailCompare =
    typeof activeRetailPriceEur === "number" && activeRetailPriceEur > listingPriceEur
  const compareRetailPriceEur = hasRetailCompare ? (activeRetailPriceEur ?? null) : null
  const glanceText = useMemo(() => listingAtAGlance(description, name, tags), [description, name, tags])

  const descriptionFooterExcerpt = useMemo(() => {
    const d = stripDescriptionImageMarkers(description).replace(/\s+/g, " ").trim()
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

  const buyNowLineSubtotalCents = unitCentsForBuy * (serviceBookingLive ? 1 : purchaseQty)
  const maxApplicableReward = useMemo(() => {
    if (buyNowLineSubtotalCents <= 0) return 0
    return Math.max(
      0,
      Math.min(rewardBalanceCents, buyNowLineSubtotalCents - STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS)
    )
  }, [buyNowLineSubtotalCents, rewardBalanceCents])

  useEffect(() => {
    if (initialRewardBalanceCents != null) {
      setRewardBalanceCents(initialRewardBalanceCents)
      return
    }
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
  }, [initialRewardBalanceCents])

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

  const addToCart = useCallback(
    async (e?: MouseEvent) => {
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
          sellerName: checkoutSellerName,
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
    },
    [
      bookingCheckoutBlocked,
      bookingCheckoutLive,
      cartSelectedSize,
      checkoutSellerName,
      hero,
      listingId,
      listingPriceEur,
      messages.cart.guestAdded,
      messages.cart.guestAddedBody,
      name,
      purchaseQty,
      router,
      selectedColor,
    ]
  )

  const buyNow = useCallback(async () => {
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
    if (sizeOptions.length > 0 && !selectedSize) {
      const { toast } = await import("sonner")
      toast.error(productT.sizeLabel, {
        description: locale === "fr" ? "Choisissez une taille pour continuer." : "Select a size to continue.",
      })
      return
    }
    setBuyBusy(true)
    try {
      const applied = Math.min(Math.max(0, Math.round(useRewardCents)), maxApplicableReward)
      const checkoutQty =
        selectedSeatLabels.length > 0 ? selectedSeatLabels.length : serviceBookingLive ? 1 : purchaseQty
      const cancelPath = storefront?.slug
        ? shopListingPath(storefront.slug, listingId)
        : `/marketplace/${listingId}`
      const outcome = await buyNowWithIdentity(
        {
          productId: listingId,
          qty: checkoutQty,
          bookingSlotId: selectedBookingSlotId ?? undefined,
          bookingSeatLabels:
            selectedSeatLabels.length > 0 ? selectedSeatLabels : undefined,
          useRewardCents: applied,
          selectedColor: selectedColor ?? undefined,
          selectedSize: cartSelectedSize ?? undefined,
          cancelPath,
          ...(battleId ? { battleId } : {}),
        },
        {
          productId: listingId,
          title: name,
          imageUrl: hero,
          sellerName: checkoutSellerName,
          price: displayFlashPriceEur ?? listingPriceEur,
          selectedColor: selectedColor ?? undefined,
          selectedSize: cartSelectedSize ?? undefined,
        }
      )
      if (typeof outcome === "object" && outcome.kind === "out_of_stock") {
        setGhostOos(outcome.payload)
        return
      }
      if (outcome === "error") {
        const { toast } = await import("sonner")
        toast.error(messages.checkout.checkoutError, {
          description:
            locale === "fr"
              ? "Choisissez un créneau (et vos places si besoin), puis réessayez."
              : "Pick a time slot (and seats if needed), then try again.",
        })
      }
    } finally {
      setBuyBusy(false)
    }
  }, [
    battleId,
    bookingCheckoutBlocked,
    bookingSeatsRequired,
    bookingSlotRequired,
    buyNowWithIdentity,
    cartSelectedSize,
    checkoutSellerName,
    displayFlashPriceEur,
    hero,
    listingId,
    listingPriceEur,
    locale,
    maxApplicableReward,
    messages.checkout.checkoutError,
    name,
    productT.booking.selectSeatsRequired,
    productT.booking.selectSlotRequired,
    productT.sizeLabel,
    purchaseQty,
    selectedBookingSlotId,
    selectedColor,
    selectedSeatLabels,
    selectedSize,
    serviceBookingLive,
    sizeOptions.length,
    storefront?.slug,
    useRewardCents,
  ])

  const savePriceAlert = useCallback(async () => {
    const target = Math.max(1, Math.round((listingPriceEur * 0.95) * 100) / 100)
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, targetPrice: target }),
      credentials: "include",
    })
    if (!res.ok) return
    setAlertSaved(true)
    const push = await requestPriceAlertPushSubscription()
    if (push === "granted") {
      const { toast } = await import("sonner")
      toast.success(productT.priceAlertSavedSub, {
        description: locale === "fr" ? "Notifications push activées" : "Push notifications enabled",
      })
    }
  }, [listingPriceEur, locale, productId, productT.priceAlertSavedSub])

  const isStorageOptionDisabled = useCallback(
    (cap: string) => {
      const row = findVariantRowForShopperSelection({
        variants,
        customColumns: safeCustomColumns,
        selection: {
          selectedPrimary: selectedColor,
          selectedStorage: cap,
          selectedSize,
        },
      })
      return row != null && row.stock <= 0
    },
    [safeCustomColumns, selectedColor, selectedSize, variants]
  )

  return {
    audience,
    brand,
    tryOnVariant,
    tryOnReady,
    messages,
    productT,
    locale,
    reduceMotion,
    identitySheet,
    ghostOos,
    setGhostOos,
    purchaseDockRef,
    mobilePurchaseRef,
    tryOnOpen,
    setTryOnOpen,
    titleExpanded,
    setTitleExpanded,
    titleHeadline,
    titleSubline,
    titleSublineLong,
    categoryEyebrow,
    images,
    sizeOptions,
    isShoeProduct,
    partnerHighlightLabel,
    selectedColor,
    selectedSize,
    setSelectedSize,
    selectedStorage,
    setSelectedStorage,
    descExpanded,
    setDescExpanded,
    descriptionIsLong,
    descriptionGalleryImages,
    selectColor,
    selectGalleryImage,
    cartBusy,
    buyBusy,
    purchaseQty,
    setPurchaseQty,
    showAr,
    setShowAr,
    sizeTip,
    alertSaved,
    selectedBookingSlotId,
    selectedSeatLabels,
    setSelectedSeatLabels,
    slotUsesNamedSeats,
    setSlotUsesNamedSeats,
    bookingCheckoutBlocked,
    bookingCheckoutLive,
    serviceBookingLive,
    experienceBookingLive,
    multiGuestBookingLive,
    bookingSlotRequired,
    bookingSeatsRequired,
    bookingCheckoutLabels,
    rewardBalanceCents,
    useRewardCents,
    setUseRewardCents,
    maxApplicableReward,
    colorMeta,
    showColorSwatches,
    shopperSelection,
    activeVariantRow,
    hero,
    activeThumbIndex,
    activeListingPriceCents,
    compareRetailPriceEur,
    hasRetailCompare,
    priceDisplay,
    listingPriceEur,
    displayFlashPriceEur,
    buyNowLineSubtotalCents,
    glanceText,
    descriptionFooterExcerpt,
    availableStock,
    bookingTicketStock,
    handleSelectBookingSlot,
    etaDate,
    deliveryPlace,
    addToCart,
    buyNow,
    savePriceAlert,
    isStorageOptionDisabled,
    safeCustomColumns,
  }
}

export type ListingDetailController = ReturnType<typeof useListingDetailController>
