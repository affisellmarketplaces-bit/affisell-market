import { SupplierUpgradeRedirect } from "@/components/supplier-upgrade-redirect"

export default async function SupplierProductsUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>
}) {
  const { upgrade } = await searchParams
  return (
    <SupplierUpgradeRedirect upgrade={upgrade} redirectTo="/dashboard/supplier/products" />
  )
}
