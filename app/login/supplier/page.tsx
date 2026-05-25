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

export default async function SupplierLoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const callbackUrl = sanitizeInternalCallbackUrl(sp.callbackUrl)
  const session = await auth()
  const role = session?.user?.role

  if (session?.user?.id) {
    if (role === "SUPPLIER") {
      redirect(resolvePostLoginRedirect("SUPPLIER", callbackUrl))
    }
    if (role === "AFFILIATE") {
      redirect("/dashboard/affiliate")
    }
    if (role === "CUSTOMER") {
      redirect("/shops")
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
