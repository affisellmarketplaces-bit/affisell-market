import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"

export default async function AffiliateLoginPage() {
  const t = await getTranslations("auth")

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">{t("loading")}</div>
      }
    >
      <PortalSignInForm
        portal="AFFILIATE"
        title={t("portal.affiliate.title")}
        subtitle={t("portal.affiliate.subtitle")}
        defaultCallback="/dashboard/affiliate"
        signupHref="/signup/affiliate"
        signupLabel={t("portal.affiliate.signup")}
      />
    </Suspense>
  )
}
