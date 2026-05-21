import { z } from "zod"

import type { Prisma, SupplierChannelType, SupplierFulfillmentStatus } from "@prisma/client"

export const shippingAddressSchema = z.object({
  name: z.string().max(200).optional(),
  line1: z.string().max(200).optional(),
  line2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  postal_code: z.string().max(32).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().max(2).optional(),
  phone: z.string().max(40).optional(),
})

export type ShippingAddressDTO = z.infer<typeof shippingAddressSchema>

export const placeOrderLineSchema = z.object({
  sku: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(999),
  unitCostCents: z.number().int().min(0),
  /** Shopper-paid unit price (cents) — used for margin guard. */
  unitPriceCents: z.number().int().min(0),
  productId: z.string().optional(),
  variantLabel: z.string().optional(),
})

export const placeOrderDtoSchema = z.object({
  reference: z.string().min(1).max(120),
  shipping: shippingAddressSchema,
  contactEmail: z.string().email().optional(),
  lines: z.array(placeOrderLineSchema).min(1).max(50),
})

export type PlaceOrderDTO = z.infer<typeof placeOrderDtoSchema>

export type SupplierOrderResult = {
  supplierOrderId: string | null
  status: SupplierFulfillmentStatus
  rawRequest?: unknown
  rawResponse?: unknown
  errorMessage?: string
}

/** Legacy DTO mapped from `SupplierOrderStatus` for Prisma / engine consumers. */
export type OrderStatusDTO = {
  supplierOrderId: string
  status: SupplierFulfillmentStatus
  trackingNumber?: string | null
  trackingUrl?: string | null
  raw?: unknown
}

export type InventoryDTO = {
  sku: string
  stock: number
  available: boolean
}

export type DecryptedConfig = {
  apiEndpoint?: string
  apiKey?: string
  apiSecret?: string
  timeoutMs?: number
  version?: string
  createOrderPath?: string
  inventoryPath?: string
  orderStatusPath?: string
  cancelOrderPath?: string
  extraHeaders?: Record<string, string>
  minMarginRatio?: number
  [key: string]: unknown
}

/** Provider row passed into adapters (maps to `FulfillmentProvider`). */
export type SupplierContext = {
  id: string
  slug: string
  name: string
  type: SupplierChannelType
  apiConfig: Prisma.JsonValue
  credentialsEncrypted: string | null
  stripeConnectAccountId?: string | null
  slaHours: number
}

export const DEFAULT_MIN_MARGIN_RATIO = 0.15
