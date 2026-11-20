import { AutoFulfillPageClient } from "@/app/admin/auto-fulfill/auto-fulfill-page-client"
import { isAutoBuyDisabled } from "@/lib/fulfillment/auto-buy"

export const dynamic = "force-dynamic"

export default function AdminAutoFulfillPage() {
  // Server component: true when auto-buy is off (opt-in switch missing, or a kill switch is set).
  const killSwitch = isAutoBuyDisabled()
  return (
    <main className="min-h-screen bg-zinc-50/80 dark:bg-zinc-950">
      <AutoFulfillPageClient killSwitch={killSwitch} />
    </main>
  )
}
