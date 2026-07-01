import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Clock, ShieldCheck } from "lucide-react"

import { auth } from "@/auth"
import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { MerchantLegalProfileSubmitForm } from "@/components/merchant/merchant-legal-profile-submit-form"
import {
  loadAffiliateFirstSaleProgress,
  loadSupplierFirstSaleProgress,
} from "@/lib/merchant-first-sale-progress"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function MerchantVerificationPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }
  const role = session.user.role
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    redirect("/")
  }

  const t = await getTranslations("auth.merchantLegal.verification")
  const profile = await prisma.merchantLegalProfile.findUnique({
    where: { userId: session.user.id },
    select: { verificationStatus: true, legalStatus: true, submittedAt: true, rejectionReason: true },
  })

  if (!profile) {
    const dashHref = role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate"
    return (
      <BentoShell>
        <BentoContainer maxWidth="4xl" className="py-12">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              <ShieldCheck className="size-4" aria-hidden />
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {t("setupTitle")}
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">{t("setupSubtitle")}</p>
          </div>
          <div className="mt-8">
            <MerchantLegalProfileSubmitForm role={role} />
          </div>
          <p className="mt-6 text-center text-sm text-zinc-500">
            <Link href={dashHref} className="font-medium text-violet-700 hover:underline dark:text-violet-300">
              {t("dashboardLink")}
            </Link>
          </p>
        </BentoContainer>
      </BentoShell>
    )
  }

  if (profile.verificationStatus === "APPROVED") {
    if (role === "SUPPLIER") {
      const store = await prisma.store.findUnique({
        where: { userId: session.user.id },
        select: { slug: true },
      })
      const progress = await loadSupplierFirstSaleProgress(session.user.id, store?.slug ?? null)
      redirect(progress.postKycHref)
    }
    const progress = await loadAffiliateFirstSaleProgress(session.user.id)
    redirect(progress.postKycHref)
  }

  const statusTone =
    profile.verificationStatus === "REJECTED"
      ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
      : "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/40"

  const dashHref = role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate"

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            <ShieldCheck className="size-4" aria-hidden />
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        </div>

        <BentoCard className={cn("mx-auto mt-8 max-w-xl p-6", statusTone)}>
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <Clock className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                {t(`status_${profile.verificationStatus}`)}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {t("legalStatus")}: {profile.legalStatus.replace(/_/g, " ")}
              </p>
              {profile.rejectionReason ? (
                <p className="mt-3 rounded-lg border border-rose-200/80 bg-white/60 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-zinc-950/60 dark:text-rose-200">
                  {profile.rejectionReason}
                </p>
              ) : null}
              <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">{t("body")}</p>
              <Link
                href={dashHref}
                className="mt-4 inline-block text-sm font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                {t("dashboardLink")}
              </Link>
            </div>
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
