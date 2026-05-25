import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { BentoShell } from "@/components/affisell/bento-ui"
import { SupplierExtensionConnect } from "@/components/supplier/supplier-extension-connect"
import { auth } from "@/auth"

export default async function SupplierExtensionPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/supplier?callbackUrl=/dashboard/supplier/extension")
  }
  if (session.user.role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/marketplace")

  return (
    <BentoShell>
      <div className="mx-auto max-w-2xl space-y-6 py-2">
        <Link
          href="/dashboard/supplier/import"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Retour à l’import
        </Link>
        <SupplierExtensionConnect />
      </div>
    </BentoShell>
  )
}
