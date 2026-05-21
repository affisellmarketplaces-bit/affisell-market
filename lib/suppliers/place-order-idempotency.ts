import type { SupplierFulfillmentStatus } from "@prisma/client"

import type { PlaceSupplierOrderResult } from "@/lib/auto-order/types"
import { prisma } from "@/lib/prisma"

const TERMINAL_OK: SupplierFulfillmentStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED"]

export async function loadIdempotentPlaceOrderResult(
  supplierFulfillmentOrderId: string
): Promise<PlaceSupplierOrderResult | null> {
  const row = await prisma.supplierFulfillmentOrder.findUnique({
    where: { id: supplierFulfillmentOrderId },
    select: {
      status: true,
      supplierOrderId: true,
      errorMessage: true,
      rawRequest: true,
      rawResponse: true,
    },
  })
  if (!row) return null

  if (TERMINAL_OK.includes(row.status) && row.supplierOrderId) {
    return {
      supplierOrderId: row.supplierOrderId,
      status: row.status,
      rawRequest: row.rawRequest ?? undefined,
      rawResponse: row.rawResponse ?? undefined,
    }
  }

  if (row.status === "FAILED" && row.errorMessage) {
    return {
      supplierOrderId: null,
      status: "FAILED",
      errorMessage: row.errorMessage,
      rawRequest: row.rawRequest ?? undefined,
      rawResponse: row.rawResponse ?? undefined,
    }
  }

  return null
}
