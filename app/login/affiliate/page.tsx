import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { PortalSignInForm } from "@/components/auth/portal-sign-in-form"
import { auth } from "@/auth"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { resolvePostLoginRedirect } from "@/lib/login-redirect"

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function AffiliateLoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const callbackUrl = sanitizeInternalCallbackUrl(sp.callbackUrl)
  const session = await auth()
  const role = session?.user?.role

  if (session?.user?.id) {
    if (role === "AFFILIATE") {
      redirect(resolvePostLoginRedirect("AFFILIATE", callbackUrl))
    }
    if (role === "SUPPLIER") {
      redirect("/dashboard/supplier")
    }
    if (role === "CUSTOMER") {
      redirect(callbackUrl ?? "/shops")
    }
    if (role === "ADMIN") {
      redirect(resolvePostLoginRedirect("ADMIN", callbackUrl))
    }
  }

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
