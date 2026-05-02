import { Prisma } from "@prisma/client"

const WAREHOUSE_TYPES = new Set(["local", "regional", "international"])
const METHOD_KEYS = new Set(["standard", "express", "pickup"])
const EU_COUNTRIES = new Set(["FR", "DE", "ES", "IT"])

export type ParsedProductShipping = {
  shippingCountry: string | null
  warehouseType: string | null
  warehouseCity: string | null
  processingTime: number
  deliveryMin: number
  deliveryMax: number
  shippingMethods: string[]
  freeShippingThreshold: Prisma.Decimal | null
  shippingCost: Prisma.Decimal
}

function parseIntInRange(raw: unknown, fallback: number, min: number, max: number) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function parseSupplierProductShippingBody(body: Record<string, unknown>): ParsedProductShipping {
  const countryRaw = typeof body.shippingCountry === "string" ? body.shippingCountry.trim().toUpperCase() : ""
  const shippingCountry = countryRaw.length === 2 ? countryRaw : null

  const wtRaw = typeof body.warehouseType === "string" ? body.warehouseType.trim().toLowerCase() : ""
  const warehouseType = WAREHOUSE_TYPES.has(wtRaw) ? wtRaw : null

  const warehouseCity =
    typeof body.warehouseCity === "string" ? body.warehouseCity.trim().slice(0, 120) || null : null

  const processingTime = parseIntInRange(body.processingTime, 1, 1, 30)
  const deliveryMin = parseIntInRange(body.deliveryMin, 2, 1, 60)
  const deliveryMax = parseIntInRange(body.deliveryMax, 5, 1, 90)
  const dMin = Math.min(deliveryMin, deliveryMax)
  const dMax = Math.max(deliveryMin, deliveryMax)

  let shippingMethods: string[] = []
  if (Array.isArray(body.shippingMethods)) {
    shippingMethods = (body.shippingMethods as unknown[])
      .filter((x): x is string => typeof x === "string" && METHOD_KEYS.has(x))
      .slice(0, 6)
  }
  if (shippingMethods.length === 0) {
    shippingMethods = ["standard"]
  }

  let freeShippingThreshold: Prisma.Decimal | null = null
  const fst = body.freeShippingThresholdEUR ?? body.freeShippingThreshold
  if (fst != null && fst !== "") {
    const n = Number(fst)
    if (Number.isFinite(n) && n > 0) {
      freeShippingThreshold = new Prisma.Decimal(n.toFixed(2))
    }
  }

  let shippingCost = new Prisma.Decimal(0)
  const sc = body.shippingCostEUR ?? body.shippingCost
  if (sc != null && sc !== "") {
    const n = Number(sc)
    if (Number.isFinite(n) && n >= 0) {
      shippingCost = new Prisma.Decimal(n.toFixed(2))
    }
  }

  return {
    shippingCountry,
    warehouseType,
    warehouseCity,
    processingTime,
    deliveryMin: dMin,
    deliveryMax: dMax,
    shippingMethods,
    freeShippingThreshold,
    shippingCost,
  }
}

export { EU_COUNTRIES }
