import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { MarketplaceBuyerAuthForm } from "@/components/auth/marketplace-buyer-auth-form"
import { auth } from "@/auth"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { resolvePostLoginRedirect } from "@/lib/login-redirect"

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function CustomerLoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const callbackUrl = sanitizeInternalCallbackUrl(sp.callbackUrl)
  const session = await auth()
  const role = session?.user?.role

  if (session?.user?.id && role === "CUSTOMER") {
    redirect(resolvePostLoginRedirect("CUSTOMER", callbackUrl))
  }

  const t = await getTranslations("auth")

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">{t("loading")}</div>
      }
    >
      <MarketplaceBuyerAuthForm mode="login" />
    </Suspense>
  )
}
