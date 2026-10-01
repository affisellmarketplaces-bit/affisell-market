"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { MerchantLegalSignupWizard } from "@/components/auth/merchant-legal-signup-wizard"
import { DROPFORGE_HREF } from "@/lib/affiliate-onboarding-shared"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { GROWTH_PRICING_TIERS, isGrowthPricingTierId } from "@/lib/growth-pricing-tiers"
import { normalizeSupplierInviteToken } from "@/lib/supplier-invitation-token"

export function SupplierSignupForm() {
  const t = useTranslations("auth.signupSupplier")
  const tAuth = useTranslations("auth")
  const searchParams = useSearchParams()
  const inviteToken =
    normalizeSupplierInviteToken(searchParams.get("invite") ?? "") ??
    normalizeSupplierInviteToken(searchParams.get("token") ?? "")

  const planParam = searchParams.get("plan")
  const tier = isGrowthPricingTierId(planParam) ? GROWTH_PRICING_TIERS[planParam] : null
  const planTier = tier?.role === "SUPPLIER" ? tier : null

  const safeNext = sanitizeInternalCallbackUrl(searchParams.get("next"))
  const afterLogin =
    safeNext?.startsWith(DROPFORGE_HREF) || safeNext?.startsWith("/import")
      ? safeNext
      : "/supplier/onboarding"

  return (
    <MerchantLegalSignupWizard
      role="SUPPLIER"
      accent="emerald"
      afterLoginPath={afterLogin}
      inviteToken={inviteToken}
      inviteBanner={inviteToken ? t("inviteBanner") : null}
      planBanner={planTier ? tAuth("planBanner", { plan: planTier.name, price: `${planTier.monthly}€` }) : null}
    />
  )
}
