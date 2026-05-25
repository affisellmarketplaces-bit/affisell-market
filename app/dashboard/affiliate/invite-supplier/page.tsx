import { redirect } from "next/navigation"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierInvitationStudio } from "@/components/affiliate/supplier-invitation-studio"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AffiliateInviteSupplierPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/affiliate?callbackUrl=/dashboard/affiliate/invite-supplier")
  if (session.user.role !== "AFFILIATE") redirect("/dashboard/affiliate")

  const store = await prisma.store.findUnique({
    where: { userId: session.user.id },
    select: { name: true },
  })
  const affiliateDisplayName =
    store?.name?.trim() || session.user.name?.trim() || session.user.email?.split("@")[0] || "Affilié"

  return (
    <BentoShell className="bg-zinc-50/50 dark:bg-zinc-950">
      <BentoContainer maxWidth="6xl">
        <SupplierInvitationStudio affiliateDisplayName={affiliateDisplayName} />
      </BentoContainer>
    </BentoShell>
  )
}
