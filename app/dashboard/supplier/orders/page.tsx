import Link from "next/link"
import { redirect } from "next/navigation"
import { Package } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierOrdersPanel } from "@/components/supplier/supplier-orders-panel"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { countSupplierOrdersToShip } from "@/lib/supplier-orders-payload"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierOrdersPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/orders")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }

  const toShipCount = await countSupplierOrdersToShip(session.user.id)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <BentoCard className="flex flex-wrap items-center justify-between gap-4 py-5 md:py-6">
          <Link
            href="/dashboard/supplier"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex w-full justify-center sm:w-auto")}
          >
            <Package className="size-5" aria-hidden />
            Back to dashboard
          </Link>
          {toShipCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {toShipCount} awaiting shipment
            </span>
          ) : null}
        </BentoCard>

        <BentoPageHeading
          eyebrow="Fulfillment"
          title="Orders to ship"
          description="Stripe-confirmed marketplace orders land here instantly. Signal confidence while your team packs — buyers get alerted before tracking exists — then paste carrier details when the parcel scans out."
        />

        <SupplierOrdersPanel />
      </BentoContainer>
    </BentoShell>
  )
}
