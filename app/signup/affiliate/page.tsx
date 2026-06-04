"use client"

import { MerchantLegalSignupWizard } from "@/components/auth/merchant-legal-signup-wizard"

export default function AffiliateSignupPage() {
  return (
    <MerchantLegalSignupWizard
      role="AFFILIATE"
      accent="violet"
      afterLoginPath="/affiliate/onboarding"
      defaultSocialHandle
    />
  )
}
