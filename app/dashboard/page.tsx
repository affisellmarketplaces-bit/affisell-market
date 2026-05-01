import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function DashboardRootPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")

  redirect("/dashboard/affiliate")
}
