import { redirect } from "next/navigation"

import { auth } from "@/auth"

import { SupplierProductImport } from "@/components/supplier-product-import"

export default async function SupplierImportPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/supplier/import")
  if (session.user.role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/marketplace")

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SupplierProductImport />
    </main>
  )
}
