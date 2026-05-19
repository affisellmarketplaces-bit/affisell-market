import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function SupplierOnboardingPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/login")
  }

  redirect("/dashboard/supplier")
}
