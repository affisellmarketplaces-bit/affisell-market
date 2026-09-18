import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { suggestListingCategories } from "@/lib/supplier-suggest-listing"
import { isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"
import { prisma } from "@/lib/prisma"
import { getCategoryDisplayLocalizer } from "@/lib/category-display-locale.server"
import { tMessage } from "@/lib/i18n-pick-message"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Unified listing suggestions (category) for supplier product form. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: unknown
    description?: unknown
    bullets?: unknown
    imageUrl?: unknown
  }
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const description = typeof body.description === "string" ? body.description.trim() : ""
  const bullets = Array.isArray(body.bullets)
    ? body.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    : undefined
  const imageUrl =
    typeof body.imageUrl === "string" && isDurableListingImageUrl(body.imageUrl.trim())
      ? body.imageUrl.trim()
      : undefined

  const locale = await resolveRequestLocale(undefined)
  const result = await suggestListingCategories(title, description, prisma, {
    imageUrl,
    supplierId: session.user.id,
    bullets,
    locale,
  })
  const display = await getCategoryDisplayLocalizer(prisma, locale)
  const localize = <T extends { path: { id: string; name: string }[]; breadcrumb: string }>(lp: T): T => ({
    ...lp,
    breadcrumb: locale === "fr" ? lp.breadcrumb : display.breadcrumb(lp.path),
    path: display.segments(lp.path),
  })
  return NextResponse.json({
    ...result,
    suggestions: result.suggestions.map(localize),
    alternatives: result.alternatives.map((alt) => ({
      ...localize(alt),
      reason: tMessage(locale, "supplier.categoryPicker.altWatchReason", alt.reason),
    })),
  })
}
