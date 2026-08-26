import "server-only"

import { collectAcceptedCurrentVersionIds, recordLegalAcceptance } from "@/lib/legal/acceptance"
import { resolveAppLocale } from "@/lib/i18n-locale"

type MerchantRole = "AFFILIATE" | "SUPPLIER"

/** LMS LegalAcceptance rows — idempotent per user/doc version. TermsAcceptanceLog is separate. */
export async function recordSignupLegalAcceptances(params: {
  userId: string
  role: MerchantRole | "CUSTOMER"
  req: Request
  locale?: string | null
}): Promise<string[]> {
  const locale = resolveAppLocale(params.locale ?? params.req.headers.get("accept-language"))

  await recordLegalAcceptance({
    userId: params.userId,
    slug: "customer",
    locale,
    context: "SIGNUP",
    req: params.req,
  })
  await recordLegalAcceptance({
    userId: params.userId,
    slug: "privacy",
    locale,
    context: "SIGNUP",
    req: params.req,
  })

  if (params.role === "SUPPLIER") {
    await recordLegalAcceptance({
      userId: params.userId,
      slug: "supplier",
      locale,
      context: "SIGNUP",
      req: params.req,
    })
  }
  if (params.role === "AFFILIATE") {
    await recordLegalAcceptance({
      userId: params.userId,
      slug: "affiliate",
      locale,
      context: "SIGNUP",
      req: params.req,
    })
  }

  return collectAcceptedCurrentVersionIds(params.userId, params.role)
}
