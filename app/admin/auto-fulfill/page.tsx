import { AutoFulfillPageClient } from "@/app/admin/auto-fulfill/auto-fulfill-page-client"

export const dynamic = "force-dynamic"

export default function AdminAutoFulfillPage() {
  const killSwitch = process.env.DISABLE_AUTO_BUY === "true"
  return (
    <main className="min-h-screen bg-zinc-50/80 dark:bg-zinc-950">
      <AutoFulfillPageClient killSwitch={killSwitch} />
    </main>
  )
}
