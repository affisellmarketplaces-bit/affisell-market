import { loadLastExpansionOrderIdForCountry } from "@/lib/admin/load-last-expansion-order-by-country"
import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export type ExpansionGraduationPreviewOrderContext = {
  orderId: string
  buyerEmail: string
  productTitle: string | null
  orderStatus: string
  orderedAt: string
}

export async function loadExpansionGraduationPreviewOrder(args: {
  countryIso2: string
  orderId?: string
  useSampleOrder?: boolean
  useLastOrder?: boolean
}): Promise<ExpansionGraduationPreviewOrderContext | null> {
  let orderId = args.orderId?.trim()

  if (!orderId && args.useSampleOrder) {
    const rollout = await prisma.checkoutCountryRollout.findUnique({
      where: {
        countryIso2_marketRegion: {
          countryIso2: args.countryIso2,
          marketRegion: MARKET_REGION,
        },
      },
      select: { firstOrderId: true },
    })
    orderId = rollout?.firstOrderId ?? undefined
  }

  if (!orderId && args.useLastOrder) {
    orderId = (await loadLastExpansionOrderIdForCountry(args.countryIso2)) ?? undefined
  }

  if (!orderId) return null

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerEmail: true,
      status: true,
      createdAt: true,
      shippingAddress: true,
      product: { select: { title: true } },
    },
  })

  if (!order) return null
  if (extractOrderShippingCountryIso2(order.shippingAddress) !== args.countryIso2) {
    return null
  }

  return {
    orderId: order.id,
    buyerEmail: order.customerEmail,
    productTitle: order.product?.title ?? null,
    orderStatus: order.status,
    orderedAt: order.createdAt.toISOString(),
  }
}
