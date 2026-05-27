import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import type { LoginPortal } from "@/lib/auth-login-portal"

type PageProps = {
  searchParams: Promise<{ portal?: string }>
}

function parsePortal(raw: string | undefined): LoginPortal | null {
  const v = raw?.trim().toUpperCase()
  if (v === "AFFILIATE" || v === "SUPPLIER") return v
  return null
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const portal = parsePortal(sp.portal)
  const t = await getTranslations("auth")

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">{t("loading")}</div>}>
      <ForgotPasswordForm portal={portal} />
    </Suspense>
  )
}
