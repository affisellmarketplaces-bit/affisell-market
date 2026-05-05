import { redirect } from "next/navigation"

import { SupplierStorefrontEditor } from "@/components/supplier-storefront-editor"
import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function SupplierStorefrontPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/supplier/storefront")
  if (session.user.role !== "SUPPLIER") redirect("/dashboard/supplier")

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
    <main className="min-h-screen bg-zinc-50">
      <SupplierStorefrontEditor previewHref={previewHref} />
    </main>
  )
}
