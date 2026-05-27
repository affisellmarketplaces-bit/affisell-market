import Link from "next/link"
import { requireMerchantSession } from "@/lib/dashboard-session"
import { redirect } from "next/navigation"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { SocialSettingsForm, type SerializedStoreSocial } from "@/components/social-settings-form"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function DashboardSocialSettingsPage() {
  const session = await requireMerchantSession("/dashboard/settings/social")

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
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8">
        <nav className="flex flex-wrap gap-4 text-sm font-medium text-gray-600 dark:text-zinc-300">
          <Link href={backHref} className="text-[#7C3AED] underline-offset-4 hover:underline">
            ← Dashboard
          </Link>
          <Link href={storeHref} className="text-[#7C3AED] underline-offset-4 hover:underline">
            Store profile
          </Link>
        </nav>

        <BentoPageHeading
          eyebrow="Community"
          title="Social & Community Hub"
          description="Connect accounts, showcase follower milestones, and keep your public store in sync—English UI only."
        />

        <BentoCard className="p-0 md:p-0">
          <div className="p-6 md:p-8">
            <SocialSettingsForm key={String(store.updatedAt)} initialStore={initialStore} />
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
