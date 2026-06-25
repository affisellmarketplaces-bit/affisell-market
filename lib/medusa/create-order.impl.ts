import { z } from "zod"

import {
  affisellCentsToMedusaMajorUnits,
  captureMedusaOrderExternalPayment,
  convertMedusaDraftOrderToOrder,
  createMedusaDraftOrder,
  hasMedusaAdminToken,
} from "@/lib/medusa-admin.impl"

const MedusaOrderSchema = z.object({
  id: z.string(),
  display_id: z.number(),
  summary: z
    .object({
      accounting_total: z.number().optional(),
    })
    .optional(),
})

export type MedusaOrderRef = z.infer<typeof MedusaOrderSchema>

export type MedusaOrderShippingAddress = {
  first_name?: string | null
  last_name?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country_code?: string | null
  phone?: string | null
  company?: string | null
  metadata?: Record<string, unknown> | null
}

export type CreateMedusaOrderInput = {
  affisellOrderId?: string
  email: string
  currency: string
  items: { variant_id: string; quantity: number; unit_price: number; title?: string }[]
  shipping_address: MedusaOrderShippingAddress
  stripeSessionId: string
}

/**
 * Create a Medusa order from an Affisell-paid Stripe session.
 * Medusa v2 has no POST /admin/orders — uses draft-orders + convert-to-order.
 */
export async function createMedusaOrder(
  data: CreateMedusaOrderInput
): Promise<MedusaOrderRef | null> {
  if (!hasMedusaAdminToken()) {
    console.warn("[medusa] MEDUSA_ADMIN_TOKEN missing, skip order sync")
    return null
  }

  const regionId = process.env.MEDUSA_REGION_ID?.trim()
  if (!regionId) {
    console.warn(
      "[medusa] MEDUSA_REGION_ID missing. Create region in Admin first (cd medusa-backend && npm run seed:region)."
    )
    return null
  }

  const draftBody = {
    email: data.email,
    region_id: regionId,
    currency_code: data.currency.toLowerCase(),
    items: data.items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: affisellCentsToMedusaMajorUnits(item.unit_price),
      ...(item.title ? { title: item.title } : {}),
    })),
    shipping_address: data.shipping_address,
    billing_address: data.shipping_address,
    metadata: {
      ...(data.affisellOrderId ? { affisell_order_id: data.affisellOrderId } : {}),
      stripe_session_id: data.stripeSessionId,
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      source: "affisell_stripe_connect",
    },
    no_notification_order: true,
  }

  try {
    const draftJson = await createMedusaDraftOrder(draftBody)
    const draftId = draftJson.draft_order?.id
    if (!draftId) {
      console.error("[medusa] draft order create missing id", { stripeSessionId: data.stripeSessionId })
      return null
    }

    const orderJson = await convertMedusaDraftOrderToOrder(draftId)
    const parsed = MedusaOrderSchema.safeParse(orderJson.order)
    if (!parsed.success) {
      console.error("[medusa] order response invalid", {
        stripeSessionId: data.stripeSessionId,
        draftId,
        issues: parsed.error.issues,
      })
      return null
    }

    try {
      await captureMedusaOrderExternalPayment(
        parsed.data.id,
        parsed.data.summary?.accounting_total ?? 0
      )
    } catch (captureErr) {
      console.error("[medusa] payment capture failed", {
        stripeSessionId: data.stripeSessionId,
        medusaOrderId: parsed.data.id,
        error: captureErr instanceof Error ? captureErr.message : String(captureErr),
      })
    }

    console.log("[medusa] order synced", {
      stripeSessionId: data.stripeSessionId,
      medusaOrderId: parsed.data.id,
      displayId: parsed.data.display_id,
    })

    return parsed.data
  } catch (err) {
    console.error("[medusa] create order failed", {
      stripeSessionId: data.stripeSessionId,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
