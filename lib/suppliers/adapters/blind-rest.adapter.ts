import type { SupplierChannelType } from "@prisma/client"

import { BaseSupplierAdapter, type OrderStatusDTO } from "@/lib/suppliers/base.adapter"
import type { InventoryDTO, PlaceOrderDTO, SupplierOrderResult } from "@/lib/suppliers/dto"
import {
  extractTrackingFromPartnerPayload,
  parsePartnerOrderStatusPayload,
} from "@/lib/suppliers/order-status"
import { RestSupplierAdapter } from "@/lib/suppliers/rest-adapter"
import type { BlindCreateOrderInput, BlindSupplierAddress } from "@/lib/suppliers/types"

function toBlindAddress(shipping: PlaceOrderDTO["shipping"]): BlindSupplierAddress {
  const postal = shipping.postal_code ?? shipping.postalCode ?? ""
  return {
    name: String(shipping.name ?? "").slice(0, 200),
    line1: String(shipping.line1 ?? "").slice(0, 200),
    line2: shipping.line2 ? String(shipping.line2).slice(0, 200) : undefined,
    city: String(shipping.city ?? "").slice(0, 120),
    state: shipping.state ? String(shipping.state).slice(0, 120) : undefined,
    postal_code: String(postal).slice(0, 32),
    country: String(shipping.country ?? "FR").toUpperCase().slice(0, 2),
    phone: shipping.phone ? String(shipping.phone).slice(0, 40) : undefined,
  }
}

export class BlindRestSupplierAdapter extends BaseSupplierAdapter {
  readonly type: SupplierChannelType = "BLIND_REST"
  readonly supportsApi = true

  applyPartnerCredentials(partner: {
    apiEndpoint: string
    apiKey: string
    config?: Record<string, unknown>
  }) {
    this.mergeConfig({
      apiEndpoint: partner.apiEndpoint,
      apiKey: partner.apiKey,
      ...(partner.config ?? {}),
    })
  }

  private rest(): RestSupplierAdapter {
    const endpoint = this.config.apiEndpoint
    const apiKey = this.config.apiKey
    if (!endpoint || !apiKey) {
      throw new Error("blind_rest_missing_credentials")
    }
    return new RestSupplierAdapter(endpoint, apiKey, {
      createOrderPath:
        typeof this.config.createOrderPath === "string" ? this.config.createOrderPath : undefined,
      inventoryPath:
        typeof this.config.inventoryPath === "string" ? this.config.inventoryPath : undefined,
      orderStatusPath:
        typeof this.config.orderStatusPath === "string" ? this.config.orderStatusPath : undefined,
      cancelOrderPath:
        typeof this.config.cancelOrderPath === "string" ? this.config.cancelOrderPath : undefined,
      extraHeaders:
        this.config.extraHeaders && typeof this.config.extraHeaders === "object"
          ? (this.config.extraHeaders as Record<string, string>)
          : undefined,
    })
  }

  async placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult> {
    return this.withObservability("blindRest.placeOrder", async () => {
      const dto = this.parsePlaceOrder(input)
      this.validateAllLineMargins(dto.lines)

      const payload: BlindCreateOrderInput = {
        shipping: toBlindAddress(dto.shipping),
        contact_email: dto.contactEmail ?? "fulfillment@affisell.internal",
        reference: dto.reference,
        items: dto.lines.map((l) => ({
          sku: l.sku,
          quantity: l.quantity,
          unit_price_cents: l.unitCostCents,
        })),
      }

      try {
        const created = await this.rest().createOrder(payload)
        return {
          supplierOrderId: created.supplier_order_id,
          status: "CONFIRMED",
          rawRequest: payload,
          rawResponse: created,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          supplierOrderId: null,
          status: "FAILED",
          errorMessage: msg,
          rawRequest: payload,
        }
      }
    })
  }

  async getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO> {
    return this.withObservability("blindRest.getOrderStatus", async () => {
      const raw = await this.rest().getOrderStatus(supplierOrderId)
      const tracking = extractTrackingFromPartnerPayload(raw)
      return {
        status: parsePartnerOrderStatusPayload(raw),
        ...tracking,
        raw,
      }
    })
  }

  async cancelOrder(supplierOrderId: string): Promise<void> {
    return this.withObservability("blindRest.cancelOrder", async () => {
      const result = await this.rest().cancelOrder(supplierOrderId)
      if (!result.cancelled) {
        throw new Error("blind_rest_cancel_rejected")
      }
    })
  }

  async syncInventory(skus: string[]): Promise<InventoryDTO[]> {
    return this.withObservability("blindRest.syncInventory", async () => {
      const rows = await this.rest().getStock()
      const wanted = new Set(skus)
      return rows
        .filter((r) => wanted.size === 0 || wanted.has(r.sku))
        .map((r) => ({
          sku: r.sku,
          stock: r.stock,
          available: r.stock > 0,
        }))
    })
  }
}
