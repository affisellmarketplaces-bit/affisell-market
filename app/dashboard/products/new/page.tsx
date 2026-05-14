import { redirect } from "next/navigation"

import { auth } from "@/auth"

export const dynamic = "force-dynamic"

/** Legacy route — supplier catalog creation lives under `/dashboard/supplier/products/new`.
 *  IA catégorie : voir `CategoryAutosuggest` sous le nom produit dans `components/supplier/supplier-add-product-form`.
 */
export default async function LegacyDashboardNewProductPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/products/new")
  }
  if (session.user.role === "SUPPLIER") {
    redirect("/dashboard/supplier/products/new")
  }
  redirect("/dashboard")
}
