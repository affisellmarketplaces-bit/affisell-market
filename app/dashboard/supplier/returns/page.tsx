import Link from "next/link"
import { redirect } from "next/navigation"
import { Undo2 } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { SupplierReturnsPanel } from "@/components/supplier/supplier-returns-panel"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function SupplierReturnsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/returns")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <BentoCard className="flex flex-wrap items-center justify-between gap-4 py-5 md:py-6">
          <Link
            href="/dashboard/supplier"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex w-full justify-center sm:w-auto")}
          >
            <Undo2 className="size-5" aria-hidden />
            Back to dashboard
          </Link>
        </BentoCard>

        <BentoPageHeading
          eyebrow="Post-purchase"
          title="Returns"
          description="Review buyer requests, approve or reject within the SLA, then confirm when the parcel is back and when the refund has been issued."
        />

        <SupplierReturnsPanel />
      </BentoContainer>
    </BentoShell>
  )
}
