import { blindDropshipSupplierContactEmail } from "@/lib/blind-dropship-contact"
import { openBlindSecret } from "@/lib/blind-dropship-crypto"
import { buildSupplierAdapterFromConfig } from "@/lib/suppliers/build-rest-adapter"
import type { BlindCreateOrderInput, BlindSupplierAddress } from "@/lib/suppliers/types"
import { prisma } from "@/lib/prisma"
import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"

function asAddress(raw: PlaceSupplierOrderInput["shipping"]): BlindSupplierAddress {
  return {
    name: String(raw.name ?? "").slice(0, 200),
    line1: String(raw.line1 ?? "").slice(0, 200),
    line2: raw.line2 ? String(raw.line2).slice(0, 200) : undefined,
    city: String(raw.city ?? "").slice(0, 120),
    state: raw.state ? String(raw.state).slice(0, 120) : undefined,
    postal_code: String(raw.postal_code ?? "").slice(0, 32),
    country: String(raw.country ?? "FR").toUpperCase().slice(0, 2),
    phone: raw.phone ? String(raw.phone).slice(0, 40) : undefined,
  }
}

export async function placeBlindRestOrder(
  input: PlaceSupplierOrderInput
): Promise<PlaceSupplierOrderResult> {
  const provider = await prisma.fulfillmentProvider.findUnique({
    where: { id: input.group.providerId },
    include: { blindDropshipSupplier: true },
  })
  const blind = provider?.blindDropshipSupplier
  if (!blind?.apiEndpoint) {
    return {
      supplierOrderId: null,
      status: "FAILED",
      errorMessage: "Missing blind REST supplier configuration",
    }
  }

  const apiKey = openBlindSecret(blind.apiKeyEncrypted)
  const adapter = buildSupplierAdapterFromConfig({
    apiEndpoint: blind.apiEndpoint,
    apiKeyPlain: apiKey,
    config: (blind.config ?? {}) as Record<string, unknown>,
  })

  const payload: BlindCreateOrderInput = {
    shipping: asAddress(input.shipping),
    contact_email: blindDropshipSupplierContactEmail(input.batchId),
    reference: input.reference,
    items: input.group.lines.map((l) => ({
      sku: l.supplierSku ?? l.productId,
      quantity: l.quantity,
      unit_price_cents: l.unitCostCents,
    })),
  }

  const created = await adapter.createOrder(payload)
  return {
    supplierOrderId: created.supplier_order_id,
    status: "CONFIRMED",
    rawRequest: payload,
    rawResponse: created,
  }
}
