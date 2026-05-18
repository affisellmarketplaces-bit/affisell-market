"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"
import { SupplierProductAddHub } from "@/components/supplier/supplier-product-add-hub"

/**
 * Single product listing flow by default (`?compose=1`).
 * Optional hub for bulk / assist entry points: `?hub=1`.
 */
export function SupplierProductsNewShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const draftQs = searchParams.get("draft")?.trim() ?? ""
  const assistQs = searchParams.get("assist") === "1"
  const hubQs = searchParams.get("hub") === "1"

  function goHub() {
    router.replace("/dashboard/supplier/products/new?hub=1", { scroll: false })
  }

  function startListing(assist: boolean) {
    const qs = assist ? "assist=1&compose=1" : "compose=1"
    const draft = draftQs ? `&draft=${encodeURIComponent(draftQs)}` : ""
    router.replace(`/dashboard/supplier/products/new?${qs}${draft}`, { scroll: false })
  }

  if (hubQs && !editId) {
    return (
      <SupplierProductAddHub
        onStartManual={() => startListing(false)}
        onStartWithAssist={() => startListing(true)}
      />
    )
  }

  return (
    <SupplierAddProductForm
      onBackToMethods={editId ? undefined : goHub}
      assistShortcuts={Boolean(assistQs) && !editId}
    />
  )
}
