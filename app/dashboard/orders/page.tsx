import Link from "next/link"
import { redirect } from "next/navigation"
import { CreditCard, ShoppingBag } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
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
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <BentoCard className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <BentoPageHeading
            eyebrow="Purchases"
            title="My orders"
            description="Request returns while your order is within the return window. After the seller approves, add tracking so they can confirm receipt and mark the refund as processed."
            className="max-w-xl"
          />
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/dashboard/wallet"
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex justify-center")}
            >
              <CreditCard className="size-5" aria-hidden />
              Store credit
            </Link>
            <Link
              href="/marketplace"
              className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex justify-center")}
            >
              <ShoppingBag className="size-5" aria-hidden />
              Continue shopping
            </Link>
          </div>
        </BentoCard>

        <AccountOrdersClient initialOrders={payload} />
      </BentoContainer>
    </BentoShell>
  )
}
