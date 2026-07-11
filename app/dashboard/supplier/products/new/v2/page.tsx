import { redirect } from "next/navigation"

/** Deep link alias → wizard v2 (InstantScan mode = `mode=guided`, default). */
export default function SupplierNewProductV2AliasPage() {
  redirect("/dashboard/supplier/products/new?wizard=v2&compose=1")
}
