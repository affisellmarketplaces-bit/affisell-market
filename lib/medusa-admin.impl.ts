import { medusaBackendUrl } from "@/lib/medusa/backend-url"

/** Resolve Secret API Key — trims and strips accidental quotes from .env files. */
export function resolveMedusaAdminToken(): string {
  const raw = process.env.MEDUSA_ADMIN_TOKEN?.trim()
  if (!raw) {
    throw new Error("MEDUSA_ADMIN_TOKEN missing in env")
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

export function hasMedusaAdminToken(): boolean {
  return Boolean(process.env.MEDUSA_ADMIN_TOKEN?.trim())
}

/** Medusa v2 Secret API Keys use Basic auth (not Bearer). */
export function medusaAdminAuthorizationHeader(secretKey: string): string {
  return `Basic ${secretKey}`
}

export async function medusaAdminFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = resolveMedusaAdminToken()
  const base = medusaBackendUrl()
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const url = `${base}${normalizedPath}`

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: medusaAdminAuthorizationHeader(token),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("[medusa] request failed", {
      url,
      status: res.status,
      hasToken: Boolean(token),
      tokenPrefix: token.slice(0, 7),
      body: text,
    })
    throw new Error(`Medusa ${res.status}: ${text}`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

export type MedusaDraftOrderItem = {
  variant_id: string
  quantity: number
  unit_price: number
  title?: string
}

export type CreateMedusaDraftOrderPayload = {
  email: string
  region_id: string
  currency_code: string
  items: MedusaDraftOrderItem[]
  shipping_address: Record<string, unknown>
  billing_address?: Record<string, unknown>
  metadata?: Record<string, unknown>
  no_notification_order?: boolean
}

export async function createMedusaDraftOrder(
  payload: CreateMedusaDraftOrderPayload
): Promise<{ draft_order?: { id?: string } }> {
  return medusaAdminFetch("/admin/draft-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function convertMedusaDraftOrderToOrder(
  draftId: string
): Promise<{ order?: unknown }> {
  return medusaAdminFetch(`/admin/draft-orders/${draftId}/convert-to-order`, {
    method: "POST",
  })
}

/** Medusa Admin draft/order amounts use major currency units (EUR), not Affisell cents. */
export function affisellCentsToMedusaMajorUnits(cents: number): number {
  const safe = Math.max(0, Math.round(cents))
  return Math.round(safe) / 100
}

type MedusaOrderPaymentSnapshot = {
  id: string
  payment_status?: string
  summary?: { accounting_total?: number; pending_difference?: number }
  payment_collections?: Array<{ id: string; status?: string; amount?: number }>
}

export async function captureMedusaOrderExternalPayment(
  orderId: string,
  amountMajorUnits: number
): Promise<void> {
  const orderJson = await medusaAdminFetch<{ order?: MedusaOrderPaymentSnapshot }>(
    `/admin/orders/${orderId}?fields=id,payment_status,summary,*payment_collections`
  )
  const order = orderJson.order
  if (!order?.id) {
    throw new Error(`Medusa order ${orderId} not found`)
  }

  if (order.payment_status === "captured" || order.payment_status === "partially_captured") {
    console.log("[medusa] order payment already captured", { orderId })
    return
  }

  const completedPc = order.payment_collections?.find((pc) => pc.status === "completed")
  if (completedPc) {
    console.log("[medusa] payment collection already completed", {
      orderId,
      paymentCollectionId: completedPc.id,
    })
    return
  }

  const amount =
    amountMajorUnits > 0
      ? amountMajorUnits
      : Math.max(0, order.summary?.accounting_total ?? order.summary?.pending_difference ?? 0)

  if (amount <= 0) {
    console.warn("[medusa] skip external payment capture — zero amount", { orderId })
    return
  }

  const openPc = order.payment_collections?.find((pc) => pc.status === "not_paid")
  const paymentCollectionId =
    openPc?.id ??
    (
      await medusaAdminFetch<{ payment_collection?: { id?: string } }>(
        "/admin/payment-collections",
        {
          method: "POST",
          body: JSON.stringify({ order_id: orderId, amount }),
        }
      )
    ).payment_collection?.id

  if (!paymentCollectionId) {
    throw new Error(`Medusa payment collection missing for order ${orderId}`)
  }

  await medusaAdminFetch(`/admin/payment-collections/${paymentCollectionId}/mark-as-paid`, {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  })

  console.log("[medusa] order payment captured", {
    orderId,
    paymentCollectionId,
    amountMajorUnits: amount,
  })
}
