import { redirect } from "next/navigation"

import { AFFILIATE_PAYOUT_SETTINGS_HREF } from "@/lib/affiliate-onboarding-shared"
import { FLAGS } from "@/lib/flags"

/** Legacy route — multi-payout lives on the main payout settings page. */
export default function AffiliatePayoutMethodsRedirectPage() {
  if (!FLAGS.AFFILIATE_MULTI_PAYOUT) {
    redirect(AFFILIATE_PAYOUT_SETTINGS_HREF)
  }
  redirect(`${AFFILIATE_PAYOUT_SETTINGS_HREF}#multi-payout`)
}
