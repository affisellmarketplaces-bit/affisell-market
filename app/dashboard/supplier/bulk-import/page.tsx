import { redirect } from "next/navigation"
import { requireSupplierSession } from "@/lib/dashboard-session"

import { BentoShell } from "@/components/affisell/bento-ui"
import { SupplierBulkExcelImport } from "@/components/supplier/supplier-bulk-excel-import"

export default async function SupplierBulkImportPage() {
  const session = await requireSupplierSession("/dashboard/supplier/bulk-import")


  return (
    <BentoShell>
      <SupplierBulkExcelImport />
    </BentoShell>
  )
}
