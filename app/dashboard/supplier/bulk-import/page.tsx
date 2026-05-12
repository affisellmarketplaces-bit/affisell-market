import { redirect } from "next/navigation"

import { BentoShell } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { SupplierBulkExcelImport } from "@/components/supplier/supplier-bulk-excel-import"

export default async function SupplierBulkImportPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/supplier/bulk-import")
  if (session.user.role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/marketplace")

  return (
    <BentoShell>
      <SupplierBulkExcelImport />
    </BentoShell>
  )
}
