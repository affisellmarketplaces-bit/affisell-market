import { redirect } from "next/navigation"

import { OrdersPageClient } from "@/app/admin/orders/orders-page-client"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminOrdersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/orders")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <OrdersPageClient />
    </main>
  )
}
