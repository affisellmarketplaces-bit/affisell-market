"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { AffiliateExpressSignupWizard } from "@/components/auth/affiliate-express-signup-wizard"
import {
  AFFILIATE_FIRST_LISTING_HUB_HREF,
  AFFILIATE_URL_IMPORT_HREF,
} from "@/lib/affiliate-onboarding-shared"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { GROWTH_PRICING_TIERS, isGrowthPricingTierId } from "@/lib/growth-pricing-tiers"
import { parseGrowthBillingInterval } from "@/lib/stripe-growth-shared"

function AffiliateSignupInner() {
  const t = useTranslations("auth")
  const tPricing = useTranslations("pricingGrowth")
  const searchParams = useSearchParams()
  const nextRaw = searchParams.get("next")
  const safeNext = sanitizeInternalCallbackUrl(nextRaw)
  const afterLoginPath =
    safeNext?.startsWith(AFFILIATE_URL_IMPORT_HREF) || safeNext?.startsWith("/import")
      ? safeNext
      : safeNext || AFFILIATE_FIRST_LISTING_HUB_HREF

  const planParam = searchParams.get("plan")
  const tier = isGrowthPricingTierId(planParam) ? GROWTH_PRICING_TIERS[planParam] : null
  const planTier = tier?.role === "AFFILIATE" ? tier : null
  const interval = parseGrowthBillingInterval(searchParams.get("interval")) ?? "monthly"
  const price = interval === "annual" ? planTier?.annual : planTier?.monthly
  const period = interval === "annual" ? tPricing("perYear") : tPricing("perMonth")

  return (
    <AffiliateExpressSignupWizard
      afterLoginPath={afterLoginPath}
      planBanner={planTier ? t("planBanner", { plan: planTier.name, price: `${price}€`, period }) : null}
      growthPlan={planTier?.id ?? null}
      growthInterval={interval}
    />
  )
}

export default function AffiliateSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
          …
        </div>
      }
    >
      <AffiliateSignupInner />
    </Suspense>
  )
}
