import { redirect } from "next/navigation"
import { requireSupplierSession } from "@/lib/dashboard-session"

import { BentoShell } from "@/components/affisell/bento-ui"

import { SupplierProductImport } from "@/components/supplier-product-import"

export default async function SupplierImportPage() {
  const session = await requireSupplierSession("/dashboard/supplier/import")


  return (
    <BentoShell>
      <SupplierProductImport />
    </BentoShell>
  )
}
