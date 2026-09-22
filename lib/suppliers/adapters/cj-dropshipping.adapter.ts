import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter, type OrderStatusDTO } from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"

/**
 * CJdropshipping open API v2 (https://developers.cjdropshipping.com). Built from the public
 * documentation — not yet exercised against a live account (no credentials available here).
 * Verify against a real sandbox order before enabling for a supplier.
 *
 * Auth: POST /authentication/getAccessToken with { email, password } — "password" is the CJ
 * "API Key" generated in the CJ account (Settings → API). CJ rate-limits this call to roughly
 * once per 300s per account, so the token is cached in-process (module-level Map) rather than
 * re-fetched per call. This cache is per warm serverless instance only — a cold start re-logs in,
 * which is fine under normal load but can collide under a burst of concurrent cold starts. If
 * that becomes a real problem, persist the token on `FulfillmentProvider.metadata` instead.
 *
 * Orders are two-step on CJ: create, then pay from the connected CJ wallet balance
 * (POST /shopping/pay/payment). If the wallet has insufficient funds the order exists on CJ but
 * stays unpaid — this adapter reports that case as PROCESSING with an "unpaid:" error so ops sees
 * it rather than losing the order silently.
 */

const CJ_API_BASE = "https://developers.cjdropshipping.com/api2.0/v1"

type CjTokenCacheEntry = { accessToken: string; expiresAt: number }
const tokenCache = new Map<string, CjTokenCacheEntry>()
const inFlightAuth = new Map<string, Promise<string>>()

export function cjStatusToOrderStatus(raw: string | undefined): OrderStatusDTO["status"] {
  const s = (raw ?? "").toUpperCase()
  if (s.includes("CANCEL")) return "CANCELLED"
  if (s.includes("DELIVER")) return "DELIVERED"
  if (s.includes("SHIP")) return "SHIPPED"
  if (s.includes("UNPAID") || s.includes("CREATED") || s.includes("CART")) return "PENDING"
  return "CONFIRMED"
}

type CjEnvelope<T> = { result?: boolean; message?: string; data?: T }

export class CjDropshippingSupplierAdapter extends BaseSupplierAdapter {
  readonly type: SupplierChannelType = "CJ_DROPSHIPPING"
  readonly supportsApi = true

  private apiBase(): string {
    const configured = typeof this.config.apiEndpoint === "string" ? this.config.apiEndpoint.trim() : ""
    return (configured || CJ_API_BASE).replace(/\/$/, "")
  }

  private credentialKey(): string {
    const email = typeof this.config.email === "string" ? this.config.email.trim() : ""
    return `${this.supplier.id}:${email || "unknown"}`
  }

  /** Admin "Test connection" button — logs in for real, doesn't place anything. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.getAccessToken()
      return { ok: true, message: "CJ login OK" }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }
  }

  private async getAccessToken(): Promise<string> {
    const key = this.credentialKey()
    const cached = tokenCache.get(key)
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken

    const inFlight = inFlightAuth.get(key)
    if (inFlight) return inFlight

    const promise = (async () => {
      const email = typeof this.config.email === "string" ? this.config.email.trim() : ""
      const password = typeof this.config.apiKey === "string" ? this.config.apiKey.trim() : ""
      if (!email || !password) {
        throw new Error("cj_missing_credentials: set email + apiKey (CJ API Key) on this provider")
      }
      const res = await fetch(`${this.apiBase()}/authentication/getAccessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(this.requestTimeoutMs()),
      })
      const json = (await res.json().catch(() => null)) as CjEnvelope<{
        accessToken?: string
        accessTokenExpiryDate?: string
      }> | null
      if (!res.ok || !json?.result || !json.data?.accessToken) {
        throw new Error(`cj_auth_failed:${res.status}:${json?.message ?? "unknown"}`)
      }
      const expiresAt = json.data.accessTokenExpiryDate
        ? new Date(json.data.accessTokenExpiryDate).getTime()
        : Date.now() + 14 * 24 * 60 * 60 * 1000
      tokenCache.set(key, { accessToken: json.data.accessToken, expiresAt })
      return json.data.accessToken
    })()

    inFlightAuth.set(key, promise)
    try {
      return await promise
    } finally {
      inFlightAuth.delete(key)
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const token = await this.getAccessToken()
    const res = await fetch(`${this.apiBase()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "CJ-Access-Token": token,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(this.requestTimeoutMs()),
    })
    const json = (await res.json().catch(() => null)) as CjEnvelope<T> | null
    if (!res.ok || json?.result === false) {
      throw new Error(`cj_request_failed:${path}:${res.status}:${json?.message ?? "unknown"}`)
    }
    return (json?.data ?? (json as unknown)) as T
  }

  async placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult> {
    return this.withObservability("cj-dropshipping.placeOrder", async () => {
      const dto = this.parsePlaceOrder(input)
      this.validateAllLineMargins(dto.lines)

      const shipping = dto.shipping
      const rawRequest = {
        orderNumber: dto.reference,
        shippingCountryCode: (shipping.country ?? "").toUpperCase(),
        shippingProvince: shipping.state ?? "",
        shippingCity: shipping.city ?? "",
        shippingAddress: [shipping.line1, shipping.line2].filter(Boolean).join(", "),
        shippingZip: shipping.postal_code ?? shipping.postalCode ?? "",
        shippingPhone: shipping.phone ?? "",
        shippingCustomerName: shipping.name ?? "",
        email: dto.contactEmail ?? "orders@affisell.com",
        products: dto.lines.map((l) => ({ vid: l.sku, quantity: l.quantity })),
      }

      try {
        const created = await this.request<{ orderId?: string; orderNum?: string }>(
          "/shopping/order/createOrderV2",
          { method: "POST", body: JSON.stringify(rawRequest) }
        )
        if (!created?.orderId) {
          return {
            supplierOrderId: null,
            status: "FAILED",
            errorMessage: "cj_create_order_missing_id",
            rawRequest,
            rawResponse: created,
          }
        }

        try {
          await this.request("/shopping/pay/payment", {
            method: "POST",
            body: JSON.stringify({ orderId: created.orderId }),
          })
        } catch (payError) {
          console.log("[cj-dropshipping-adapter]", {
            result: "order_created_payment_failed",
            orderId: created.orderId,
            error: payError instanceof Error ? payError.message : String(payError),
          })
          return {
            supplierOrderId: created.orderId,
            status: "PROCESSING",
            errorMessage:
              payError instanceof Error ? `unpaid:${payError.message}` : "unpaid:unknown_error",
            rawRequest,
            rawResponse: created,
          }
        }

        return {
          supplierOrderId: created.orderId,
          status: "PROCESSING",
          rawRequest,
          rawResponse: created,
        }
      } catch (e) {
        return {
          supplierOrderId: null,
          status: "FAILED",
          errorMessage: e instanceof Error ? e.message : String(e),
          rawRequest,
        }
      }
    })
  }

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return this.withObservability("cj-dropshipping.getOrderStatus", async () => {
      const data = await this.request<{
        orderStatus?: string
        trackNumber?: string
        logisticName?: string
      }>(`/shopping/order/getOrderDetail?orderId=${encodeURIComponent(supplierOrderId)}`, {
        method: "GET",
      })
      return {
        status: cjStatusToOrderStatus(data?.orderStatus),
        trackingNumber: data?.trackNumber || undefined,
        carrier: data?.logisticName || undefined,
        raw: data,
      }
    })
  }

  async cancelOrder(supplierOrderId: string): Promise<void> {
    return this.withObservability("cj-dropshipping.cancelOrder", async () => {
      await this.request("/shopping/order/deleteOrder", {
        method: "POST",
        body: JSON.stringify({ orderIds: [supplierOrderId] }),
      })
    })
  }

  async syncInventory(skus: string[]): Promise<InventoryDTO[]> {
    return this.withObservability("cj-dropshipping.syncInventory", async () => {
      return Promise.all(
        skus.map(async (sku) => {
          try {
            const data = await this.request<{ storageNum?: number }>(
              `/product/stock/queryByVid?vid=${encodeURIComponent(sku)}`,
              { method: "GET" }
            )
            const stock = typeof data?.storageNum === "number" ? data.storageNum : 0
            return { sku, stock, available: stock > 0 }
          } catch {
            return { sku, stock: 0, available: false }
          }
        })
      )
    })
  }
}
