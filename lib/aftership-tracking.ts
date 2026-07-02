const AFTERSHIP_API_BASE = "https://api.aftership.com/tracking/2024-07"

import { afterShipSlugForTrustedCarrier } from "@/lib/trusted-carriers-shared"

function resolveAfterShipSlug(carrier: string | null | undefined): string | undefined {
  if (!carrier?.trim()) return undefined
  return afterShipSlugForTrustedCarrier(carrier) ?? undefined
}

function afterShipApiKey(): string | null {
  const key = process.env.AFTERSHIP_API_KEY?.trim()
  return key || null
}

type AfterShipDetectResponse = {
  data?: {
    couriers?: Array<{ slug?: string }>
  }
}

type AfterShipTrackingsResponse = {
  data?: {
    trackings?: Array<{ tracking_number?: string; tag?: string }>
  }
}

type AfterShipCreateTrackingResponse = {
  meta?: { code?: number; message?: string }
  data?: { tracking?: { id?: string; tracking_number?: string } }
}

/** Returns true when AfterShip recognizes the tracking number (detect or known tracking). */
export async function isAfterShipTrackingValid(
  trackingNumber: string,
  carrier?: string | null
): Promise<boolean> {
  const apiKey = afterShipApiKey()
  const normalized = trackingNumber.trim()
  if (!apiKey || normalized.length < 4) return false

  const slug = resolveAfterShipSlug(carrier)

  try {
    const listUrl = new URL(`${AFTERSHIP_API_BASE}/trackings`)
    listUrl.searchParams.set("keyword", normalized)
    const listRes = await fetch(listUrl, {
      headers: { "aftership-api-key": apiKey },
      signal: AbortSignal.timeout(12_000),
    })
    if (listRes.ok) {
      const listJson = (await listRes.json()) as AfterShipTrackingsResponse
      const match = (listJson.data?.trackings ?? []).some(
        (row) => row.tracking_number?.trim().toLowerCase() === normalized.toLowerCase()
      )
      if (match) return true
    }

    const detectRes = await fetch(`${AFTERSHIP_API_BASE}/couriers/detect`, {
      method: "POST",
      headers: {
        "aftership-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking_number: normalized,
        ...(slug ? { slug } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!detectRes.ok) return false

    const detectJson = (await detectRes.json()) as AfterShipDetectResponse
    const couriers = detectJson.data?.couriers ?? []
    if (couriers.length === 0) return false
    if (slug) {
      return couriers.some((c) => c.slug === slug)
    }
    return true
  } catch (error) {
    console.log("[aftership]", {
      trackingNumber: normalized,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export type RegisterAfterShipTrackingInput = {
  trackingNumber: string
  carrier?: string | null
  orderId: string
  customerEmail?: string | null
}

/** Register tracking for real-time webhook updates (idempotent). */
export async function registerAfterShipTracking(
  input: RegisterAfterShipTrackingInput
): Promise<boolean> {
  const apiKey = afterShipApiKey()
  const normalized = input.trackingNumber.trim()
  if (!apiKey || normalized.length < 4) return false

  const slug = resolveAfterShipSlug(input.carrier)

  try {
    const res = await fetch(`${AFTERSHIP_API_BASE}/trackings`, {
      method: "POST",
      headers: {
        "aftership-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracking_number: normalized,
        ...(slug ? { slug } : {}),
        order_id: input.orderId,
        ...(input.customerEmail?.trim()
          ? { emails: [input.customerEmail.trim().toLowerCase()] }
          : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    })

    if (res.ok) return true

    const json = (await res.json().catch(() => null)) as AfterShipCreateTrackingResponse | null
    const code = json?.meta?.code
    // 4003 = tracking already exists
    if (code === 4003) return true

    console.log("[aftership-register]", {
      orderId: input.orderId,
      trackingNumber: normalized,
      status: res.status,
      code,
      message: json?.meta?.message,
    })
    return false
  } catch (error) {
    console.log("[aftership-register]", {
      orderId: input.orderId,
      trackingNumber: normalized,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}
