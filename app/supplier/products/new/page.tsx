import { redirect } from "next/navigation"

/** Legacy URL — canonical supplier flow is under `/dashboard/supplier`. */
export default function LegacySupplierProductsNewPage() {
  redirect("/dashboard/supplier/products/new")
}
