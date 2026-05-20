import { redirect } from "next/navigation"
import { getLocale, setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function Page() {
  const locale = await getLocale()
  setRequestLocale(locale)

  const session = await auth()
  if (session?.user?.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session?.user?.role === "AFFILIATE") redirect("/dashboard/affiliate")

  return <HomePage />
}
