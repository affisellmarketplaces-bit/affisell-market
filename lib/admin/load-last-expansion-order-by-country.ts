import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { prisma } from "@/lib/prisma"

const PAID_STATUSES = ["paid", "shipped", "delivered", "completed", "preparing"] as const

export async function loadLastExpansionOrderIdForCountry(
  countryIso2: string
): Promise<string | null> {
  const orders = await prisma.order.findMany({
    where: { status: { in: [...PAID_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: 600,
    select: { id: true, shippingAddress: true },
  })

  for (const order of orders) {
    if (extractOrderShippingCountryIso2(order.shippingAddress) === countryIso2) {
      return order.id
    }
  }

  return null
}

export async function loadLastExpansionOrderIdsByCountry(
  countryIso2List: readonly string[]
): Promise<Map<string, string>> {
  if (countryIso2List.length === 0) return new Map()

  const targetSet = new Set(countryIso2List.map((code) => code.toLowerCase()))
  const orders = await prisma.order.findMany({
    where: { status: { in: [...PAID_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: 1200,
    select: { id: true, shippingAddress: true },
  })

  const map = new Map<string, string>()

  for (const order of orders) {
    const country = extractOrderShippingCountryIso2(order.shippingAddress)?.toLowerCase()
    if (!country || !targetSet.has(country) || map.has(country)) continue
    map.set(country, order.id)
  }

  return map
}
