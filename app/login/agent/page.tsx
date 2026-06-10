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

export default async function AgentLoginPage({ searchParams }: Props) {
  const sp = await searchParams
  const callbackUrl = sanitizeInternalCallbackUrl(sp.callbackUrl)
  const session = await auth()
  const role = session?.user?.role

  if (session?.user?.id) {
    if (role === "AGENT") {
      redirect(resolvePostLoginRedirect("AGENT", callbackUrl))
    }
    if (role === "SUPPLIER") redirect("/dashboard/supplier")
    if (role === "AFFILIATE") redirect("/dashboard/affiliate")
    if (role === "ADMIN") redirect("/admin/agents")
  }

  const t = await getTranslations("auth")

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">{t("loading")}</div>}>
      <PortalSignInForm
        portal="AGENT"
        title="Espace agent Affisell"
        subtitle="Contrôles qualité, conformité et relais express — missions assignées par le réseau."
        defaultCallback="/dashboard/agent"
        signupHref="/agents/apply"
        signupLabel="Candidater comme agent"
        showSocialSignIn={false}
      />
    </Suspense>
  )
}
