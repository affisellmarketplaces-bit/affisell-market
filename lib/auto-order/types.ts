import type {
  FulfillmentPaymentMethod,
  FulfillmentStatus,
  SupplierChannelType,
  SupplierFulfillmentStatus,
} from "@prisma/client"

export type ShippingAddressPayload = {
  name?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  phone?: string
}

export type FulfillmentLineSnapshot = {
  orderId: string
  productId: string
  productName: string
  quantity: number
  unitCostCents: number
  /** Shopper-paid unit price (cents) for margin guard in supplier adapters. */
  unitPriceCents: number
  supplierSku: string | null
  variantLabel: string | null
  channel: SupplierChannelType
  providerId: string
}

export type SupplierGroup = {
  providerId: string
  channel: SupplierChannelType
  paymentMethod: FulfillmentPaymentMethod
  lines: FulfillmentLineSnapshot[]
  totalCostCents: number
}

export type PlaceSupplierOrderInput = {
  batchId: string
  reference: string
  shipping: ShippingAddressPayload
  contactEmail: string
  group: SupplierGroup
}

export type PlaceSupplierOrderResult = {
  supplierOrderId: string | null
  status: SupplierFulfillmentStatus
  paymentReference?: string
  rawRequest?: unknown
  rawResponse?: unknown
  errorMessage?: string
}

export type BatchRunResult = {
  batchId: string
  fulfillmentStatus: FulfillmentStatus
  jobs: Array<{ jobId: string; status: SupplierFulfillmentStatus; error?: string }>
}
