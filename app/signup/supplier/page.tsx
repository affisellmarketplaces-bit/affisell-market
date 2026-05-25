import { Suspense } from "react"

import { SupplierSignupForm } from "@/app/signup/supplier/supplier-signup-form"

export default function SupplierSignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">Chargement…</div>}>
      <SupplierSignupForm />
    </Suspense>
  )
}
