import { Suspense } from "react"
import { redirect } from "next/navigation"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { ReacceptTermsForm } from "@/components/legal/reaccept-terms-form"
import { auth } from "@/auth"
import { CURRENT_TERMS_VERSION, isRoleTermsVersionCurrent } from "@/lib/legal-versions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ReacceptTermsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const role = session.user.role
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    redirect("/")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { termsAcceptedVersion: true },
  })

  if (isRoleTermsVersionCurrent(role, user?.termsAcceptedVersion)) {
    redirect(role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate")
  }

  const currentVersion = CURRENT_TERMS_VERSION[role]

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Conformité légale
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            Acceptation des conditions mises à jour
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Re-consentement obligatoire avant accès à votre tableau de bord.
          </p>
        </div>
        <BentoCard className="mx-auto mt-8 max-w-md p-6">
          <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
            <ReacceptTermsForm
              role={role}
              previousVersion={user?.termsAcceptedVersion ?? null}
              currentVersion={currentVersion}
            />
          </Suspense>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
