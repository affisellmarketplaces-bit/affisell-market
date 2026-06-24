import "server-only"

import type { Prisma } from "@prisma/client"

import { createMedusaOrder, type MedusaOrderShippingAddress } from "@/lib/medusa/create-order"
import { fetchMedusaFirstVariantIdByHandle } from "@/lib/medusa/fetch-product"
import { prisma } from "@/lib/prisma"

type Tx = Prisma.TransactionClient

type AffisellShippingAddress = {
  name?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  postalCode?: string
  country?: string
  phone?: string
}

export type SyncMarketplaceOrderToMedusaInput = {
  orderId: string
  medusaOrderId?: string | null
  productId: string
  productName: string
  quantity: number
  linePriceCents: number
  customerEmail: string
  shippingAddress: Prisma.JsonValue
  stripeSessionId: string
  currency: string
  buyerUserId?: string | null
}

function parseShipping(raw: Prisma.JsonValue): AffisellShippingAddress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as AffisellShippingAddress
}

function splitPersonName(full: string): { first: string; last: string } {
  const trimmed = full.trim()
  if (!trimmed) return { first: "Client", last: "Affisell" }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { first: parts[0]!, last: "Affisell" }
  return { first: parts[0]!, last: parts.slice(1).join(" ") }
}

function mapShippingAddress(
  raw: Prisma.JsonValue,
  buyerName?: string | null
): MedusaOrderShippingAddress {
  const ship = parseShipping(raw)
  const fromName = ship.name?.trim() || buyerName?.trim() || ""
  const { first, last } = splitPersonName(fromName)
  const country = (ship.country ?? "fr").trim().toLowerCase()
  return {
    first_name: first,
    last_name: last,
    address_1: ship.line1?.trim() || "—",
    address_2: ship.line2?.trim() || undefined,
    city: ship.city?.trim() || "—",
    province: ship.state?.trim() || undefined,
    postal_code: (ship.postal_code ?? ship.postalCode)?.trim() || "00000",
    country_code: country.length === 2 ? country : "fr",
    phone: ship.phone?.trim() || undefined,
  }
}

/**
 * Idempotent: mirrors a paid Affisell Order row to Medusa Admin when product.medusaHandle is set.
 * Never throws — Stripe/Affisell fulfillment must succeed even if Medusa is down.
 */
export async function syncMarketplaceOrderToMedusa(
  tx: Tx,
  input: SyncMarketplaceOrderToMedusaInput
): Promise<void> {
  if (input.medusaOrderId) {
    console.log(`[medusa] Order ${input.orderId} already synced: ${input.medusaOrderId}`)
    return
  }

  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { medusaHandle: true, medusaVariantId: true },
  })

  if (!product?.medusaHandle && !product?.medusaVariantId) {
    console.warn(`[medusa] Product ${input.productId} missing medusaHandle, skipping`, {
      orderId: input.orderId,
    })
    return
  }

  const variantId =
    product.medusaVariantId ??
    (product.medusaHandle
      ? await fetchMedusaFirstVariantIdByHandle(product.medusaHandle)
      : null)
  if (!variantId) {
    console.warn(`[medusa] No Medusa variant for handle ${product.medusaHandle}`, {
      orderId: input.orderId,
    })
    return
  }

  const qty = Math.max(1, input.quantity)
  const unitPriceCents = Math.max(1, Math.round(input.linePriceCents / qty))

  let buyerName: string | null = null
  if (input.buyerUserId) {
    const buyer = await tx.user.findUnique({
      where: { id: input.buyerUserId },
      select: { name: true },
    })
    buyerName = buyer?.name ?? null
  }

  let medusaOrder = null
  try {
    medusaOrder = await createMedusaOrder({
      email: input.customerEmail,
      currency: input.currency,
      items: [
        {
          variant_id: variantId,
          quantity: qty,
          unit_price: unitPriceCents,
          title: input.productName,
        },
      ],
      shipping_address: mapShippingAddress(input.shippingAddress, buyerName),
      stripeSessionId: input.stripeSessionId,
    })
  } catch (err) {
    console.error("[medusa] sync failed", {
      orderId: input.orderId,
      error: err instanceof Error ? err.message : String(err),
    })
    return
  }

  if (!medusaOrder?.id) return

  await tx.order.update({
    where: { id: input.orderId },
    data: { medusaOrderId: medusaOrder.id },
  })

  console.log("[medusa] Linked order", {
    orderId: input.orderId,
    medusaOrderId: medusaOrder.id,
    displayId: medusaOrder.display_id,
  })
}

/** Heal path for idempotent webhook retries when order is paid but not yet mirrored. */
export async function syncMarketplaceOrderToMedusaIfNeeded(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      medusaOrderId: true,
      productId: true,
      quantity: true,
      sellingPriceCents: true,
      customerEmail: true,
      shippingAddress: true,
      stripeSessionId: true,
      currency: true,
      buyerUserId: true,
      product: { select: { name: true } },
    },
  })
  if (!order?.product) return

  await prisma.$transaction(async (tx) => {
    await syncMarketplaceOrderToMedusa(tx, {
      orderId: order.id,
      medusaOrderId: order.medusaOrderId,
      productId: order.productId,
      productName: order.product.name,
      quantity: order.quantity,
      linePriceCents: order.sellingPriceCents,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress,
      stripeSessionId: order.stripeSessionId,
      currency: order.currency,
      buyerUserId: order.buyerUserId,
    })
  })
}
