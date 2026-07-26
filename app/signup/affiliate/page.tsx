"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { MerchantLegalSignupWizard } from "@/components/auth/merchant-legal-signup-wizard"
import {
  AFFILIATE_FIRST_LISTING_HUB_HREF,
  AFFILIATE_URL_IMPORT_HREF,
} from "@/lib/affiliate-onboarding-shared"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"

function AffiliateSignupInner() {
  const searchParams = useSearchParams()
  const nextRaw = searchParams.get("next")
  const safeNext = sanitizeInternalCallbackUrl(nextRaw)
  const afterLoginPath =
    safeNext?.startsWith(AFFILIATE_URL_IMPORT_HREF) || safeNext?.startsWith("/import")
      ? safeNext
      : safeNext || AFFILIATE_FIRST_LISTING_HUB_HREF

  return (
    <MerchantLegalSignupWizard
      role="AFFILIATE"
      accent="violet"
      afterLoginPath={afterLoginPath}
      defaultSocialHandle
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
