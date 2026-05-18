import { Prisma } from "@prisma/client"

/** True when `value` is a Prisma `Decimal` instance (not serializable in RSC props). */
export function isPrismaDecimal(value: unknown): value is Prisma.Decimal {
  return Prisma.Decimal.isDecimal(value)
}

/** Coerce Prisma `Decimal`, number, or numeric string to `number | null`. */
export function decimalToNumber(value: unknown): number | null {
  if (value == null) return null
  if (isPrismaDecimal(value)) return value.toNumber()
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const PRODUCT_DECIMAL_KEYS = [
  "compareAt",
  "freeShippingThreshold",
  "shippingCost",
] as const

type ProductDecimalKey = (typeof PRODUCT_DECIMAL_KEYS)[number]

type ProductDecimalValues = {
  compareAt: number | null
  freeShippingThreshold: number | null
  shippingCost: number
}

/** Product row shape safe to pass into Client Components (Prisma `Decimal` → `number`). */
export type WithSerializedProductDecimals<T> = Omit<T, ProductDecimalKey> &
  Pick<ProductDecimalValues, Extract<ProductDecimalKey, keyof T>>

/** Shallow map of common `Product` decimal columns for Client Component props. */
export function serializeProductDecimalFields<T extends Record<string, unknown>>(
  row: T
): WithSerializedProductDecimals<T> {
  const out: Record<string, unknown> = { ...row }
  for (const key of PRODUCT_DECIMAL_KEYS) {
    if (!(key in out)) continue
    const raw = row[key]
    if (raw == null) {
      out[key] = null
      continue
    }
    if (isPrismaDecimal(raw) || typeof raw === "string" || typeof raw === "number") {
      out[key] = key === "shippingCost" ? decimalToNumber(raw) ?? 0 : decimalToNumber(raw)
    }
  }
  return out as WithSerializedProductDecimals<T>
}

function walkForClient(value: unknown): unknown {
  if (value == null) return value
  if (isPrismaDecimal(value)) return value.toNumber()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(walkForClient)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = walkForClient(child)
    }
    return out
  }
  return value
}

/** Deep clone: `Decimal` → number, `Date` → ISO string (safe for RSC → client props). */
export function serializeForClient<T>(value: T): T {
  return walkForClient(value) as T
}

export type { ProductDecimalKey }
