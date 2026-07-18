import "server-only"

import { createHmac } from "node:crypto"

import { assertTikTokCredentials, tiktokAppKey, tiktokAppSecret } from "@/lib/tiktok/env"

const DEFAULT_API_BASE =
  process.env.TIKTOK_SHOP_API_BASE?.trim() || "https://open-api.tiktokglobalshop.com"

export type TikTokShopOrder = {
  orderId: string
  status?: string
  raw: Record<string, unknown>
}

export type TikTokShopProduct = {
  productId: string
  title?: string
  raw: Record<string, unknown>
}

export type TikTokShopInfo = {
  shopId: string
  shopName: string
  raw: Record<string, unknown>
}

export type TikTokTokenBundle = {
  access_token: string
  refresh_token: string
  expires_in: number
  open_id?: string
  scope?: string
  shop_id?: string
  shop_cipher?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * TikTok Shop request sign (common Partner pattern):
 * HMAC-SHA256(secret, secret + path + sortedQuery + body + secret) → hex
 * Falls back to simpler timestamp HMAC when path-only signing is configured.
 */
export function signTikTokRequest(input: {
  path: string
  timestamp: string
  query: Record<string, string>
  body: string
}): string {
  const secret = tiktokAppSecret()
  const keys = Object.keys(input.query).sort()
  let paramStr = ""
  for (const k of keys) {
    if (k === "sign" || k === "access_token") continue
    paramStr += k + input.query[k]
  }
  const base = `${secret}${input.path}${paramStr}${input.body}${secret}`
  return createHmac("sha256", secret).update(base, "utf8").digest("hex")
}

async function tiktokFetchJson(
  path: string,
  opts: {
    method?: "GET" | "POST"
    accessToken: string
    query?: Record<string, string>
    body?: Record<string, unknown>
    retries?: number
  }
): Promise<Record<string, unknown>> {
  assertTikTokCredentials()
  const method = opts.method ?? "GET"
  const retries = opts.retries ?? 2
  const timestamp = String(Math.floor(Date.now() / 1000))
  const query: Record<string, string> = {
    app_key: tiktokAppKey(),
    timestamp,
    ...(opts.query ?? {}),
  }
  const bodyStr = opts.body ? JSON.stringify(opts.body) : ""
  query.sign = signTikTokRequest({ path, timestamp, query, body: bodyStr })

  const u = new URL(path.startsWith("http") ? path : `${DEFAULT_API_BASE}${path}`)
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v)
  }

  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(u.toString(), {
        method,
        headers: {
          "content-type": "application/json",
          "x-tts-access-token": opts.accessToken,
        },
        body: method === "POST" && bodyStr ? bodyStr : undefined,
      })

      if (res.status === 429 || res.status >= 500) {
        const backoff = Math.min(12_000, 500 * 2 ** attempt)
        await sleep(backoff)
        lastErr = new Error(`TikTok HTTP ${res.status}`)
        continue
      }

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      return json
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      await sleep(400 * (attempt + 1))
    }
  }
  throw lastErr ?? new Error("TikTok request failed")
}

export async function getShopInfo(
  accessToken: string,
  shopId?: string
): Promise<TikTokShopInfo> {
  const path =
    process.env.TIKTOK_SHOP_INFO_PATH?.trim() || "/authorization/202309/shops"
  const json = await tiktokFetchJson(path, {
    method: "GET",
    accessToken,
    query: shopId ? { shop_id: shopId } : {},
  })
  const data = (json.data as Record<string, unknown> | undefined) ?? json
  const shops = (data.shops as unknown[]) ?? (data.shop_list as unknown[]) ?? []
  const first =
    (Array.isArray(shops) && shops[0] && typeof shops[0] === "object"
      ? (shops[0] as Record<string, unknown>)
      : data) ?? {}
  const id = String(first.shop_id ?? first.id ?? shopId ?? "").trim()
  const name = String(first.shop_name ?? first.name ?? "TikTok Shop").trim()
  if (!id) throw new Error("TikTok shop info missing shop_id")
  return { shopId: id, shopName: name || "TikTok Shop", raw: json }
}

export type TikTokOrderSearchOpts = {
  pageSize?: number
  pageToken?: string
  orderId?: string
  /** Unix seconds — create_time_ge */
  createTimeGe?: number
  /** Unix seconds — create_time_lt */
  createTimeLt?: number
  /** e.g. exclude cancelled via client filter if API ignores */
  orderStatusList?: number[]
}

export type TikTokOrderSearchPage = {
  orders: TikTokShopOrder[]
  nextPageToken: string | null
  raw: Record<string, unknown>
}

export async function searchOrdersPage(
  accessToken: string,
  shopId: string,
  opts?: TikTokOrderSearchOpts
): Promise<TikTokOrderSearchPage> {
  const path = process.env.TIKTOK_ORDER_LIST_PATH?.trim() || "/order/202309/orders/search"
  const body: Record<string, unknown> = {
    page_size: opts?.pageSize ?? 50,
  }
  if (opts?.orderId) body.order_id_list = [opts.orderId]
  if (opts?.pageToken) body.page_token = opts.pageToken
  if (opts?.createTimeGe != null) body.create_time_ge = opts.createTimeGe
  if (opts?.createTimeLt != null) body.create_time_lt = opts.createTimeLt
  if (opts?.orderStatusList?.length) body.order_status_list = opts.orderStatusList

  const json = await tiktokFetchJson(path, {
    method: "POST",
    accessToken,
    query: { shop_id: shopId },
    body,
    retries: 4,
  })
  const data = (json.data as Record<string, unknown> | undefined) ?? {}
  const list = (data.orders as unknown[]) ?? (data.order_list as unknown[]) ?? []
  const orders = (Array.isArray(list) ? list : [])
    .map((row) => {
      const o = row as Record<string, unknown>
      return {
        orderId: String(o.order_id ?? o.id ?? "").trim(),
        status: o.order_status != null ? String(o.order_status) : undefined,
        raw: o,
      }
    })
    .filter((o) => o.orderId)

  const next =
    data.next_page_token != null
      ? String(data.next_page_token).trim()
      : data.page_token != null
        ? String(data.page_token).trim()
        : ""

  return {
    orders,
    nextPageToken: next || null,
    raw: json,
  }
}

export async function getOrders(
  accessToken: string,
  shopId: string,
  opts?: { pageSize?: number; orderId?: string }
): Promise<TikTokShopOrder[]> {
  const page = await searchOrdersPage(accessToken, shopId, opts)
  return page.orders
}

export async function getOrderDetail(
  accessToken: string,
  shopId: string,
  orderId: string
): Promise<TikTokShopOrder | null> {
  const path = process.env.TIKTOK_ORDER_DETAIL_PATH?.trim() || "/order/202309/orders"
  const json = await tiktokFetchJson(path, {
    method: "GET",
    accessToken,
    query: { shop_id: shopId, ids: orderId },
  })
  const data = (json.data as Record<string, unknown> | undefined) ?? {}
  const list = (data.orders as unknown[]) ?? []
  const first = Array.isArray(list) && list[0] ? (list[0] as Record<string, unknown>) : null
  if (!first) return null
  return {
    orderId: String(first.order_id ?? orderId),
    status: first.order_status != null ? String(first.order_status) : undefined,
    raw: first,
  }
}

export async function getProducts(
  accessToken: string,
  shopId: string
): Promise<TikTokShopProduct[]> {
  const path =
    process.env.TIKTOK_PRODUCT_LIST_PATH?.trim() || "/product/202309/products/search"
  const json = await tiktokFetchJson(path, {
    method: "POST",
    accessToken,
    query: { shop_id: shopId },
    body: { page_size: 20 },
  })
  const data = (json.data as Record<string, unknown> | undefined) ?? {}
  const list = (data.products as unknown[]) ?? (data.product_list as unknown[]) ?? []
  return (Array.isArray(list) ? list : []).map((row) => {
    const p = row as Record<string, unknown>
    return {
      productId: String(p.product_id ?? p.id ?? "").trim(),
      title: p.title != null ? String(p.title) : undefined,
      raw: p,
    }
  }).filter((p) => p.productId)
}

/** Exchange auth_code for tokens (Partner Center grant_type=authorized_code). */
export async function exchangeAuthCode(authCode: string): Promise<TikTokTokenBundle> {
  assertTikTokCredentials()
  const tokenUrl =
    process.env.TIKTOK_TOKEN_URL?.trim() ||
    "https://auth.tiktok-shops.com/api/v2/token/get"

  const body = {
    app_key: tiktokAppKey(),
    app_secret: tiktokAppSecret(),
    auth_code: authCode,
    grant_type: "authorized_code",
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const data = (json.data as Record<string, unknown> | undefined) ?? json

  const access = String(data.access_token ?? "").trim()
  const refresh = String(data.refresh_token ?? "").trim()
  if (!access || !refresh) {
    const msg = String(json.message ?? json.error ?? "token exchange failed")
    throw new Error(`[tiktok] ${msg}`)
  }

  return {
    access_token: access,
    refresh_token: refresh,
    expires_in:
      typeof data.access_token_expire_in === "number"
        ? data.access_token_expire_in
        : typeof data.expires_in === "number"
          ? data.expires_in
          : 86400,
    open_id: data.open_id != null ? String(data.open_id) : undefined,
    scope: data.scope != null ? String(data.scope) : undefined,
    shop_id: data.seller_name != null ? undefined : undefined,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TikTokTokenBundle> {
  assertTikTokCredentials()
  const tokenUrl =
    process.env.TIKTOK_REFRESH_TOKEN_URL?.trim() ||
    "https://auth.tiktok-shops.com/api/v2/token/refresh"

  const body = {
    app_key: tiktokAppKey(),
    app_secret: tiktokAppSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  const data = (json.data as Record<string, unknown> | undefined) ?? json

  const access = String(data.access_token ?? "").trim()
  const refresh = String(data.refresh_token ?? refreshToken).trim()
  if (!access) {
    const code = json.code ?? json.error
    throw new Error(`[tiktok] refresh failed code=${String(code ?? "unknown")}`)
  }

  return {
    access_token: access,
    refresh_token: refresh,
    expires_in:
      typeof data.access_token_expire_in === "number"
        ? data.access_token_expire_in
        : typeof data.expires_in === "number"
          ? data.expires_in
          : 86400,
    open_id: data.open_id != null ? String(data.open_id) : undefined,
    scope: data.scope != null ? String(data.scope) : undefined,
  }
}
