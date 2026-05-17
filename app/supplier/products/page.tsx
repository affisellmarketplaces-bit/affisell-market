import { redirect } from "next/navigation"

import { UpgradeToast } from "@/components/upgrade-toast"

export default async function SupplierProductsUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>
}) {
  const { upgrade } = await searchParams

  if (upgrade === "cancelled") {
    return (
      <>
        <UpgradeToast upgrade="cancelled" />
        <meta httpEquiv="refresh" content="2;url=/dashboard/supplier/products" />
        <p className="sr-only">Redirecting…</p>
      </>
    )
  }

  redirect("/dashboard/supplier/products")
}
