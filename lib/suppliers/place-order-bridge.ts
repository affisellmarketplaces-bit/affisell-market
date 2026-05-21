import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"
import { blindDropshipSupplierContactEmail } from "@/lib/blind-dropship-contact"
import { openBlindSecret } from "@/lib/blind-dropship-crypto"
import type { BaseSupplierAdapter } from "@/lib/suppliers/base.adapter"
import { MarginTooLowError } from "@/lib/suppliers/base.adapter"
import type { PlaceOrderDTO } from "@/lib/suppliers/dto"
import { createSupplierAdapter, fulfillmentProviderToContext } from "@/lib/suppliers/factory"
import { BlindRestSupplierAdapter } from "@/lib/suppliers/adapters/blind-rest.adapter"
import type { SupplierContext } from "@/lib/suppliers/dto"
import { prisma } from "@/lib/prisma"

function toPlaceOrderDto(input: PlaceSupplierOrderInput, contactEmail?: string): PlaceOrderDTO {
  return {
    reference: input.reference,
    shipping: input.shipping,
    contactEmail,
    lines: input.group.lines.map((l) => ({
      sku: l.supplierSku ?? l.productId,
      quantity: l.quantity,
      unitCostCents: l.unitCostCents,
      unitPriceCents: l.unitPriceCents ?? l.unitCostCents,
      productId: l.productId,
    })),
  }
}

/** Build adapter for a provider row, hydrating blind REST credentials from `BlindDropshipSupplier`. */
export async function resolveSupplierAdapterForGroup(
  providerId: string
): Promise<BaseSupplierAdapter> {
  const provider = await prisma.fulfillmentProvider.findUnique({
    where: { id: providerId },
    include: { blindDropshipSupplier: true },
  })
  if (!provider) throw new Error(`fulfillment_provider_not_found:${providerId}`)

  const blindPartner = provider.blindDropshipSupplier
  const blindEndpoint =
    blindPartner?.apiEndpoint && typeof blindPartner.apiEndpoint === "string"
      ? blindPartner.apiEndpoint.trim()
      : ""
  if (provider.channelType === "BLIND_REST" && blindPartner && blindEndpoint) {
    const blind = blindPartner
    const endpoint = blindEndpoint
    const ctx: SupplierContext = {
      ...fulfillmentProviderToContext(provider),
      apiConfig: {
        ...(typeof provider.apiConfig === "object" && provider.apiConfig
          ? (provider.apiConfig as Record<string, unknown>)
          : {}),
        apiEndpoint: endpoint,
        ...(blind.config && typeof blind.config === "object" ? (blind.config as Record<string, unknown>) : {}),
      },
      credentialsEncrypted: null,
    }
    const adapter = new BlindRestSupplierAdapter(ctx)
    adapter.applyPartnerCredentials({
      apiEndpoint: endpoint,
      apiKey: openBlindSecret(blind.apiKeyEncrypted),
      config:
        blind.config && typeof blind.config === "object"
          ? (blind.config as Record<string, unknown>)
          : undefined,
    })
    return adapter
  }

  return createSupplierAdapter(provider)
}

export async function placeOrderViaSupplierAdapter(
  input: PlaceSupplierOrderInput
): Promise<PlaceSupplierOrderResult> {
  const adapter = await resolveSupplierAdapterForGroup(input.group.providerId)
  const contactEmail =
    adapter.type === "BLIND_REST"
      ? blindDropshipSupplierContactEmail(input.batchId)
      : undefined

  try {
    const result = await adapter.placeOrder(toPlaceOrderDto(input, contactEmail))
    return {
      supplierOrderId: result.supplierOrderId,
      status: result.status,
      errorMessage: result.errorMessage,
      rawRequest: result.rawRequest,
      rawResponse: result.rawResponse,
    }
  } catch (e) {
    if (e instanceof MarginTooLowError) {
      return {
        supplierOrderId: null,
        status: "FAILED",
        errorMessage: e.message,
      }
    }
    throw e
  }
}
