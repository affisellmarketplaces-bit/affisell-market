import { SupplierUpgradeRedirect } from "@/components/supplier-upgrade-redirect"

export default async function SupplierDashboardUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; session_id?: string }>
}) {
  const { upgrade, session_id: sessionId } = await searchParams
  return (
    <SupplierUpgradeRedirect
      upgrade={upgrade}
      sessionId={sessionId}
      redirectTo="/dashboard/supplier"
    />
  )
}
