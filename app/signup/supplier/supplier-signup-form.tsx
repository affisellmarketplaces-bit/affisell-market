"use client"

import { useSearchParams } from "next/navigation"

import { MerchantLegalSignupWizard } from "@/components/auth/merchant-legal-signup-wizard"
import { normalizeSupplierInviteToken } from "@/lib/supplier-invitation-token"

export function SupplierSignupForm() {
  const searchParams = useSearchParams()
  const inviteToken =
    normalizeSupplierInviteToken(searchParams.get("invite") ?? "") ??
    normalizeSupplierInviteToken(searchParams.get("token") ?? "")

  const afterLogin = inviteToken
    ? "/dashboard/supplier/products/new?fromInvite=1&compose=1"
    : "/dashboard/verification"

  return (
    <MerchantLegalSignupWizard
      role="SUPPLIER"
      accent="emerald"
      afterLoginPath={afterLogin}
      inviteToken={inviteToken}
      inviteBanner={
        inviteToken ? "Inscription liée à une invitation partenaire Affisell." : null
      }
    />
  )
}
