import Link from "next/link"
import { CalendarCheck } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierBookingRosterPanel } from "@/components/supplier/supplier-booking-roster-panel"
import { buttonVariants } from "@/components/ui/button"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { countSupplierPendingBookingCheckIns } from "@/lib/supplier-booking-roster-payload"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierBookingsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/bookings")
  const pendingCount = await countSupplierPendingBookingCheckIns(session.user.id)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <BentoCard className="flex flex-wrap items-center justify-between gap-4 py-5 md:py-6">
          <Link
            href="/dashboard/supplier"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex w-full justify-center sm:w-auto")}
          >
            <CalendarCheck className="size-5" aria-hidden />
            Back to dashboard
          </Link>
          {pendingCount > 0 ? (
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200">
              {pendingCount} awaiting check-in
            </span>
          ) : null}
        </BentoCard>

        <BentoPageHeading
          eyebrow="Booking"
          title="Guest roster & check-in"
          description="Scan or paste a buyer pass to validate entry. See who booked each slot and mark arrivals."
        />

        <SupplierBookingRosterPanel />
      </BentoContainer>
    </BentoShell>
  )
}
