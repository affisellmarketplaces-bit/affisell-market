import { redirect } from "next/navigation"

import { auth } from "@/auth"

import { SupplierDashboard } from "./supplier-dashboard"

export default async function SupplierDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/supplier")
  if (session.user.role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/marketplace")

  return <SupplierDashboard />
}
