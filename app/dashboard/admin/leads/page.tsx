import type { Metadata } from "next"

import { AdminSupplierLeadsConsole } from "@/components/admin/admin-supplier-leads-console"
import { getLeadsByStatus, getSupplierLeadStats, serializeSupplierLead } from "@/lib/supplier-leads"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Supplier Leads | Affisell Admin",
  robots: { index: false, follow: false },
}

export default async function AdminSupplierLeadsPage() {
  const [leads, stats] = await Promise.all([getLeadsByStatus(), getSupplierLeadStats()])

  return (
    <AdminSupplierLeadsConsole
      initial={{
        leads: leads.map(serializeSupplierLead),
        stats,
      }}
    />
  )
}
