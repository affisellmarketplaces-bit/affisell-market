import { redirect } from "next/navigation"
import { getLocale, setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"
import { safeAuth } from "@/lib/safe-auth"

export const dynamic = "force-dynamic"

export default async function Page() {
  const locale = await getLocale()
  setRequestLocale(locale)

  const session = await safeAuth()
  if (session?.user?.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session?.user?.role === "AFFILIATE") redirect("/dashboard/affiliate")

  return <HomePage />
}
