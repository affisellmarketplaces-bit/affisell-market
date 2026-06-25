import { z } from "zod"

import { medusaBackendUrl } from "@/lib/medusa/backend-url"

const MedusaOrderSchema = z.object({
  id: z.string(),
  display_id: z.number(),
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
  email: string
  currency: string
  items: { variant_id: string; quantity: number; unit_price: number; title?: string }[]
  shipping_address: MedusaOrderShippingAddress
  stripeSessionId: string
}

function medusaAdminHeaders(): Record<string, string> | null {
  const token = process.env.MEDUSA_ADMIN_TOKEN?.trim()
  if (!token) return null
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

async function medusaAdminFetch(path: string, init: RequestInit): Promise<Response> {
  const headers = medusaAdminHeaders()
  if (!headers) {
    throw new Error("MEDUSA_ADMIN_TOKEN missing")
  }
  return fetch(`${medusaBackendUrl()}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  })
}

/**
 * Create a Medusa order from an Affisell-paid Stripe session.
 * Medusa v2 has no POST /admin/orders — uses draft-orders + convert-to-order.
 */
export async function createMedusaOrder(
  data: CreateMedusaOrderInput
): Promise<MedusaOrderRef | null> {
  if (!process.env.MEDUSA_ADMIN_TOKEN?.trim()) {
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
      unit_price: item.unit_price,
      ...(item.title ? { title: item.title } : {}),
    })),
    shipping_address: data.shipping_address,
    billing_address: data.shipping_address,
    metadata: {
      stripe_session_id: data.stripeSessionId,
      payment_status: "captured",
      fulfillment_status: "not_fulfilled",
      source: "affisell_stripe_connect",
    },
    no_notification_order: true,
  }

  const draftRes = await medusaAdminFetch("/admin/draft-orders", {
    method: "POST",
    body: JSON.stringify(draftBody),
  })

  if (!draftRes.ok) {
    const err = await draftRes.text()
    console.error("[medusa] draft order create failed", {
      stripeSessionId: data.stripeSessionId,
      status: draftRes.status,
      err,
    })
    return null
  }

  const draftJson = (await draftRes.json()) as { draft_order?: { id?: string } }
  const draftId = draftJson.draft_order?.id
  if (!draftId) {
    console.error("[medusa] draft order create missing id", { stripeSessionId: data.stripeSessionId })
    return null
  }

  const convertRes = await medusaAdminFetch(`/admin/draft-orders/${draftId}/convert-to-order`, {
    method: "POST",
  })

  if (!convertRes.ok) {
    const err = await convertRes.text()
    console.error("[medusa] convert draft order failed", {
      stripeSessionId: data.stripeSessionId,
      draftId,
      status: convertRes.status,
      err,
    })
    return null
  }

  const orderJson = (await convertRes.json()) as { order?: unknown }
  const parsed = MedusaOrderSchema.safeParse(orderJson.order)
  if (!parsed.success) {
    console.error("[medusa] order response invalid", {
      stripeSessionId: data.stripeSessionId,
      draftId,
      issues: parsed.error.issues,
    })
    return null
  }

  console.log("[medusa] order synced", {
    stripeSessionId: data.stripeSessionId,
    medusaOrderId: parsed.data.id,
    displayId: parsed.data.display_id,
  })

  return parsed.data
}
