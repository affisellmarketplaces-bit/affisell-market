import "server-only"
import { AFFISELL_AUTOBUY_SUPPLIER_EMAIL } from "@/lib/auto-buy-platform-supplier-shared"
import { computeTransferAmountsFromOrder, orderSplitInputFromOrder } from "@/lib/marketplace-split-amounts"
import { computeOrderEscrowAllocation, resolveOrderEscrowAllocation } from "@/lib/order-escrow-allocation"
import { isOrderClosedForPayout } from "@/lib/orders/payment-state"
import { prisma } from "@/lib/prisma"
import { aggregateOwedLegs, owedLegsForOrder, type OwedLeg } from "@/lib/transfers/owed-without-connect"

const MAX_ORDERS = 5_000

/**
 * READ-ONLY report (see `owed-without-connect.ts`): paid, open orders of the last `days` whose supplier or reseller has
 * no Connect destination and no transfer row. Bounded read; a truncated read is said, never extrapolated.
 */
export async function loadOwedWithoutConnect(days = 180) {
  const since = new Date(Date.now() - Math.max(1, days) * 86_400_000)
  const orders = await prisma.order.findMany({
    where: { paidAt: { gte: since } },
    orderBy: { paidAt: "desc" },
    take: MAX_ORDERS + 1,
    include: {
      supplier: { select: { id: true, email: true, stripeAccountId: true } },
      affiliate: { select: { id: true, stripeAccountId: true } },
      transferAttempts: { select: { role: true } },
    },
  })
  const truncated = orders.length > MAX_ORDERS
  const legs: OwedLeg[] = []
  for (const order of orders.slice(0, MAX_ORDERS)) {
    if (isOrderClosedForPayout(order)) continue
    const amounts = computeTransferAmountsFromOrder(orderSplitInputFromOrder(order, { firstSchedule: false }))
    const escrow =
      order.supplierMarginCents != null
        ? resolveOrderEscrowAllocation(order)
        : computeOrderEscrowAllocation({
            usesAffisellAutoBuy: order.usesAffisellAutoBuy,
            aeWholesaleCents: order.aeWholesaleCents,
            supplierPayoutCents: amounts.supplierPayoutCents,
          })
    legs.push(
      ...owedLegsForOrder({
        orderId: order.id,
        paidAt: order.paidAt,
        supplierId: order.supplierId,
        affiliateId: order.affiliateId,
        supplierHasConnect: Boolean(order.supplier.stripeAccountId?.trim()),
        affiliateHasConnect: Boolean(order.affiliateStripeAccountId?.trim() || order.affiliate?.stripeAccountId?.trim()),
        supplierIsPlatform: order.supplier.email === AFFISELL_AUTOBUY_SUPPLIER_EMAIL,
        plannedSupplierCents: amounts.supplierPayoutCents > 0 ? escrow.supplierMarginCents : 0,
        plannedAffiliateCents: amounts.affiliateTransferCents,
        attemptRoles: order.transferAttempts.map((a) => a.role),
      })
    )
  }
  return {
    ...aggregateOwedLegs(legs),
    ordersRead: Math.min(orders.length, MAX_ORDERS),
    truncated,
    windowDays: days,
    note: "Lecture seule — montants planifiés par la répartition, avant remboursements partiels ; rien n'est versé ni reprogrammé.",
  }
}
