import Link from "next/link"
import { redirect } from "next/navigation"

import { SocialSettingsForm, type SerializedStoreSocial } from "@/components/social-settings-form"
import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function DashboardSocialSettingsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/settings/social")
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    redirect("/marketplace")
  }

  const backHref = role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate"
  const storeHref = role === "SUPPLIER" ? "/dashboard/supplier/settings/store" : "/dashboard/affiliate/settings/store"

  const userId = session.user.id
  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!u) redirect("/login")
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  const initialStore = JSON.parse(JSON.stringify(store)) as SerializedStoreSocial

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-8">
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href={backHref} className="font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400">
          ← Dashboard
        </Link>
        <Link href={storeHref} className="font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400">
          Store profile
        </Link>
      </nav>
      <h1 className="mt-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Social &amp; Community Hub</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Connect accounts, showcase follower milestones, and keep your public store in sync—English UI only.
      </p>
      <div className="mt-8">
        <SocialSettingsForm key={String(store.updatedAt)} initialStore={initialStore} />
      </div>
    </main>
  )
}
