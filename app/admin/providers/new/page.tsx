import { redirect } from "next/navigation"

import { ProviderForm } from "@/components/admin/provider-form"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminNewProviderPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/providers/new")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          New fulfillment provider
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Requires <code className="text-xs">AFFISELL_FULFILLMENT_SECRET</code> (min 24 chars) to seal API keys.
        </p>
        <ProviderForm mode="create" />
      </div>
    </main>
  )
}
