import { ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { AppLink } from "@/components/i18n/app-link"
import {
  brandOrbitTrustStripLink,
  brandOrbitTrustStripShell,
  brandOrbitTrustStripShimmer,
  brandOrbitTrustStripText,
} from "@/lib/affisell-brand-orbit-shared"

/** Footer bookend — mirrors PublicNavTrustStrip for orbital brand consistency. */
export async function FooterOrbitTrustRibbon() {
  const t = await getTranslations("PublicNav")

  return (
    <div className={brandOrbitTrustStripShell} role="region" aria-label={t("trustStripText")}>
      <div className={brandOrbitTrustStripShimmer} aria-hidden />
      <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-2 px-3 py-2 sm:px-4">
        <p className={brandOrbitTrustStripText}>
          <ShieldCheck className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
          <span>{t("trustStripText")}</span>
          <AppLink href="/protected-checkout" className={brandOrbitTrustStripLink}>
            {t("trustStripCta")}
          </AppLink>
        </p>
      </div>
    </div>
  )
}
