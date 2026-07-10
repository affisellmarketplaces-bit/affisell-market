import { redirect } from "next/navigation"

/** Deep link alias → main new product route with wizard=v2 */
export default function SupplierNewProductV2AliasPage() {
  redirect("/dashboard/supplier/products/new?wizard=v2&compose=1")
}
