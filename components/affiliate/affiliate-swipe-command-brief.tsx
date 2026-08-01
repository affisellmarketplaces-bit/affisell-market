"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { AffisellCoachBrief } from "@/components/affisell/affisell-coach-brief"

/** First-run Command Brief for affiliate swipe listing gestures. */
export function AffiliateSwipeCommandBrief() {
  const t = useTranslations("affiliate.swipeFeed.coach")
  const searchParams = useSearchParams()
  const force = searchParams.get("coach") === "1" || searchParams.get("onboarding") === "1"
  const suppress =
    searchParams.get("coach") === "0" || searchParams.get("e2eFixtures") === "1"

  return (
    <AffisellCoachBrief
      surface="affiliateSwipe"
      force={force}
      suppress={suppress}
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t("body")}
      cta={t("cta")}
      dismissLabel={t("dismiss")}
      testId="affiliate-swipe-command-brief"
    >
      <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2 text-[11px] leading-snug text-cyan-100/80">
        {t("contrast")}
      </p>
    </AffisellCoachBrief>
  )
}
