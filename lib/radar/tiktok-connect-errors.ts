/** User-facing copy for TikTok Shop OAuth failures on /radar/connect. */

import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

export type TikTokConnectErrorCopy = {
  title: string
  body: string
  steps: string[]
}

/**
 * Map OAuth / Partner error codes to actionable guidance.
 * "No shop available" with is_draft=true is the Partner draft whitelist — not an Affisell bug.
 */
export function resolveTikTokConnectError(
  error: string | null,
  locale: AppLocale = "fr"
): TikTokConnectErrorCopy | null {
  if (!error?.trim()) return null
  const key = error.trim().toLowerCase()
  const t = (k: string) => tMessage(locale, `radarConnect.${k}`)

  if (
    key === "no_shop" ||
    key === "no_shop_available" ||
    key.includes("no_available_shop") ||
    key.includes("shop_not_available") ||
    key === "access_denied"
  ) {
    return {
      title: t("errNoShopTitle"),
      body: t("errNoShopBody"),
      steps: [t("errNoShopStep1"), t("errNoShopStep2"), t("errNoShopStep3"), t("errNoShopStep4")],
    }
  }

  if (key === "redis_not_configured") {
    return {
      title: t("errRedisTitle"),
      body: t("errRedisBody"),
      steps: [t("errRedisStep1"), t("errRedisStep2")],
    }
  }

  if (key === "oauth_start") {
    return {
      title: t("errStartTitle"),
      body: t("errStartBody"),
      steps: [t("errStartStep1"), t("errStartStep2")],
    }
  }

  return {
    title: t("errGenericTitle"),
    body: t("errGenericBody").replace("{code}", error),
    steps: [t("errGenericStep1"), t("errGenericStep2")],
  }
}
