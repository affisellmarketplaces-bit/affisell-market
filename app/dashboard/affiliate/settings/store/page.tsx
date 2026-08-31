import { redirect } from "next/navigation"
import { requireAffiliateSession } from "@/lib/dashboard-session"

import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { StoreProfileSettings } from "@/components/store-profile-settings"
import Link from "next/link"
import { ArrowRight, Landmark } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import { AFFILIATE_PAYOUT_SETTINGS_HREF } from "@/lib/affiliate-onboarding-shared"
import { cn } from "@/lib/utils"

export default async function AffiliateStoreSettingsPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/settings/store")

  const role = (session.user as { role?: string }).role
  if (role !== "AFFILIATE") {
    redirect("/dashboard/affiliate")
  }

  const t = await getTranslations("affiliate.settings.payouts")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-6">
        <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 to-white p-5 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-zinc-950">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Landmark className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("storeCardTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("storeCardBody")}
              </p>
              <Link
                href={AFFILIATE_PAYOUT_SETTINGS_HREF}
                className={cn(buttonVariants({ size: "sm" }), "mt-3 gap-1.5 bg-violet-600 text-white hover:bg-violet-700")}
              >
                {t("storeCardCta")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        <StoreProfileSettings
          backHref="/dashboard/affiliate"
          backLabel="Affiliate dashboard"
          brandStudioHref="/dashboard/affiliate/brand-studio"
          brandStudioLabel="Brand Studio"
        />
      </BentoContainer>
    </BentoShell>
  )
}
