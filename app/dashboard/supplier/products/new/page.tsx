import { redirect } from "next/navigation"

/** Alias — full supplier product wizard lives at `/supplier/products/new`. */
export default function DashboardSupplierNewProductRedirect() {
  redirect("/supplier/products/new")
}
