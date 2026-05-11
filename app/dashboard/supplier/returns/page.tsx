import Link from "next/link"
import { redirect } from "next/navigation"
import { Undo2 } from "lucide-react"

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/supplier"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2")}
        >
          <Undo2 className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Returns
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Review buyer requests, approve or reject within the SLA, then confirm when the parcel is back and
        when the refund has been issued.
      </p>

      <SupplierReturnsPanel className="mt-8" />
    </div>
  )
}
