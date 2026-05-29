import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { marketplaceSearchSuggestions } from "@/lib/marketplace-search.server"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  if (q.length < 2) {
    return NextResponse.json({ products: [], categories: [], locale })
  }

  try {
    const result = await withPrismaReconnect(() => marketplaceSearchSuggestions(q, 8))
    return NextResponse.json({ ...result, locale, query: q })
  } catch (e) {
    console.error("[api/marketplace/search]", e)
    return NextResponse.json({
      products: [],
      categories: [],
      locale,
      ...dbUnavailablePayload(e),
    })
  }
}
