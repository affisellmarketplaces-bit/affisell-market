import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { isRoleLegalDocAccepted } from "@/lib/legal/acceptance"

export default async function SupplierOnboardingRedirectPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/login")
  }

  if (await isRoleLegalDocAccepted(session.user.id, "SUPPLIER")) {
    redirect("/dashboard/supplier")
  }

  redirect("/supplier/onboarding")
}
