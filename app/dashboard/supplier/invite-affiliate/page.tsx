import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { AffiliateInvitationStudio } from "@/components/supplier/affiliate-invitation-studio"
import { safeAuth } from "@/lib/safe-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function resolveSupplierDisplayName(user: {
  id: string
  name?: string | null
  email?: string | null
}): Promise<string> {
  try {
    const store = await prisma.store.findUnique({
      where: { userId: user.id },
      select: { name: true },
    })
    return (
      store?.name?.trim() ||
      user.name?.trim() ||
      user.email?.split("@")[0] ||
      "Fournisseur"
    )
  } catch (error) {
    console.error("[invite-affiliate] store lookup failed", error)
    return user.name?.trim() || user.email?.split("@")[0] || "Fournisseur"
  }
}

export default async function SupplierInviteAffiliatePage() {
  const session = await safeAuth()
  if (!session?.user?.id) redirect("/login/supplier?callbackUrl=/dashboard/supplier/invite-affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/dashboard/supplier")

  const supplierDisplayName = await resolveSupplierDisplayName(session.user)

  return (
    <BentoShell className="bg-zinc-50/50 dark:bg-zinc-950">
      <BentoContainer maxWidth="6xl">
        <AffiliateInvitationStudio supplierDisplayName={supplierDisplayName} />
      </BentoContainer>
    </BentoShell>
  )
}
