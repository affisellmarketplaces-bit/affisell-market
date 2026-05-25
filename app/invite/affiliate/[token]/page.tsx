import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AffiliateInvitationLanding } from "@/components/invite/affiliate-invitation-landing"
import {
  loadPublicAffiliateInvitation,
  recordAffiliateInvitationView,
} from "@/lib/supplier-affiliate-invitation"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { token } = await params
    const invite = await loadPublicAffiliateInvitation(token)
    if (!invite) return { title: "Invitation introuvable · Affisell" }
    return {
      title: `${invite.supplier.name} vous invite · Affisell`,
      description: invite.headline,
      openGraph: {
        title: invite.headline,
        description: invite.personalMessage.slice(0, 160) || invite.headline,
      },
    }
  } catch {
    return { title: "Invitation affilié · Affisell" }
  }
}

export default async function AffiliateInvitePage({ params }: Props) {
  const { token } = await params
  const invite = await loadPublicAffiliateInvitation(token)
  if (!invite) notFound()

  await recordAffiliateInvitationView(token).catch(() => {})

  return <AffiliateInvitationLanding invite={invite} />
}
