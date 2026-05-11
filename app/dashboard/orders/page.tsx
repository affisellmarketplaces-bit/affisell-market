import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AccountOrdersClient } from "@/components/account/account-orders-client"
import { buttonVariants } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import {
  getActiveReturn,
  hasBlockingReturnHistory,
  orderReturnWindowEndsAt,
} from "@/lib/order-return-policy"
import { isTerminalReturnStatus } from "@/lib/order-return-types"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function DashboardOrdersPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/dashboard/orders")
  }

  const orders = await prisma.order.findMany({
    where: {
      customerEmail: { equals: session.user.email, mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, name: true, images: true } },
      returns: { orderBy: { createdAt: "desc" } },
    },
  })

  const now = new Date()
  const payload = orders.map((o) => {
    const active = getActiveReturn(o.returns)
    const latest = o.returns[0] ?? null
    return {
      id: o.id,
      createdAt: o.createdAt.toISOString(),
      quantity: o.quantity,
      sellingPriceCents: o.sellingPriceCents,
      status: o.status,
      product: {
        id: o.product.id,
        name: o.product.name,
        imageUrl: o.product.images[0] ?? null,
      },
      returnWindowEndsAt: orderReturnWindowEndsAt(o).toISOString(),
      returnEligible:
        o.status === "paid" && now <= orderReturnWindowEndsAt(o) && !hasBlockingReturnHistory(o.returns),
      activeReturn: active
        ? {
            id: active.id,
            status: active.status,
            reasonCode: active.reasonCode,
            createdAt: active.createdAt.toISOString(),
            sellerRespondByAt: active.sellerRespondByAt?.toISOString() ?? null,
            buyerTrackingCarrier: active.buyerTrackingCarrier,
            buyerTrackingNumber: active.buyerTrackingNumber,
          }
        : null,
      lastReturn: latest
        ? {
            id: latest.id,
            status: latest.status,
            createdAt: latest.createdAt.toISOString(),
            terminal: isTerminalReturnStatus(latest.status),
          }
        : null,
    }
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            My orders
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Request returns while your order is within the return window. After the seller approves,
            add tracking so they can confirm receipt and mark the refund as processed.
          </p>
        </div>
        <Link href="/marketplace" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Continue shopping
        </Link>
      </div>

      <AccountOrdersClient initialOrders={payload} className="mt-8" />
    </div>
  )
}
