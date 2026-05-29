import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { loadCategoryBreadcrumb } from "@/lib/marketplace-category-branch"
import { LOCALE_COOKIE, resolveAppLocale } from "@/lib/i18n-locale"
import { dbUnavailablePayload } from "@/lib/prisma-db-error"
import { withPrismaReconnect } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const categoryId = searchParams.get("id")?.trim() ?? ""
  const cookieStore = await cookies()
  const locale = resolveAppLocale(cookieStore.get(LOCALE_COOKIE)?.value)

  if (!categoryId) {
    return NextResponse.json({ path: [], locale })
  }

  try {
    const path = await withPrismaReconnect(() => loadCategoryBreadcrumb(categoryId, locale))
    return NextResponse.json({ path, locale })
  } catch (e) {
    console.error("[api/categories/breadcrumb]", e)
    return NextResponse.json({ path: [], locale, ...dbUnavailablePayload(e) })
  }
}
