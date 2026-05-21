export const PLACE_SUPPLIER_ORDER_QUEUE = "auto-order:place-supplier-order"
export const PLACE_SUPPLIER_ORDER_DLQ = "auto-order:place-supplier-order:dlq"
export const BATCH_FULFILL_QUEUE = "auto-order:batch-fulfill"

export function placeSupplierOrderJobId(supplierFulfillmentOrderId: string): string {
  return `place:${supplierFulfillmentOrderId}`
}
