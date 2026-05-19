"use client"

import { useEffect, useState } from "react"

import { PREVIEW_AS_CUSTOMER_STORAGE_KEY } from "@/lib/product-card-view"

export function usePreviewAsCustomer(): boolean {
  const [previewAsCustomer, setPreviewAsCustomer] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const read = () => {
      try {
        setPreviewAsCustomer(window.sessionStorage.getItem(PREVIEW_AS_CUSTOMER_STORAGE_KEY) === "1")
      } catch {
        setPreviewAsCustomer(false)
      }
    }
    read()
    window.addEventListener("storage", read)
    window.addEventListener("affisell:preview-as-customer", read)
    return () => {
      window.removeEventListener("storage", read)
      window.removeEventListener("affisell:preview-as-customer", read)
    }
  }, [])

  return previewAsCustomer
}
