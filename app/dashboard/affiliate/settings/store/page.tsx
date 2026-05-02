import { redirect } from "next/navigation"

import { StoreProfileSettings } from "@/components/store-profile-settings"
import { auth } from "@/auth"

export default async function AffiliateStoreSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/affiliate/settings/store")
  }
  const role = (session.user as { role?: string }).role
  if (role !== "AFFILIATE") {
    redirect("/dashboard/affiliate")
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-8">
      <StoreProfileSettings backHref="/dashboard/affiliate" backLabel="Affiliate dashboard" />
    </main>
  )
}
