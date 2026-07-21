/** Shared ProductRequest / ProductQuote DTOs — safe for client. */

export type ProductRequestDto = {
  id: string
  resellerId: string
  resellerEmail: string
  title: string
  description: string | null
  category: string
  quantity: number
  targetPrice: number | null
  country: string
  imageUrl: string | null
  status: string
  quotesCount: number
  deliverySLA: number | null
  deliveryPriority: string
  createdAt: string
  myQuoteStatus?: string | null
  /** Supplier list: can meet reseller SLA with typical stock ETA */
  slaCompatible?: boolean
}

export type ProductQuoteDto = {
  id: string
  requestId: string
  supplierId: string
  supplierName: string | null
  supplierEmail: string | null
  price: number
  moq: number
  deliveryDays: number
  message: string | null
  status: string
  createdAt: string
}

export const PRODUCT_REQUEST_CATEGORIES = [
  { id: "baby", label: "Bébé" },
  { id: "auto", label: "Auto" },
  { id: "fitness", label: "Fitness" },
  { id: "beauty", label: "Beauté" },
  { id: "tech", label: "Tech" },
  { id: "home", label: "Maison" },
  { id: "fashion", label: "Mode" },
  { id: "general", label: "Général" },
] as const

export const PRODUCT_REQUEST_COUNTRIES = [
  "FR",
  "US",
  "DE",
  "ES",
  "IT",
  "JP",
  "SA",
  "AE",
  "BR",
  "GB",
  "CA",
  "KR",
  "SG",
  "MX",
] as const

export function formatRequestRelativeFr(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

export function serializeProductRequest(row: {
  id: string
  resellerId: string
  resellerEmail: string
  title: string
  description: string | null
  category: string
  quantity: number
  targetPrice: number | null
  country: string
  imageUrl: string | null
  status: string
  quotesCount: number
  deliverySLA: number | null
  deliveryPriority: string
  createdAt: Date
}): ProductRequestDto {
  return {
    id: row.id,
    resellerId: row.resellerId,
    resellerEmail: row.resellerEmail,
    title: row.title,
    description: row.description,
    category: row.category,
    quantity: row.quantity,
    targetPrice: row.targetPrice,
    country: row.country,
    imageUrl: row.imageUrl,
    status: row.status,
    quotesCount: row.quotesCount,
    deliverySLA: row.deliverySLA,
    deliveryPriority: row.deliveryPriority,
    createdAt: row.createdAt.toISOString(),
  }
}

export function serializeProductQuote(row: {
  id: string
  requestId: string
  supplierId: string
  supplierName: string | null
  supplierEmail: string | null
  price: number
  moq: number
  deliveryDays: number
  message: string | null
  status: string
  createdAt: Date
}): ProductQuoteDto {
  return {
    id: row.id,
    requestId: row.requestId,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    supplierEmail: row.supplierEmail,
    price: row.price,
    moq: row.moq,
    deliveryDays: row.deliveryDays,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}
