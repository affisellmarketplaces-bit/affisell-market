import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { loadBrowseDepartmentsCached } from "@/lib/taxonomy/resolve-browse-departments.server"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"

export const revalidate = 300

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
}

/** eBay-style browse departments resolved to Google taxonomy category ids. */
export async function GET() {
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  try {
    const payload = await loadBrowseDepartmentsCached(locale)
    return NextResponse.json(payload, { headers: CACHE_HEADERS })
  } catch (e) {
    console.error("[api/taxonomy/browse-departments]", e)
    return NextResponse.json({
      departments: [],
      locale,
      ...dbUnavailablePayload(e),
    })
  }
}
