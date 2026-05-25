import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export default async function SupplierOnboardingPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/login")
  }

  const invite = await prisma.affiliateSupplierInvitation.findUnique({
    where: { supplierId: session.user.id },
    select: { status: true },
  })

  if (invite && invite.status !== "CATALOG_LIVE") {
    redirect("/dashboard/supplier/products/new?fromInvite=1&compose=1")
  }

  redirect("/dashboard/supplier")
}
