import { redirect } from "next/navigation"
import { requireMerchantSession } from "@/lib/dashboard-session"


export const dynamic = "force-dynamic"

/** Legacy route — supplier catalog creation lives under `/dashboard/supplier/products/new`.
 *  IA catégorie : section Classification dans `components/supplier/supplier-add-product-form`.
 */
export default async function LegacyDashboardNewProductPage() {
  const session = await requireMerchantSession("/dashboard/products/new")
  if (session.user.role === "SUPPLIER") {
    redirect("/dashboard/supplier/products/new")
  }
  redirect("/dashboard")
}
