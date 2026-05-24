import { redirect } from "next/navigation"

import { StripeHealthPageClient } from "@/app/admin/stripe-health/stripe-health-page-client"
import { loadStripeHealthOrders } from "@/lib/admin/stripe-health/load-orders"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminStripeHealthPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/stripe-health")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const orders = await loadStripeHealthOrders({ days: 7 })

  const counts = {
    paid: orders.filter((o) => o.stripeHealthStatus === "paid").length,
    split_ok: orders.filter((o) => o.stripeHealthStatus === "split_ok").length,
    split_failed: orders.filter((o) => o.stripeHealthStatus === "split_failed").length,
    onboarding_required: orders.filter((o) => o.stripeHealthStatus === "onboarding_required").length,
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <StripeHealthPageClient initialOrders={orders} counts={counts} />
    </main>
  )
}
