import { redirect } from "next/navigation"

import { auth } from "@/auth"

import { MarketplaceImportForm } from "./marketplace-import-form"

export const dynamic = "force-dynamic"

export default async function MarketplaceImportPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/admin?callbackUrl=/marketplace/import")
  }
  if ((session.user as { role?: string }).role !== "ADMIN") {
    redirect("/")
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50/80 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <MarketplaceImportForm />
    </main>
  )
}
