import type { IntegrationProvider } from "@prisma/client"

import type { ShippingAddressPayload } from "@/lib/auto-order/types"
import { decryptIntegrationSecret } from "@/lib/integrations/crypto"
import { normalizeWooShopDomain } from "@/lib/integrations/woo-domain"

export type WooFulfillLine = {
  orderId: string
  productExternalId: string | null
  quantity: number
  title: string
}

export type WooCreateOrderInput = {
  integration: {
    provider: IntegrationProvider | null
    shopDomain: string | null
    accessTokenEncrypted: string | null
  }
  customerEmail: string
  shippingAddress: ShippingAddressPayload
  lines: WooFulfillLine[]
}

export type WooCreateOrderResult =
  | { ok: true; externalOrderId: string; raw: unknown }
  | { ok: false; error: string; raw?: unknown }

type WooStoredCredentials = { ck: string; cs: string }

function parseWooCredentials(accessTokenEncrypted: string): WooStoredCredentials {
  const parsed = JSON.parse(decryptIntegrationSecret(accessTokenEncrypted)) as WooStoredCredentials
  if (!parsed?.ck?.trim() || !parsed?.cs?.trim()) {
    throw new Error("Invalid WooCommerce credentials payload")
  }
  return { ck: parsed.ck.trim(), cs: parsed.cs.trim() }
}

function basicAuthHeader(ck: string, cs: string): string {
  return `Basic ${Buffer.from(`${ck}:${cs}`, "utf8").toString("base64")}`
}

function splitName(full: string | undefined): { first_name: string; last_name: string } {
  const parts = (full ?? "Affisell Customer").trim().split(/\s+/)
  if (parts.length <= 1) return { first_name: parts[0] ?? "Customer", last_name: "." }
  return { first_name: parts[0]!, last_name: parts.slice(1).join(" ") }
}

function mapWooAddress(addr: ShippingAddressPayload, email: string) {
  const names = splitName(addr.name)
  return {
    ...names,
    email,
    address_1: addr.line1 ?? "",
    address_2: addr.line2 ?? "",
    city: addr.city ?? "",
    state: addr.state ?? "",
    postcode: addr.postal_code ?? "",
    country: addr.country ?? "",
    phone: addr.phone ?? "",
  }
}

export async function createWooFulfillmentOrder(
  input: WooCreateOrderInput
): Promise<WooCreateOrderResult> {
  if (input.integration.provider !== ("WOOCOMMERCE" satisfies IntegrationProvider)) {
    return { ok: false, error: "INTEGRATION_NOT_WOO" }
  }

  const shopHost = normalizeWooShopDomain(input.integration.shopDomain ?? "")
  if (!shopHost || !input.integration.accessTokenEncrypted) {
    return { ok: false, error: "WOO_CREDENTIALS_MISSING" }
  }

  let creds: WooStoredCredentials
  try {
    creds = parseWooCredentials(input.integration.accessTokenEncrypted)
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "WOO_CREDENTIALS_INVALID",
    }
  }

  const address = mapWooAddress(input.shippingAddress, input.customerEmail)
  const lineItems = input.lines
    .filter((l) => l.productExternalId)
    .map((line) => ({
      product_id: Number.parseInt(line.productExternalId!.replace(/\D/g, ""), 10),
      quantity: line.quantity,
      name: line.title,
    }))

  if (lineItems.length === 0) {
    return { ok: false, error: "WOO_NO_LINE_ITEMS" }
  }

  const payload = {
    payment_method: "affisell",
    payment_method_title: "Affisell Marketplace",
    set_paid: true,
    billing: address,
    shipping: address,
    line_items: lineItems,
    customer_note: "Affisell marketplace auto-buy",
  }

  const url = `https://${shopHost}/wp-json/wc/v3/orders`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuthHeader(creds.ck, creds.cs),
    },
    body: JSON.stringify(payload),
  })

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err =
      typeof raw.message === "string"
        ? raw.message
        : JSON.stringify(raw).slice(0, 500)
    console.log("[woo-fulfill]", { result: "create_failed", status: res.status, err })
    return { ok: false, error: `Woo HTTP ${res.status}: ${err}`, raw }
  }

  const externalOrderId = raw.id != null ? String(raw.id) : null
  if (!externalOrderId) {
    return { ok: false, error: "WOO_ORDER_ID_MISSING", raw }
  }

  console.log("[woo-fulfill]", {
    result: "created",
    externalOrderId,
    lineCount: input.lines.length,
  })
  return { ok: true, externalOrderId, raw }
}
