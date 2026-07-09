import { redirect } from "next/navigation"
import { requireAffiliateSession } from "@/lib/dashboard-session"

import { MerchantBrandStudio } from "@/components/storefront/merchant-brand-studio"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AffiliateBrandStudioPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/brand-studio")


  let store: { slug: string } | null = null
  try {
    store = await prisma.store.findUnique({
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
  } catch (error) {
    console.error("[affiliate/brand-studio] store lookup failed", error)
  }
  if (!store?.slug) redirect("/dashboard/affiliate")

  const previewHref = `/shops/${encodeURIComponent(store.slug)}?preview=affiliate`

  return (
    <MerchantBrandStudio
      role="AFFILIATE"
      previewHref={previewHref}
      profileHref="/dashboard/affiliate/settings/store"
      profileLabel="Store profile"
      studioPath="/dashboard/affiliate/brand-studio"
      createListingHref="/dashboard/affiliate?openCreate=1"
    />
  )
}
