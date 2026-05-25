import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SupplierInvitationLanding } from "@/components/invite/supplier-invitation-landing"
import {
  loadPublicSupplierInvitation,
  recordSupplierInvitationView,
} from "@/lib/supplier-invitation"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { token } = await params
    const invite = await loadPublicSupplierInvitation(token)
    if (!invite) return { title: "Invitation introuvable · Affisell" }
    return {
      title: `${invite.affiliate.name} vous invite · Affisell`,
      description: invite.headline,
      openGraph: {
        title: invite.headline,
        description: invite.personalMessage.slice(0, 160) || invite.headline,
      },
    }
  } catch {
    return { title: "Invitation fournisseur · Affisell" }
  }
}

export default async function SupplierInvitePage({ params }: Props) {
  const { token } = await params
  const invite = await loadPublicSupplierInvitation(token)
  if (!invite) notFound()

  await recordSupplierInvitationView(token).catch(() => {})

  return <SupplierInvitationLanding invite={invite} />
}
