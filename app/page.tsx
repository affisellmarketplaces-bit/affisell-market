import { redirect } from "next/navigation"

import { PublicHome } from "@/components/home/PublicHome"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await auth()
  const role = session?.user?.role

  if (role === "SUPPLIER") {
    redirect("/dashboard/supplier")
  }

  if (role === "AFFILIATE") {
    redirect("/marketplace")
  }

  return <PublicHome />
}
