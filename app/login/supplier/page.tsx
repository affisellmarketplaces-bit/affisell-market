import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"

export default async function SupplierLoginPage() {
  const t = await getTranslations("auth")

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">{t("loading")}</div>
      }
    >
      <PortalSignInForm
        portal="SUPPLIER"
        title={t("portal.supplier.title")}
        subtitle={t("portal.supplier.subtitle")}
        defaultCallback="/dashboard/supplier"
        signupHref="/signup/supplier"
        signupLabel={t("portal.supplier.signup")}
      />
    </Suspense>
  )
}
