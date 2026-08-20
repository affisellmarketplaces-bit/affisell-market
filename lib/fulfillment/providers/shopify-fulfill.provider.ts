import type { IntegrationProvider } from "@prisma/client"

import type { ShippingAddressPayload } from "@/lib/auto-order/types"
import { parseShopifyIntegrationConfig } from "@/lib/supplier-integration-config"
import type { SupplierIntegrationRow } from "@/lib/supplier-sync/types"

const DEFAULT_API_VERSION = "2024-01"

export type ShopifyFulfillLine = {
  orderId: string
  productExternalId: string | null
  variantExternalId: string | null
  quantity: number
  title: string
}

export type ShopifyCreateOrderInput = {
  integration: Pick<
    SupplierIntegrationRow,
    "config" | "shopDomain" | "accessTokenEncrypted" | "provider"
  >
  customerEmail: string
  shippingAddress: ShippingAddressPayload
  lines: ShopifyFulfillLine[]
}

export type ShopifyCreateOrderResult =
  | { ok: true; externalOrderId: string; raw: unknown }
  | { ok: false; error: string; raw?: unknown }

function splitName(full: string | undefined): { first_name: string; last_name: string } {
  const parts = (full ?? "Affisell Customer").trim().split(/\s+/)
  if (parts.length <= 1) return { first_name: parts[0] ?? "Customer", last_name: "." }
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") }
}

function mapShippingAddress(addr: ShippingAddressPayload) {
  const names = splitName(addr.name)
  return {
    ...names,
    address1: addr.line1 ?? "",
    address2: addr.line2 ?? "",
    city: addr.city ?? "",
    province: addr.state ?? "",
    zip: addr.postal_code ?? "",
    country: addr.country ?? "",
    phone: addr.phone ?? "",
  }
}

function buildLineItems(lines: ShopifyFulfillLine[]) {
  return lines.map((line) => {
    const variantId = line.variantExternalId?.replace(/\D/g, "")
    const productId = line.productExternalId?.replace(/\D/g, "")
    if (variantId) {
      return { variant_id: Number(variantId), quantity: line.quantity, title: line.title }
    }
    if (productId) {
      return { product_id: Number(productId), quantity: line.quantity, title: line.title }
    }
    return { title: line.title, quantity: line.quantity, price: "0.00" }
  })
}

export async function createShopifyFulfillmentOrder(
  input: ShopifyCreateOrderInput
): Promise<ShopifyCreateOrderResult> {
  if (input.integration.provider !== ("SHOPIFY" satisfies IntegrationProvider)) {
    return { ok: false, error: "INTEGRATION_NOT_SHOPIFY" }
  }

  const creds = parseShopifyIntegrationConfig(input.integration.config, {
    shopDomain: input.integration.shopDomain,
    accessTokenEncrypted: input.integration.accessTokenEncrypted,
  })
  if (!creds) return { ok: false, error: "SHOPIFY_CREDENTIALS_MISSING" }

  const apiVersion =
    creds.apiVersion && creds.apiVersion.trim() ? creds.apiVersion.trim() : DEFAULT_API_VERSION
  const payload = {
    order: {
      email: input.customerEmail,
      financial_status: "paid",
      send_receipt: false,
      send_fulfillment_receipt: false,
      inventory_behaviour: "decrement_obeying_policy",
      line_items: buildLineItems(input.lines),
      shipping_address: mapShippingAddress(input.shippingAddress),
      note: "Affisell marketplace auto-buy",
      tags: "affisell,auto-buy",
    },
  }

  const url = `https://${creds.shopHost}/admin/api/${apiVersion}/orders.json`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": creds.accessToken,
    },
    body: JSON.stringify(payload),
  })

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err =
      typeof raw.errors === "string"
        ? raw.errors
        : JSON.stringify(raw.errors ?? raw).slice(0, 500)
    console.log("[shopify-fulfill]", { result: "create_failed", status: res.status, err })
    return { ok: false, error: `Shopify HTTP ${res.status}: ${err}`, raw }
  }

  const order = raw.order as { id?: number | string } | undefined
  const externalOrderId = order?.id != null ? String(order.id) : null
  if (!externalOrderId) {
    return { ok: false, error: "SHOPIFY_ORDER_ID_MISSING", raw }
  }

  console.log("[shopify-fulfill]", {
    result: "created",
    externalOrderId,
    lineCount: input.lines.length,
  })
  return { ok: true, externalOrderId, raw }
}
