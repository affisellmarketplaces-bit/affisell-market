import { redirect } from "next/navigation"
import { requireSupplierSession } from "@/lib/dashboard-session"

import { MerchantBrandStudio } from "@/components/storefront/merchant-brand-studio"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierStorefrontPage() {
  const session = await requireSupplierSession("/dashboard/supplier/storefront")


  let store = await prisma.store.findUnique({
    where: { userId: session.user.id },
    select: { slug: true },
  })
  if (!store) {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    })
    if (u) {
      const created = await ensureMerchantStore({
        userId: session.user.id,
        email: u.email,
        displayName: u.name,
      })
      store = { slug: created.slug }
    }
  }
  if (!store?.slug) redirect("/dashboard/supplier")
  const previewHref = `/store/supplier/${encodeURIComponent(store.slug)}`

  return (
    <MerchantBrandStudio
      role="SUPPLIER"
      previewHref={previewHref}
      profileHref="/dashboard/supplier/settings/store"
      profileLabel="Store profile"
    />
  )
}
