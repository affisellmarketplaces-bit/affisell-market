import { redirect } from "next/navigation"

/** Alias court → wizard guidé (Sprint 6B). */
export default function SupplierGuidedAddProductPage() {
  redirect("/dashboard/supplier/products?guided=1")
}
