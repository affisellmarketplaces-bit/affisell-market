import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { loadCategoryBranch } from "@/lib/marketplace-category-branch"
import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const revalidate = 120

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const parentId = searchParams.get("parentId")
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  try {
    const nodes = await withPrismaReconnect(() =>
      loadCategoryBranch(parentId?.trim() || null, locale)
    )
    return NextResponse.json({ nodes, locale, parentId: parentId ?? null }, { headers: CACHE_HEADERS })
  } catch (e) {
    console.error("[api/categories/branch]", e)
    return NextResponse.json({
      nodes: [],
      locale,
      ...dbUnavailablePayload(e),
    })
  }
}
