import { redirect } from "next/navigation"

/** Alias — full supplier product wizard lives at `/supplier/dashboard`. */
export default function DashboardSupplierNewProductRedirect() {
  redirect("/supplier/dashboard")
}
