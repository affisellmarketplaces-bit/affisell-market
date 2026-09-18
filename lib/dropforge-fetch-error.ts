import { tMessage } from "@/lib/i18n-pick-message"
import type { AppLocale } from "@/lib/i18n-locale"

/** Client-safe DropForge fetch error copy (no Prisma). */
export function dropforgeHttpErrorMessage(
  res: Response,
  data: Record<string, unknown>,
  locale: AppLocale = "fr"
): string {
  const err = typeof data.error === "string" ? data.error.trim() : ""
  if (err) return err

  const t = (key: string) => tMessage(locale, `importPage.${key}`)
  const isEmpty = Object.keys(data).length === 0
  const contentType = res.headers.get("content-type") ?? ""
  const looksNonJson = isEmpty || !contentType.includes("json")

  if (looksNonJson && !res.ok) {
    if (res.status === 403) return t("httpErr403")
    if (res.status === 404) return t("httpErr404")
    if (res.status === 401) return t("httpErr401")
    if (res.status === 429) return t("httpErr429")
    if (res.status >= 502) return t("httpErrTimeout")
    return t("httpErrInvalid")
  }

  return t("httpErrUnavailable")
}
