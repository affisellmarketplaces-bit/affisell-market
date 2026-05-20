import { redirect } from "next/navigation"
import { setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"
import { auth } from "@/auth"
import { routing } from "@/i18n/routing"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ locale: string }> }

/** French home at `/fr`. English home is `app/page.tsx` at `/` — never redirect default locale to `/` (causes 307 loop on Vercel). */
export default async function LocaleHomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale === routing.defaultLocale ? routing.defaultLocale : locale)

  const session = await auth()
  if (session?.user?.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session?.user?.role === "AFFILIATE") redirect("/dashboard/affiliate")

  return <HomePage />
}
