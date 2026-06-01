import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

type PageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const token = sp.token?.trim() ?? ""
  const t = await getTranslations("auth")

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">{t("loading")}</div>}>
      <ResetPasswordForm token={token} key={token || "empty"} />
    </Suspense>
  )
}
