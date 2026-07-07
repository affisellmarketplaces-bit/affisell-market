import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { SupplierSignupForm } from "@/app/signup/supplier/supplier-signup-form"

export default async function SupplierSignupPage() {
  const t = await getTranslations("auth")

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">{t("loading")}</div>
      }
    >
      <SupplierSignupForm />
    </Suspense>
  )
}
