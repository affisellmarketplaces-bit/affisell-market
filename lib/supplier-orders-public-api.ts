import type { SupplierFulfillmentOrder } from "@/lib/supplier-orders-payload"

/** Never expose affiliate markup or full margin meta to supplier clients — only Affiliates / ops should see retained margin. */
export type SupplierFulfillmentOrderPublic = Omit<
  SupplierFulfillmentOrder,
  "affiliateMarginRetainedCents" | "marginCents"
>

export function toSupplierFulfillmentOrdersPublic(
  rows: SupplierFulfillmentOrder[]
): SupplierFulfillmentOrderPublic[] {
  return rows.map(toSupplierFulfillmentOrderPublic)
}

export function toSupplierFulfillmentOrderPublic(
  o: SupplierFulfillmentOrder
): SupplierFulfillmentOrderPublic {
  const { affiliateMarginRetainedCents: _a, marginCents: _m, ...rest } = o
  return rest
}
