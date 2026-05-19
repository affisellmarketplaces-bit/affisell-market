import { redirect } from "next/navigation"

import { auth } from "@/auth"

/** After signup, land on the creator dashboard — never on the raw marketplace catalog. */
export default async function AffiliateOnboardingPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login/affiliate")
  }
  if (session.user.role !== "AFFILIATE") {
    redirect("/login")
  }

  redirect("/dashboard/affiliate?welcome=1")
}
