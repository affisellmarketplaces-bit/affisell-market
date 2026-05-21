import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { CancelOrderDialog } from "@/components/admin/cancel-order-dialog"
import { OrderHeader } from "@/components/admin/order-header"
import { SupplierTimeline } from "@/components/admin/supplier-timeline"
import { auth } from "@/auth"
import { loadAdminOrderDetail } from "@/lib/admin/orders/load-order"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function AdminOrderPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/orders")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const { id } = await params
  const order = await loadAdminOrderDetail(id)
  if (!order) notFound()

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl p-8">
        <OrderHeader
          order={order}
          actions={
            <>
              <Link
                href="/admin/providers"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Fournisseurs
              </Link>
              <CancelOrderDialog
                orderId={order.id}
                supplierOrders={order.supplierFulfillmentOrders}
              />
            </>
          }
        />
        <SupplierTimeline orderId={order.id} supplierOrders={order.supplierFulfillmentOrders} />
      </div>
    </main>
  )
}
