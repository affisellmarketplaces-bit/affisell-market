import { NextResponse } from "next/server"

import {
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { auth } from "@/auth"
import {
  formatCartVariantLabel,
  normalizeCartVariantSignature,
  parseCartVariantSignature,
} from "@/lib/cart-variant"
import {
  fixZeroPaidLinesCents,
  proportionalLinePaidsCents,
  STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS,
} from "@/lib/marketplace-checkout-discount"
import { prisma } from "@/lib/prisma"
import {
  marketplaceSellingPriceCentsForOption,
  variantsFromDb,
} from "@/lib/product-variants"
import { stripeProductImages } from "@/lib/product-images"
import { getStripeClient } from "@/lib/stripe"

function checkoutBaseUrls(body: { cancelPath?: string; successPath?: string }) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "")

  const cancelPath =
    typeof body.cancelPath === "string" && body.cancelPath.startsWith("/") ? body.cancelPath : "/"

  const successPath =
    typeof body.successPath === "string" && body.successPath.startsWith("/") ? body.successPath : "/success"

  return { baseUrl, cancelPath, successPath }
}

type CartLineInput = {
  productId?: string
  qty?: number
  variantSignature?: string
  selectedColor?: string | null
  selectedSize?: string | null
}

function resolveCheckoutVariantLabel(row: CartLineInput): string {
  const explicit = formatCartVariantLabel(row.selectedColor, row.selectedSize)
  if (explicit) return explicit
  const raw = typeof row.variantSignature === "string" ? row.variantSignature.trim() : ""
  if (!raw) return ""
  const p = parseCartVariantSignature(raw)
  return formatCartVariantLabel(p.color, p.size)
}

function checkoutOptionName(row: CartLineInput): string | null {
  const color = typeof row.selectedColor === "string" ? row.selectedColor.trim() : ""
  if (color) return color
  const raw = typeof row.variantSignature === "string" ? row.variantSignature.trim() : ""
  if (!raw) return null
  return parseCartVariantSignature(raw).color || null
}

function lineSellingPriceCents(
  listing: NonNullable<Awaited<ReturnType<typeof loadListing>>>,
  row: CartLineInput
): number {
  const variants = variantsFromDb(listing.product.variants)
  return marketplaceSellingPriceCentsForOption({
    listingSellingPriceCents: listing.sellingPriceCents,
    productBasePriceCents: listing.product.basePriceCents,
    variants,
    optionName: checkoutOptionName(row),
  })
}

async function loadListing(id: string) {
  return prisma.affiliateProduct.findFirst({
    where: {
      id,
      isListed: true,
      product: { active: true },
      affiliate: { role: "AFFILIATE" },
    },
    include: { product: true },
  })
}

type LoadedLine = {
  affiliateProductId: string
  qty: number
  variantSignature: string
  variantLabel: string
  listing: NonNullable<Awaited<ReturnType<typeof loadListing>>>
}

type StripeLineItem = {
  price_data: {
    currency: "eur"
    unit_amount: number
    product_data: { name: string; images: string[] }
  }
  quantity: number
}

function pushLineItemsForPaidTotal(
  items: StripeLineItem[],
  listing: LoadedLine["listing"],
  linePaidCents: number,
  qty: number,
  variantLabel: string
) {
  const baseTitle = listingDisplayTitle(listing.customTitle, listing.product.name)
  const variantSuffix = variantLabel.trim() ? ` · ${variantLabel.trim()}` : ""
  const displayName =
    qty > 1 ? `${baseTitle}${variantSuffix} ×${qty}` : `${baseTitle}${variantSuffix}`
  const gallery = listingGalleryUrls(listing.customImages, listing.product.images)
  const images = stripeProductImages(gallery) ?? []
  const total = Math.round(linePaidCents)
  items.push({
    price_data: {
      currency: "eur",
      unit_amount: total,
      product_data: { name: displayName, images },
    },
    quantity: 1,
  })
}

function computePaidLinesWithReward(args: {
  lineSubtotalsCents: number[]
  balanceCents: number
  requestedRewardCents: number
}): { appliedCents: number; paidLineCents: number[] } {
  const sub = args.lineSubtotalsCents.reduce((a, b) => a + b, 0)
  const maxApply = Math.max(
    0,
    Math.min(args.balanceCents, sub - STRIPE_CHECKOUT_MIN_CARD_CHARGE_CENTS)
  )
  const want = Math.max(0, Math.round(args.requestedRewardCents))
  const applied = Math.min(want, maxApply)
  const targetPaid = sub - applied
  const rawPaid = proportionalLinePaidsCents(args.lineSubtotalsCents, targetPaid)
  const paidLineCents = fixZeroPaidLinesCents(args.lineSubtotalsCents, rawPaid)
  return { appliedCents: applied, paidLineCents }
}

/** Stripe Checkout for multiple marketplace lines (EUR). */
async function checkoutFromItems(
  lines: CartLineInput[],
  opts: { cancelPath?: string; successPath?: string; useRewardCents?: number }
) {
  const stripe = getStripeClient()
  const session = await auth()
  const buyerUserId = session?.user?.id?.trim() || ""

  const normalized: {
    affiliateProductId: string
    qty: number
    variantSignature: string
    variantLabel: string
  }[] = []
  for (const row of lines) {
    const affiliateProductId = typeof row.productId === "string" ? row.productId.trim() : ""
    if (!affiliateProductId) continue
    const qty = Math.max(1, Math.min(99, Math.round(Number(row.qty)) || 1))
    const variantSignature =
      typeof row.variantSignature === "string" && row.variantSignature.trim()
        ? row.variantSignature.trim().slice(0, 200)
        : normalizeCartVariantSignature(row.selectedColor, row.selectedSize)
    const variantLabel = resolveCheckoutVariantLabel(row).slice(0, 200)
    normalized.push({ affiliateProductId, qty, variantSignature, variantLabel })
  }

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 })
  }

  const loaded: LoadedLine[] = []
  for (const row of normalized) {
    const listing = await loadListing(row.affiliateProductId)
    if (!listing || !listing.product.active || !listing.product.supplierId) {
      return NextResponse.json({ error: "Listing not found or inactive" }, { status: 404 })
    }
    loaded.push({
      affiliateProductId: row.affiliateProductId,
      qty: row.qty,
      variantSignature: row.variantSignature,
      variantLabel: row.variantLabel,
      listing,
    })
  }

  const lineSubtotalsCents = loaded.map((l, i) => {
    const n = normalized[i]!
    const parsed = parseCartVariantSignature(n.variantSignature)
    const unit = lineSellingPriceCents(l.listing, {
      variantSignature: n.variantSignature,
      selectedColor: parsed.color,
      selectedSize: parsed.size,
    })
    return unit * l.qty
  })
  let balanceCents = 0
  if (buyerUserId) {
    const u = await prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { buyerRewardBalanceCents: true },
    })
    balanceCents = u?.buyerRewardBalanceCents ?? 0
  }

  const requestedReward =
    typeof opts.useRewardCents === "number" && Number.isFinite(opts.useRewardCents)
      ? opts.useRewardCents
      : 0

  const { appliedCents, paidLineCents } = computePaidLinesWithReward({
    lineSubtotalsCents,
    balanceCents,
    requestedRewardCents: buyerUserId ? requestedReward : 0,
  })

  for (let i = 0; i < paidLineCents.length; i++) {
    if (lineSubtotalsCents[i]! > 0 && paidLineCents[i]! < 1) {
      return NextResponse.json(
        {
          error:
            "Unable to apply store credit across these lines. Try a smaller amount or fewer items.",
        },
        { status: 400 }
      )
    }
  }

  const stripeLineItems: StripeLineItem[] = []
  for (let i = 0; i < loaded.length; i++) {
    const row = loaded[i]!
    pushLineItemsForPaidTotal(stripeLineItems, row.listing, paidLineCents[i]!, row.qty, row.variantLabel)
  }

  const { baseUrl, cancelPath, successPath } = checkoutBaseUrls(opts)

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: stripeLineItems,
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    customer_creation: "always",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["US", "CA", "GB", "FR", "DE", "ES", "IT", "PT", "BE", "NL", "CH"],
    },
    phone_number_collection: { enabled: true },
    metadata: {
      cartLines: JSON.stringify(normalized),
      appliedRewardCents: String(appliedCents),
      linePaids: JSON.stringify(paidLineCents),
      ...(buyerUserId ? { buyerUserId } : {}),
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}

/** Stripe Checkout for an AffiliateProduct listing (EUR). */
export async function marketplaceCheckoutPOST(request: Request) {
  const stripe = getStripeClient()
  const body = (await request.json().catch(() => ({}))) as {
    affiliateProductId?: string
    productId?: string
    qty?: number
    items?: CartLineInput[]
    cancelPath?: string
    successPath?: string
    useRewardCents?: number
    selectedColor?: string | null
    selectedSize?: string | null
  }

  if (Array.isArray(body.items) && body.items.length > 0) {
    return checkoutFromItems(body.items, body)
  }

  const affiliateProductId =
    body.affiliateProductId?.trim() || body.productId?.trim() || ""
  if (!affiliateProductId) {
    return NextResponse.json({ error: "Missing affiliateProductId" }, { status: 400 })
  }

  const qty = Math.max(1, Math.min(99, Math.round(Number(body.qty)) || 1))

  const listing = await loadListing(affiliateProductId)

  if (!listing || !listing.product.active || !listing.product.supplierId) {
    return NextResponse.json({ error: "Listing not found or inactive" }, { status: 404 })
  }

  const session = await auth()
  const buyerUserId = session?.user?.id?.trim() || ""

  let balanceCents = 0
  if (buyerUserId) {
    const u = await prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { buyerRewardBalanceCents: true },
    })
    balanceCents = u?.buyerRewardBalanceCents ?? 0
  }

  const unitSelling = lineSellingPriceCents(listing, {
    selectedColor: body.selectedColor,
    selectedSize: body.selectedSize,
  })
  const lineSubtotal = unitSelling * qty
  const requestedReward =
    typeof body.useRewardCents === "number" && Number.isFinite(body.useRewardCents)
      ? body.useRewardCents
      : 0

  const { appliedCents, paidLineCents } = computePaidLinesWithReward({
    lineSubtotalsCents: [lineSubtotal],
    balanceCents,
    requestedRewardCents: buyerUserId ? requestedReward : 0,
  })

  if (lineSubtotal > 0 && paidLineCents[0]! < 1) {
    return NextResponse.json(
      { error: "Unable to apply this much store credit for this item." },
      { status: 400 }
    )
  }

  const stripeLineItems: StripeLineItem[] = []
  const oneShotVariantLabel = resolveCheckoutVariantLabel({
    selectedColor: body.selectedColor,
    selectedSize: body.selectedSize,
  })
  const oneShotVariantSignature = normalizeCartVariantSignature(body.selectedColor, body.selectedSize)
  pushLineItemsForPaidTotal(stripeLineItems, listing, paidLineCents[0]!, qty, oneShotVariantLabel)

  const { baseUrl, cancelPath, successPath } = checkoutBaseUrls(body)

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: stripeLineItems,
    success_url: `${baseUrl}${successPath}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    customer_creation: "always",
    billing_address_collection: "required",
    shipping_address_collection: {
      allowed_countries: ["US", "CA", "GB", "FR", "DE", "ES", "IT", "PT", "BE", "NL", "CH"],
    },
    phone_number_collection: { enabled: true },
    metadata: {
      affiliateProductId: listing.id,
      productId: listing.productId,
      supplierId: listing.product.supplierId,
      affiliateId: listing.affiliateId,
      appliedRewardCents: String(appliedCents),
      linePaids: JSON.stringify(paidLineCents),
      checkoutQty: String(qty),
      checkoutVariantLabel: oneShotVariantLabel || "",
      checkoutVariantSignature: oneShotVariantSignature || "",
      ...(buyerUserId ? { buyerUserId } : {}),
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
