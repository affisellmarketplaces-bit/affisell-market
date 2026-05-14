import { redirect } from "next/navigation"

import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function DashboardOrdersPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/marketplace/account/orders")
  }
  const role = session.user.role
  if (role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (role === "SUPPLIER") redirect("/dashboard/supplier")
  redirect("/marketplace/account/orders")
}
