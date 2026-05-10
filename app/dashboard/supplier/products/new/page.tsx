import { Suspense } from "react"

import { SupplierProductsNewShell } from "@/components/supplier/supplier-products-new-shell"

export default function SupplierNewProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-50 to-white px-4 py-20 dark:from-zinc-950 dark:to-zinc-900">
          <div className="h-8 w-8 animate-pulse rounded-full bg-teal-200/80 dark:bg-teal-900/50" />
          <p className="text-sm font-medium text-zinc-500">Loading…</p>
        </div>
      }
    >
      <SupplierProductsNewShell />
    </Suspense>
  )
}
