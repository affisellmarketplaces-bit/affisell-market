import prisma from "@/lib/prisma"

import { ForceReleaseHoldsButton } from "./force-release-button"

function truncateOrderId(id: string): string {
  if (id.length <= 10) return id
  return `${id.slice(0, 8)}…`
}

function formatDeliverableFr(at: Date | null): string {
  if (!at) return "—"
  return at.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function formatCountdown(deliverableAt: Date | null): string {
  if (!deliverableAt) return "—"
  const diffMs = deliverableAt.getTime() - Date.now()
  if (diffMs <= 0) return "Libérable"
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return `${days}j ${hours}h`
}

export default async function AdminHoldsPage() {
  const holds = await prisma.order.findMany({
    where: { status: "PAID" },
    orderBy: { deliverableAt: "asc" },
  })

  const orderIds = holds.map((h) => h.id)
  const userIds = [
    ...new Set(holds.map((h) => h.userId).filter((id): id is string => Boolean(id))),
  ]

  const [orderItems, buyers, affiliateSplits] = await Promise.all([
    orderIds.length
      ? prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          include: {
            product: { select: { title: true } },
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
    orderIds.length
      ? prisma.commissionSplit.findMany({
          where: {
            orderId: { in: orderIds },
            recipientType: "AFFILIATE",
          },
        })
      : Promise.resolve([]),
  ])

  const productLabelByOrderId = new Map<string, string>()
  for (const row of orderItems) {
    const title = row.product.title
    const prev = productLabelByOrderId.get(row.orderId)
    productLabelByOrderId.set(
      row.orderId,
      prev ? `${prev}, ${title}` : title
    )
  }

  const buyerEmailByUserId = new Map(
    buyers.map((u) => [u.id, u.email] as const)
  )

  const profileIds = [
    ...new Set(
      affiliateSplits
        .map((s) => s.recipientId)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const affiliateProfiles =
    profileIds.length > 0
      ? await prisma.affiliateProfile.findMany({
          where: { id: { in: profileIds } },
          select: {
            id: true,
            user: { select: { email: true } },
          },
        })
      : []

  const affiliateEmailByProfileId = new Map(
    affiliateProfiles.map((p) => [p.id, p.user.email] as const)
  )

  const affiliateEmailByOrderId = new Map<string, string>()
  for (const split of affiliateSplits) {
    if (!split.recipientId) continue
    const email = affiliateEmailByProfileId.get(split.recipientId)
    if (email) {
      affiliateEmailByOrderId.set(split.orderId, email)
    }
  }

  const money = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  })

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          HOLDs en cours ({holds.length})
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Commandes en statut PAID, triées par date de libération prévue.
        </p>
      </header>

      {holds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-muted-foreground">
          Aucun HOLD
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground dark:bg-muted/30">
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Acheteur</th>
                <th className="px-4 py-3 font-medium">Affilié</th>
                <th className="px-4 py-3 font-medium">DeliverableAt</th>
                <th className="px-4 py-3 font-medium">Compte à rebours</th>
                <th className="px-4 py-3 font-medium">Confirmation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {holds.map((order) => (
                <tr
                  key={order.id}
                  className="bg-card transition-colors hover:bg-muted/40 dark:hover:bg-muted/20"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {truncateOrderId(order.id)}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-foreground">
                    {productLabelByOrderId.get(order.id) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {money.format(order.total)}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                    {order.userId
                      ? (buyerEmailByUserId.get(order.userId) ?? "—")
                      : "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">
                    {affiliateEmailByOrderId.get(order.id) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDeliverableFr(order.deliverableAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {formatCountdown(order.deliverableAt)}
                  </td>
                  <td className="px-4 py-3">
                    {order.confirmedAt ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/30">
                        Confirmée (J+7)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-medium text-orange-900 ring-1 ring-inset ring-orange-600/25 dark:bg-orange-400/10 dark:text-orange-200 dark:ring-orange-400/30">
                        Non confirmée (J+10)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ForceReleaseHoldsButton />
    </main>
  )
}
