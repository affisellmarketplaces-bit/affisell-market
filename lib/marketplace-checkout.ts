import { NextResponse } from "next/server"

import {
  listingDisplayTitle,
  listingGalleryUrls,
} from "@/lib/affiliate-listing-display"
import { prisma } from "@/lib/prisma"
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

type CartLineInput = { productId?: string; qty?: number }

async function loadListing(id: string) {
  return prisma.affiliateProduct.findFirst({
    where: { id, isListed: true, product: { active: true } },
    include: { product: true },
  })
}

/** Stripe Checkout for multiple marketplace lines (EUR). */
async function checkoutFromItems(lines: CartLineInput[], opts: { cancelPath?: string; successPath?: string }) {
  const stripe = getStripeClient()
  const normalized: { affiliateProductId: string; qty: number }[] = []
  for (const row of lines) {
    const affiliateProductId = typeof row.productId === "string" ? row.productId.trim() : ""
    if (!affiliateProductId) continue
    const qty = Math.max(1, Math.min(99, Math.round(Number(row.qty)) || 1))
    normalized.push({ affiliateProductId, qty })
  }

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 })
  }

  const stripeLineItems: {
    price_data: {
      currency: "eur"
      unit_amount: number
      product_data: { name: string; images: string[] }
    }
    quantity: number
  }[] = []

  for (const { affiliateProductId, qty } of normalized) {
    const listing = await loadListing(affiliateProductId)
    if (!listing || !listing.product.active || !listing.product.supplierId) {
      return NextResponse.json({ error: "Listing not found or inactive" }, { status: 404 })
    }
    const displayName = listingDisplayTitle(listing.customTitle, listing.product.name)
    const gallery = listingGalleryUrls(listing.customImages, listing.product.images)
    stripeLineItems!.push({
      price_data: {
        currency: "eur",
        unit_amount: listing.sellingPriceCents,
        product_data: {
          name: displayName,
          images: stripeProductImages(gallery) ?? [],
        },
      },
      quantity: qty,
    })
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
    /** Alias for `affiliateProductId` (marketplace listing id). */
    productId?: string
    qty?: number
    items?: CartLineInput[]
    cancelPath?: string
    successPath?: string
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

  const { baseUrl, cancelPath, successPath } = checkoutBaseUrls(body)

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: listing.sellingPriceCents,
          product_data: {
            name: listingDisplayTitle(listing.customTitle, listing.product.name),
            images: stripeProductImages(listingGalleryUrls(listing.customImages, listing.product.images)),
          },
        },
        quantity: qty,
      },
    ],
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
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "Stripe URL unavailable" }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
