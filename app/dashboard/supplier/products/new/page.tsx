import { Suspense } from "react"

import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"

export default function SupplierNewProductPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-500">Loading…</div>
      }
    >
      <SupplierAddProductForm />
    </Suspense>
  )
}
