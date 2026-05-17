import { redirect } from "next/navigation"

/** Legacy URL — canonical supplier video studio is under `/dashboard/supplier`. */
export default async function LegacySupplierProductVideoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/supplier/products/${encodeURIComponent(id)}`)
}
