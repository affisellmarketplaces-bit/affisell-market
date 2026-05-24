import { formatOrderNumber } from "@/lib/admin/orders/list-query"
import {
  deriveSplitDisplayStatus,
  needsOnboardingFromAttempts,
} from "@/lib/admin/splits/derive-split-status"
import type { AdminSplitRow, LoadAdminSplitsOptions } from "@/lib/admin/splits/types"
import { prisma } from "@/lib/prisma"

const MS_PER_DAY = 86_400_000

export async function loadAdminSplits(options: LoadAdminSplitsOptions = {}): Promise<AdminSplitRow[]> {
  const take = options.take ?? 200
  const to = options.to ?? new Date()
  const from = options.from ?? new Date(to.getTime() - 14 * MS_PER_DAY)

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      transferAttempts: { some: {} },
    },
    include: {
      transferAttempts: {
        orderBy: { role: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  })

  const rows: AdminSplitRow[] = orders.map((order) => {
    const supplier = order.transferAttempts.find((a) => a.role === "SUPPLIER")
    const affiliate = order.transferAttempts.find((a) => a.role === "AFFILIATE")
    const splitStatus = deriveSplitDisplayStatus(order.transferAttempts)
    const onboarding = needsOnboardingFromAttempts(order.transferAttempts)

    const mapCell = (a: (typeof order.transferAttempts)[number]) => ({
      role: a.role,
      amountCents: a.amountCents,
      status: a.status,
      errorCode: a.errorCode,
      destination: a.destination,
      stripeTransferId: a.stripeTransferId,
      attempts: a.attempts,
    })

    return {
      orderId: order.id,
      orderNumber: formatOrderNumber(order.id),
      createdAt: order.createdAt.toISOString(),
      totalCents: order.totalCents ?? order.sellingPriceCents,
      affisellFeeCents: order.affisellFeeCents ?? 0,
      splitStatus,
      supplier: supplier ? mapCell(supplier) : null,
      affiliate: affiliate ? mapCell(affiliate) : null,
      needsOnboarding: onboarding.needs,
      onboardingAccountId: onboarding.accountId,
    }
  })

  if (options.status && options.status !== "all") {
    return rows.filter((r) => r.splitStatus === options.status)
  }

  return rows
}
