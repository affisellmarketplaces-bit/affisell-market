import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierInvitationStudio } from "@/components/affiliate/supplier-invitation-studio"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function resolveAffiliateDisplayName(user: {
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
      "Affilié"
    )
  } catch (error) {
    console.error("[invite-supplier] store lookup failed", error)
    return user.name?.trim() || user.email?.split("@")[0] || "Affilié"
  }
}

export default async function AffiliateInviteSupplierPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/affiliate?callbackUrl=/dashboard/affiliate/invite-supplier")
  if (session.user.role !== "AFFILIATE") redirect("/dashboard/affiliate")

  const affiliateDisplayName = await resolveAffiliateDisplayName(session.user)

  return (
    <BentoShell className="bg-zinc-50/50 dark:bg-zinc-950">
      <BentoContainer maxWidth="6xl">
        <SupplierInvitationStudio affiliateDisplayName={affiliateDisplayName} />
      </BentoContainer>
    </BentoShell>
  )
}
