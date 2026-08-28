import type { Metadata } from "next"

import { IngAdminBoundary } from "@/components/admin/ing-admin-boundary"
import { SecurityShieldDashboard } from "@/components/admin/security-shield-dashboard"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Humanoid Shield | Affisell Admin",
  robots: { index: false, follow: false },
}

export default function AdminSecurityPage() {
  return (
    <IngAdminBoundary>
      <div className="mx-auto max-w-6xl p-8">
        <SecurityShieldDashboard />
      </div>
    </IngAdminBoundary>
  )
}
