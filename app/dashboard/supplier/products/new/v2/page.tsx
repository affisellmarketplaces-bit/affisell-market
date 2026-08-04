import { redirect } from "next/navigation"

/** Deep link alias → wizard v2 Express (InstantScan retired). */
export default function SupplierNewProductV2AliasPage() {
  redirect("/dashboard/supplier/products/new?wizard=v2&mode=express&compose=1")
}
