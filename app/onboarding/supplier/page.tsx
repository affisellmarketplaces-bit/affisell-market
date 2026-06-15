import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { hasRoleTermsAccepted } from "@/lib/legal/role-terms"

export default async function SupplierOnboardingPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { termsAcceptedAt: true, termsAcceptedVersion: true },
  })

  if (hasRoleTermsAccepted(user?.termsAcceptedVersion, "SUPPLIER")) {
    redirect("/dashboard/supplier")
  }

  redirect("/supplier/onboarding")
}
