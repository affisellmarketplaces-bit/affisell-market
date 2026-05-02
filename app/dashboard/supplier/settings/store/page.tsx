import { redirect } from "next/navigation"

import { StoreProfileSettings } from "@/components/store-profile-settings"
import { auth } from "@/auth"

export default async function SupplierStoreSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier/settings/store")
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER") {
    redirect("/dashboard/supplier")
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:px-8">
      <StoreProfileSettings backHref="/dashboard/supplier" backLabel="Supplier dashboard" />
    </main>
  )
}
