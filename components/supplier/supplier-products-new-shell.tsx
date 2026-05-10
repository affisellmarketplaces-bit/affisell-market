"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SupplierAddProductForm } from "@/components/supplier/supplier-add-product-form"
import { SupplierProductAddHub } from "@/components/supplier/supplier-product-add-hub"

export function SupplierProductsNewShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")?.trim() ?? ""
  const draftQs = searchParams.get("draft")?.trim() ?? ""
  const assistQs = searchParams.get("assist") === "1"
  const composeQs = searchParams.get("compose") === "1"

  const [manualOpen, setManualOpen] = useState(
    () => Boolean(editId) || assistQs || composeQs || Boolean(draftQs)
  )
  const [assistShortcuts, setAssistShortcuts] = useState(() => assistQs && !editId)

  useEffect(() => {
    if (editId) return
    if (assistQs) {
      setManualOpen(true)
      setAssistShortcuts(true)
    } else if (composeQs) {
      setManualOpen(true)
      setAssistShortcuts(false)
    }
    if (draftQs) {
      setManualOpen(true)
      if (!assistQs) setAssistShortcuts(false)
    }
  }, [editId, assistQs, composeQs, draftQs])

  const showForm = Boolean(editId) || manualOpen

  function goHub() {
    setManualOpen(false)
    setAssistShortcuts(false)
    router.replace("/dashboard/supplier/products/new", { scroll: false })
  }

  function startManualPure() {
    setAssistShortcuts(false)
    setManualOpen(true)
    router.replace("/dashboard/supplier/products/new?compose=1", { scroll: false })
  }

  function startWithAssist() {
    setAssistShortcuts(true)
    setManualOpen(true)
    router.replace("/dashboard/supplier/products/new?assist=1", { scroll: false })
  }

  if (!showForm) {
    return (
      <SupplierProductAddHub onStartManual={startManualPure} onStartWithAssist={startWithAssist} />
    )
  }

  return (
    <SupplierAddProductForm
      onBackToMethods={editId ? undefined : goHub}
      assistShortcuts={Boolean(assistShortcuts) && !editId}
    />
  )
}
