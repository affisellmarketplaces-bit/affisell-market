import { getAutoDsConfig, isAutoDsConfigured } from "@/lib/autods/config"

export type AutoDsRemoteOrderSnapshot = {
  autodsOrderId: string
  status: string
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
  raw: unknown
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

function readNested(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return undefined
  let cur: unknown = obj
  for (const key of keys) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

export function parseAutoDsRemoteOrder(
  autodsOrderId: string,
  body: unknown
): AutoDsRemoteOrderSnapshot {
  const order = readNested(body, ["order"]) ?? body
  const statusRaw =
    readString(readNested(order, ["status"])) ??
    readString(readNested(order, ["order_status"])) ??
    readString(readNested(body, ["status"])) ??
    "PROCESSING"

  const trackingNumber =
    readString(readNested(order, ["tracking_number"])) ??
    readString(readNested(order, ["trackingNumber"])) ??
    readString(readNested(body, ["tracking_number"])) ??
    readString(readNested(body, ["trackingNumber"]))

  const trackingUrl =
    readString(readNested(order, ["tracking_url"])) ??
    readString(readNested(order, ["trackingUrl"])) ??
    readString(readNested(body, ["tracking_url"])) ??
    readString(readNested(body, ["trackingUrl"]))

  const carrier =
    readString(readNested(order, ["carrier"])) ?? readString(readNested(body, ["carrier"]))

  return {
    autodsOrderId,
    status: statusRaw.toUpperCase(),
    trackingNumber,
    trackingUrl,
    carrier,
    raw: body,
  }
}

export function buildAutoDsGetOrderUrl(autodsOrderId: string): string | null {
  if (!isAutoDsConfigured()) return null
  const config = getAutoDsConfig()
  if (!config) return null

  const base = (process.env.AUTODS_API_BASE_URL?.trim() || "https://gw.autods.com").replace(/\/$/, "")
  const path =
    process.env.AUTODS_GET_ORDER_PATH?.trim() || "/auto-order/order/get-external"
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`)
  url.searchParams.set("order_id", autodsOrderId)
  return url.toString()
}

export async function fetchAutoDsOrderSnapshot(
  autodsOrderId: string
): Promise<AutoDsRemoteOrderSnapshot | null> {
  const config = getAutoDsConfig()
  const url = buildAutoDsGetOrderUrl(autodsOrderId)
  if (!config || !url) return null

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    throw new Error(`autods_get_order_http_${res.status}`)
  }

  return parseAutoDsRemoteOrder(autodsOrderId, body)
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
