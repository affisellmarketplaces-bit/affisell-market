import { redirect } from "next/navigation"

import { MerchantBrandStudio } from "@/components/storefront/merchant-brand-studio"
import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AffiliateBrandStudioPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/affiliate?callbackUrl=/dashboard/affiliate/brand-studio")
  }
  if (session.user.role !== "AFFILIATE") {
    redirect("/dashboard/affiliate")
  }

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
  if (!store?.slug) redirect("/dashboard/affiliate")

  const previewHref = `/shops/${encodeURIComponent(store.slug)}?preview=affiliate`

  return (
    <MerchantBrandStudio
      role="AFFILIATE"
      previewHref={previewHref}
      profileHref="/dashboard/affiliate/settings/store"
      profileLabel="Store profile"
    />
  )
}
