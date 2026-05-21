import { SpanStatusCode, trace } from "@opentelemetry/api"
import type { SupplierChannelType } from "@prisma/client"

import { decryptProviderConfig } from "@/lib/suppliers/decrypt-config"
import {
  DEFAULT_MIN_MARGIN_RATIO,
  placeOrderDtoSchema,
  type DecryptedConfig,
  type InventoryDTO,
  type OrderStatusDTO,
  type PlaceOrderDTO,
  type SupplierContext,
  type SupplierOrderResult,
} from "@/lib/suppliers/dto"

export class MarginTooLowError extends Error {
  readonly code = "MARGIN_TOO_LOW"
  constructor(costCents: number, priceCents: number) {
    super(`Margin below minimum: cost ${costCents} vs price ${priceCents}`)
    this.name = "MarginTooLowError"
  }
}

export abstract class BaseSupplierAdapter {
  abstract readonly type: SupplierChannelType
  abstract readonly supportsApi: boolean

  protected readonly supplier: SupplierContext
  protected readonly config: DecryptedConfig
  protected readonly tracer = trace.getTracer("affisell.supplier-adapter")

  constructor(supplier: SupplierContext) {
    this.supplier = supplier
    this.config = decryptProviderConfig({
      apiConfig: supplier.apiConfig,
      credentialsEncrypted: supplier.credentialsEncrypted,
    })
  }

  abstract placeOrder(input: PlaceOrderDTO): Promise<SupplierOrderResult>
  abstract getOrderStatus(supplierOrderId: string): Promise<OrderStatusDTO>
  abstract cancelOrder(supplierOrderId: string): Promise<void>
  abstract syncInventory(skus: string[]): Promise<InventoryDTO[]>

  protected async withObservability<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(name, async (span) => {
      span.setAttribute("supplier.type", this.type)
      span.setAttribute("supplier.id", this.supplier.id)
      span.setAttribute("supplier.slug", this.supplier.slug)
      try {
        const res = await fn()
        span.setStatus({ code: SpanStatusCode.OK })
        return res
      } catch (e) {
        span.recordException(e instanceof Error ? e : new Error(String(e)))
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw e
      } finally {
        span.end()
      }
    })
  }

  protected parsePlaceOrder(input: PlaceOrderDTO): PlaceOrderDTO {
    return placeOrderDtoSchema.parse(input)
  }

  /** Reject lines where wholesale cost eats more than (1 - minMargin) of retail. */
  protected validateMargin(unitCostCents: number, unitPriceCents: number) {
    const minRatio =
      typeof this.config.minMarginRatio === "number" && this.config.minMarginRatio > 0
        ? this.config.minMarginRatio
        : DEFAULT_MIN_MARGIN_RATIO
    if (unitPriceCents <= 0) return
    if (unitCostCents >= unitPriceCents * (1 - minRatio)) {
      throw new MarginTooLowError(unitCostCents, unitPriceCents)
    }
  }

  protected validateAllLineMargins(lines: PlaceOrderDTO["lines"]) {
    for (const line of lines) {
      this.validateMargin(line.unitCostCents, line.unitPriceCents)
    }
  }

  protected requestTimeoutMs(): number {
    const t = this.config.timeoutMs
    return typeof t === "number" && t > 0 ? Math.min(t, 120_000) : 30_000
  }

  /** Runtime credentials (e.g. blind partner row) without storing secrets in `apiConfig`. */
  protected mergeConfig(extra: DecryptedConfig) {
    Object.assign(this.config, extra)
  }
}
