"use client"

import { useRouter } from "next/navigation"

import { SupplierProductForm } from "@/components/supplier-product-form"

export function NewSupplierProductClient() {
  const router = useRouter()
  return (
    <SupplierProductForm
      resetKey="new-page"
      initial={null}
      onSuccess={() => router.push("/dashboard/supplier")}
      submitLabelCreate="Create product"
    />
  )
}
