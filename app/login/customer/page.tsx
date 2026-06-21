import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { MarketplaceBuyerAuthForm } from "@/components/auth/marketplace-buyer-auth-form"
import { MarketplaceBuyerWrongPortalBanner } from "@/components/auth/marketplace-buyer-wrong-portal-banner"
import { auth } from "@/auth"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import {
  MARKETPLACE_BUYER_ORDERS_PATH,
  resolvePostLoginRedirect,
} from "@/lib/login-redirect"

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function CustomerLoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const callbackUrl = sanitizeInternalCallbackUrl(sp.callbackUrl) ?? MARKETPLACE_BUYER_ORDERS_PATH
  const session = await auth()
  const role = session?.user?.role

  if (session?.user?.id && role === "CUSTOMER") {
    redirect(resolvePostLoginRedirect("CUSTOMER", callbackUrl))
  }

  const t = await getTranslations("auth")

  const wrongPortalRole =
    session?.user?.id && role && role !== "CUSTOMER" ? role : null

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">{t("loading")}</div>
      }
    >
      <div className="mx-auto w-full max-w-md px-4">
        {wrongPortalRole ? (
          <MarketplaceBuyerWrongPortalBanner role={wrongPortalRole} callbackUrl={callbackUrl} />
        ) : null}
        <MarketplaceBuyerAuthForm mode="login" defaultCallback={callbackUrl} />
      </div>
    </Suspense>
  )
}
