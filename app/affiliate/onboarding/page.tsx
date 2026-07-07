import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { AffiliateCguOnboardingForm } from "@/components/legal/affiliate-cgu-onboarding-form"
import { MerchantRoleTermsOnboardingForm } from "@/components/legal/merchant-role-terms-onboarding-form"
import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { AFFILIATE_FIRST_LISTING_HUB_HREF } from "@/lib/affiliate-onboarding-shared"
import { prisma } from "@/lib/prisma"
import { hasRoleTermsAccepted } from "@/lib/legal/role-terms"

export const dynamic = "force-dynamic"

export default async function AffiliateOnboardingPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login/affiliate")
  }
  if (session.user.role !== "AFFILIATE") {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cguAcceptedAt: true, termsAcceptedAt: true, termsAcceptedVersion: true },
  })

  const nextHref = AFFILIATE_FIRST_LISTING_HUB_HREF
  const t = await getTranslations("affiliateDashboard.onboarding")

  if (!user?.cguAcceptedAt) {
    return (
      <BentoShell>
        <BentoContainer maxWidth="4xl" className="py-12">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              {t("pageEyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{t("cguTitle")}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("cguBody")}</p>
          </div>
          <BentoCard className="mx-auto mt-8 max-w-md p-6">
            <AffiliateCguOnboardingForm nextHref="/affiliate/onboarding" />
          </BentoCard>
          <p className="mt-6 text-center text-sm text-zinc-500">
            <Link href="/signup/affiliate" className="text-violet-700 hover:underline dark:text-violet-300">
              {t("backSignup")}
            </Link>
          </p>
        </BentoContainer>
      </BentoShell>
    )
  }

  if (!hasRoleTermsAccepted(user.termsAcceptedVersion, "AFFILIATE")) {
    return (
      <BentoShell>
        <BentoContainer maxWidth="4xl" className="py-12">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              {t("pageEyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{t("cgsTitle")}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("cgsBody")}</p>
          </div>
          <BentoCard className="mx-auto mt-8 max-w-md p-6">
            <MerchantRoleTermsOnboardingForm role="AFFILIATE" nextHref={nextHref} />
          </BentoCard>
          <p className="mt-6 text-center text-sm text-zinc-500">
            <Link href="/conditions-affilie" className="text-violet-700 hover:underline dark:text-violet-300">
              {t("readCgs")}
            </Link>
          </p>
        </BentoContainer>
      </BentoShell>
    )
  }

  redirect(nextHref)
}
