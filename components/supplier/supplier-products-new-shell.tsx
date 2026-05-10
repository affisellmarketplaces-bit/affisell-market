"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"
import { SupplierProductAddHub } from "@/components/supplier/supplier-product-add-hub"

export function SupplierProductsNewShell() {
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const compose = searchParams.get("compose") === "1"

  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    if (compose) setManualOpen(true)
  }, [compose])

  const showForm = Boolean(editId) || manualOpen

  if (!showForm) {
    return <SupplierProductAddHub onStartManual={() => setManualOpen(true)} />
  }

  return (
    <SupplierAddProductForm
      onBackToMethods={editId ? undefined : () => setManualOpen(false)}
    />
  )
}
