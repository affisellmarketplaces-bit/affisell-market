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
      Authorization: `Bearer ${token}`,
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
