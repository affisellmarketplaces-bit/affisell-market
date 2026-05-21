import Link from "next/link"
import { redirect } from "next/navigation"

import { ProvidersTable } from "@/components/admin/providers-table"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminProvidersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/providers")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Fulfillment providers
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Auto-Order channels — test API health, seal credentials (AES-256-GCM), enable or disable.
            </p>
          </div>
          <Link href="/admin/providers/new" className={cn(buttonVariants({ variant: "bentoAccent" }))}>
            New provider
          </Link>
        </div>

        <ProvidersTable />
      </div>
    </main>
  )
}
