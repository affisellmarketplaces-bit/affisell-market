import type { SupplierFulfillmentOrder } from "@/lib/supplier-orders-payload"

/** Supplier API payload — already stripped of affiliate retail / identity in `SupplierFulfillmentOrder`. */
export type SupplierFulfillmentOrderPublic = SupplierFulfillmentOrder

export function toSupplierFulfillmentOrdersPublic(
  rows: SupplierFulfillmentOrder[]
): SupplierFulfillmentOrderPublic[] {
  return rows.map(toSupplierFulfillmentOrderPublic)
}

export function toSupplierFulfillmentOrderPublic(
  o: SupplierFulfillmentOrder
): SupplierFulfillmentOrderPublic {
  return o
}
