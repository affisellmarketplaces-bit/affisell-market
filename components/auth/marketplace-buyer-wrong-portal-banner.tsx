"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import { signupCustomerPath } from "@/lib/login-redirect"

type Props = {
  role: string
  callbackUrl: string
}

export function MarketplaceBuyerWrongPortalBanner({ role, callbackUrl }: Props) {
  const t = useTranslations("auth.marketplaceBuyer")

  const signOutHref = `/api/auth/signout?callbackUrl=${encodeURIComponent(
    `/login/customer?callbackUrl=${encodeURIComponent(callbackUrl)}`
  )}`

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">{t("wrongPortalTitle")}</p>
      <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
        {t("wrongPortalBody", { role })}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link href={signOutHref} className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
          {t("wrongPortalSignOut")}
        </Link>
        <Link href={signupCustomerPath(callbackUrl)} className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
          {t("signUpLink")}
        </Link>
      </div>
    </div>
  )
}
