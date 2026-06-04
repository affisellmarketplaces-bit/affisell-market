import Link from "next/link"
import { redirect } from "next/navigation"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { MerchantRoleTermsOnboardingForm } from "@/components/legal/merchant-role-terms-onboarding-form"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasRoleTermsAccepted } from "@/lib/legal/role-terms"

export const dynamic = "force-dynamic"

export default async function SupplierOnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { termsAcceptedAt: true, termsAcceptedVersion: true },
  })

  const invite = await prisma.affiliateSupplierInvitation.findUnique({
    where: { supplierId: session.user.id },
    select: { status: true },
  })

  const nextAfterTerms =
    invite && invite.status !== "CATALOG_LIVE"
      ? "/dashboard/supplier/products/new?fromInvite=1&compose=1"
      : "/dashboard/verification"

  if (hasRoleTermsAccepted(user?.termsAcceptedVersion, "SUPPLIER")) {
    redirect(nextAfterTerms)
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Onboarding fournisseur
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">Acceptation des CGA</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Commission 12 %, SLA 72h, pénalités stock et payout J+2 — à valider avant l&apos;accès catalogue.
          </p>
        </div>
        <BentoCard className="mx-auto mt-8 max-w-md p-6">
          <MerchantRoleTermsOnboardingForm role="SUPPLIER" nextHref={nextAfterTerms} />
        </BentoCard>
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/signup/supplier" className="text-emerald-700 hover:underline dark:text-emerald-300">
            Retour à l&apos;inscription
          </Link>
        </p>
      </BentoContainer>
    </BentoShell>
  )
}
