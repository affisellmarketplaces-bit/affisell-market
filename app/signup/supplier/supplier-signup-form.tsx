"use client"

import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { MerchantLegalSignupWizard } from "@/components/auth/merchant-legal-signup-wizard"
import { normalizeSupplierInviteToken } from "@/lib/supplier-invitation-token"

export function SupplierSignupForm() {
  const t = useTranslations("auth.signupSupplier")
  const searchParams = useSearchParams()
  const inviteToken =
    normalizeSupplierInviteToken(searchParams.get("invite") ?? "") ??
    normalizeSupplierInviteToken(searchParams.get("token") ?? "")

  const afterLogin = "/supplier/onboarding"

  return (
    <MerchantLegalSignupWizard
      role="SUPPLIER"
      accent="emerald"
      afterLoginPath={afterLogin}
      inviteToken={inviteToken}
      inviteBanner={inviteToken ? t("inviteBanner") : null}
    />
  )
}
