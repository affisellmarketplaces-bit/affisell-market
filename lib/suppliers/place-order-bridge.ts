import type { PlaceSupplierOrderInput, PlaceSupplierOrderResult } from "@/lib/auto-order/types"
import { blindDropshipSupplierContactEmail } from "@/lib/blind-dropship-contact"
import { openBlindSecret } from "@/lib/blind-dropship-crypto"
import type { BaseSupplierAdapter } from "@/lib/suppliers/base.adapter"
import { MarginTooLowError } from "@/lib/suppliers/base.adapter"
import type { PlaceOrderDTO } from "@/lib/suppliers/dto"
import { createSupplierAdapter, fulfillmentProviderToContext } from "@/lib/suppliers/factory"
import { BlindRestSupplierAdapter } from "@/lib/suppliers/adapters/blind-rest.adapter"
import type { SupplierContext } from "@/lib/suppliers/dto"
import {
  authorizeSupplierPurchase,
  markSupplierPurchasePlaced,
  releaseSupplierPurchase,
  reportInDoubtPurchase,
} from "@/lib/fulfillment/supplier-purchase-guard"
import { prisma } from "@/lib/prisma"
import { ZodError } from "zod"

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

  if (adapter.type === "ALIEXPRESS") {
    return placeAliExpressOrderUnderClaim(adapter, input)
  }

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

/**
 * The generic engine's way into AliExpress — the second of the three paths that can place an AE order (G2). It goes
 * through the SAME per-order gate as `auto-buy.ts` and `aliexpress-fulfill-order.ts` (`authorizeSupplierPurchase`).
 *
 * `AliExpressSupplierAdapter.placeOrder` places ONE AE order, for the group's FIRST line — that is the order the claim
 * covers. (Lines 2..n of a multi-product AliExpress group are not purchased by that adapter: a pre-existing gap, safe
 * direction — an under-purchase, never a double one.)
 *
 * Result mapping — never `PROCESSING` for "somebody else is on it" (the engine would then overwrite the order's
 * fulfilment status): a purchase that did not start here comes back CANCELLED, which `applySupplierPlaceOrderResult`
 * records on the job only and never writes onto the orders.
 */
async function placeAliExpressOrderUnderClaim(
  adapter: BaseSupplierAdapter,
  input: PlaceSupplierOrderInput
): Promise<PlaceSupplierOrderResult> {
  const orderId = input.group.lines[0]?.orderId
  const dto = toPlaceOrderDto(input)

  // No line = nothing can be purchased; the adapter answers `empty_lines` / a validation error without any call.
  if (!orderId) {
    const result = await adapter.placeOrder(dto)
    return {
      supplierOrderId: result.supplierOrderId,
      status: result.status,
      errorMessage: result.errorMessage,
      rawRequest: result.rawRequest,
      rawResponse: result.rawResponse,
    }
  }

  const verdict = await authorizeSupplierPurchase({ orderId, path: "engine" })
  switch (verdict.kind) {
    case "go":
      break
    case "already_placed":
      return {
        supplierOrderId: null,
        status: "CANCELLED",
        errorMessage: "duplicate_purchase_prevented:already_placed",
        rawResponse: { evidence: verdict.evidence, supplierOrderIdTail: verdict.supplierOrderId.slice(-6) },
      }
    case "in_progress":
      return {
        supplierOrderId: null,
        status: "CANCELLED",
        errorMessage: "duplicate_purchase_prevented:in_progress",
        rawResponse: { stale: verdict.stale },
      }
    case "not_purchasable":
      return {
        supplierOrderId: null,
        status: "CANCELLED",
        errorMessage: `purchase_not_allowed:${verdict.reason}:${verdict.orderStatus}`,
      }
    case "order_not_found":
      return { supplierOrderId: null, status: "CANCELLED", errorMessage: "purchase_not_allowed:order_not_found" }
    case "margin_refused":
      return {
        supplierOrderId: null,
        status: "FAILED",
        errorMessage: `margin_refused:${verdict.decision.reason}`,
        rawResponse: { marginCents: verdict.decision.marginCents, floorCents: verdict.decision.floorCents },
      }
  }

  let result
  try {
    result = await adapter.placeOrder(dto)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (e instanceof MarginTooLowError || e instanceof ZodError) {
      // Thrown by the adapter's own pre-checks, before any call to AliExpress: nothing was bought, free the claim.
      await releaseSupplierPurchase(orderId, `ADAPTER_PRECHECK:${message}`)
      if (e instanceof MarginTooLowError) return { supplierOrderId: null, status: "FAILED", errorMessage: message }
      throw e
    }
    // Anything else may have happened after the request left: keep the claim (it blocks every replay) and alert.
    await reportInDoubtPurchase({ orderId, path: "engine", reason: "supplier_outcome_uncertain", error: message })
    throw e
  }

  const placed: PlaceSupplierOrderResult = {
    supplierOrderId: result.supplierOrderId,
    status: result.status,
    errorMessage: result.errorMessage,
    rawRequest: result.rawRequest,
    rawResponse: result.rawResponse,
    ...(result.outcomeUncertain ? { outcomeUncertain: true } : {}),
  }

  if (placed.status !== "FAILED" && placed.supplierOrderId) {
    await markSupplierPurchasePlaced(orderId, placed.supplierOrderId)
  } else if (placed.status === "FAILED" && placed.outcomeUncertain) {
    // The claim stays BUYING; FAILED + this message makes the engine flag the order for manual handling.
    await reportInDoubtPurchase({
      orderId,
      path: "engine",
      reason: "supplier_outcome_uncertain",
      error: placed.errorMessage,
    })
    return { ...placed, errorMessage: "supplier_outcome_uncertain" }
  } else if (placed.status === "FAILED") {
    await releaseSupplierPurchase(orderId, placed.errorMessage ?? "supplier_refused")
  }
  return placed
}
