import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
  AUTO_BUYING: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  AWAITING_SHIPMENT: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  SHIPPED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  DELIVERED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  FAILED: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  CANCELLED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
}

export default async function AdminFulfillmentPage() {
  const groups = await prisma.fulfillmentGroup.findMany({
    include: {
      items: {
        include: {
          order: {
            select: {
              id: true,
              customerEmail: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      supplierIntegration: { select: { provider: true, shopDomain: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })

  const failedCount = groups.filter((g) => g.status === "FAILED").length
  const awaitingCount = groups.filter((g) => g.status === "AWAITING_SHIPMENT").length

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-8 py-10">
        <BentoPageHeading
          eyebrow="Admin"
          title="Fulfillment orchestrator"
          description={`${groups.length} parcels · ${awaitingCount} awaiting shipment · ${failedCount} failed`}
        />

        <div className="space-y-3">
          {groups.map((group) => (
            <BentoCard key={group.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-xs text-muted-foreground">{group.id}</p>
                  <p className="font-medium">
                    {group.items.map((i) => i.order.product.name).join(" · ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Session {group.stripeSessionId.slice(-10)} · Supplier {group.supplierId.slice(-8)}
                    {group.externalOrderId ? ` · Ext #${group.externalOrderId}` : ""}
                  </p>
                  {group.error ? (
                    <p className="text-sm text-red-600 dark:text-red-400">{group.error}</p>
                  ) : null}
                  {group.trackingNumber ? (
                    <p className="text-sm">
                      {group.trackingCarrier} {group.trackingNumber}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    STATUS_CLASS[group.status] ?? STATUS_CLASS.PENDING
                  )}
                >
                  {group.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {group.items.map((item) => (
                  <Link
                    key={item.orderId}
                    href={`/admin/orders?q=${item.orderId}`}
                    className="text-violet-600 hover:underline dark:text-violet-400"
                  >
                    {item.order.customerEmail.slice(0, 20)}… · {item.orderId.slice(-6)}
                  </Link>
                ))}
                {group.status === "FAILED" ? (
                  <span className="text-muted-foreground">
                    Retry via PATCH /api/fulfillment/{group.id}/tracking
                  </span>
                ) : null}
              </div>
            </BentoCard>
          ))}
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
