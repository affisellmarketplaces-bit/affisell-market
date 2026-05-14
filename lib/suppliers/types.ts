/** Shipping payload sent to partner APIs — mirrors client checkout (no mutation). */
export type BlindSupplierAddress = {
  name: string
  line1: string
  line2?: string
  city: string
  state?: string
  postal_code: string
  country: string
  phone?: string
}

/** Line sent to supplier — wholesale only (cents per unit). */
export type BlindSupplierLineItem = {
  sku: string
  quantity: number
  /** Supplier wholesale in cents (integer); never affiliate retail. */
  unit_price_cents: number
}

export type BlindCreateOrderInput = {
  shipping: BlindSupplierAddress
  items: BlindSupplierLineItem[]
  /** Opaque contact for the partner (not the end customer email). */
  contact_email: string
  /** Internal reference for partner support (no PII). */
  reference: string
}

export type BlindCreateOrderResult = {
  supplier_order_id: string
}

export type BlindStockRow = {
  sku: string
  stock: number
}

export interface SupplierAdapter {
  createOrder(data: BlindCreateOrderInput): Promise<BlindCreateOrderResult>
  getStock(): Promise<BlindStockRow[]>
}
