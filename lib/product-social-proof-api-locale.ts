import { LOCALE_COOKIE } from "@/lib/i18n-locale"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
import { isEuMarket } from "@/lib/market-config"

/** Locale for product-social-proof API copy (last_sale_ago, etc.). */
export function resolveProductSocialProofApiLocale(
  request: Request,
  localeParam?: string | null
): "fr" | "en" {
  if (localeParam?.trim()) return resolveBinaryCopyLocale(localeParam.trim())

  const cookie = request.headers.get("cookie") ?? ""
  const cookieMatch = cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=(fr|en)(?:;|$)`))
  if (cookieMatch?.[1]) return resolveBinaryCopyLocale(cookieMatch[1])

  const accept = request.headers.get("accept-language")?.toLowerCase() ?? ""
  if (accept.includes("fr")) return "fr"

  return isEuMarket() ? "fr" : "en"
}
