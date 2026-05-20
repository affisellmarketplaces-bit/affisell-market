import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"
import { auth } from "@/auth"
import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { routing } from "@/i18n/routing"

export const dynamic = "force-dynamic"

export default async function Page() {
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value ?? routing.defaultLocale)
  setRequestLocale(locale)

  const session = await auth()
  if (session?.user?.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session?.user?.role === "AFFILIATE") redirect("/dashboard/affiliate")

  return <HomePage />
}
