import { redirect } from "next/navigation"

import { UpgradeToast } from "@/components/upgrade-toast"

export default async function SupplierDashboardUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>
}) {
  const { upgrade } = await searchParams

  if (upgrade === "success") {
    return (
      <>
        <UpgradeToast upgrade="success" />
        <meta httpEquiv="refresh" content="2;url=/dashboard/supplier" />
        <p className="sr-only">Redirecting…</p>
      </>
    )
  }

  redirect("/dashboard/supplier")
}
