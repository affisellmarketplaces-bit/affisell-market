import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Package, Store } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { auth } from "@/auth"
import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"
import { affiliateResellerOnboardingEntryHref } from "@/lib/affiliate-onboarding-shared"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sellPage.meta")
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
  }
}

export default async function SellHubPage() {
  const t = await getTranslations("sellPage")
  const session = await auth()
  const isAffiliate = String(session?.user?.role ?? "").toUpperCase() === "AFFILIATE"
  const onboardingHref = affiliateResellerOnboardingEntryHref(isAffiliate)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-10 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <div className="grid gap-5 md:grid-cols-2">
          <BentoCard className="flex h-full flex-col gap-4 border-violet-200/80 p-6 dark:border-violet-900/40">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Store className="size-6" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t("resellerTitle")}</h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("resellerBody")}</p>
            <div className="mt-auto flex flex-wrap gap-3">
              <Link
                href={onboardingHref}
                className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex gap-2")}
              >
                {t("resellerStartCta")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={AFFILIATE_CATALOG_PATH}
                className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
              >
                {t("resellerCatalogCta")}
              </Link>
              <Link href="/sell/affiliate-program" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
                {t("resellerProgramCta")}
              </Link>
            </div>
          </BentoCard>

          <BentoCard className="flex h-full flex-col gap-4 border-teal-200/80 p-6 dark:border-teal-900/40">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300">
              <Package className="size-6" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t("supplierTitle")}</h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("supplierBody")}</p>
            <div className="mt-auto flex flex-wrap gap-3">
              <Link
                href="/signup/supplier"
                className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex gap-2 bg-teal-700 hover:bg-teal-800")}
              >
                {t("supplierCta")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/sell/become-supplier" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
                {t("supplierFrameworkCta")}
              </Link>
            </div>
          </BentoCard>
        </div>

        <p className="text-center text-sm text-zinc-500">
          <Link href="/how-it-works" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
            {t("howItWorks")}
          </Link>
        </p>
      </BentoContainer>
    </BentoShell>
  )
}
