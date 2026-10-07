import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { SupplierComplianceProfileCard } from "@/components/supplier/supplier-compliance-profile-card"
import { requireSupplierSession } from "@/lib/dashboard-session"
import { getComplianceProfile } from "@/lib/listing-compliance/profile.server"

export const dynamic = "force-dynamic"

export default async function SupplierComplianceSettingsPage() {
  const session = await requireSupplierSession("/dashboard/supplier/settings/compliance")
  const { profile, available } = await getComplianceProfile(session.user.id)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl">
        <SupplierComplianceProfileCard initialProfile={profile} available={available} />
      </BentoContainer>
    </BentoShell>
  )
}
