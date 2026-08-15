import { revalidatePath, revalidateTag } from "next/cache"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isAffiliateBoutiqueApiRole } from "@/lib/boutique/reseller-boutique-access.server"
import { saveBoutiqueDesignSnapshot } from "@/lib/boutique/boutique-ai-theme.server"
import { parseBoutiqueTitleTypography } from "@/lib/boutique/boutique-title-typography-shared"
import { parseStorefrontThemeRef } from "@/lib/boutique/storefront-themes"
import { shopTag } from "@/lib/shop-storefront-cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    if (!isAffiliateBoutiqueApiRole(role)) {
      return NextResponse.json({ error: "affiliate_boutique_only" }, { status: 403 })
    }

    let body: {
      storeSlug?: string
      themeId?: string
      tagline?: string | null
      fontId?: string
      ornamentId?: string
      layoutId?: string
      displayOverride?: string | null
    } = {}
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const storeSlug = typeof body.storeSlug === "string" ? body.storeSlug.trim() : ""
    const themeId = typeof body.themeId === "string" ? body.themeId.trim() : ""
    if (!storeSlug || !themeId || !parseStorefrontThemeRef(themeId)) {
      return NextResponse.json({ error: "Invalid storeSlug or themeId" }, { status: 400 })
    }

    const titleTypography = parseBoutiqueTitleTypography({
      boutiqueTitleFont: body.fontId,
      boutiqueTitleOrnament: body.ornamentId,
      boutiqueTitleLayout: body.layoutId,
      boutiqueTitleDisplay: body.displayOverride,
    })

    const saved = await saveBoutiqueDesignSnapshot({
      userId,
      storeSlug,
      themeId,
      tagline: body.tagline,
      titleTypography,
    })

    revalidatePath(`/boutique/${encodeURIComponent(saved.slug)}`)
    revalidatePath(`/shops/${encodeURIComponent(saved.slug)}`)
    revalidateTag(shopTag(saved.slug), "max")

    return NextResponse.json({
      persisted: true,
      themeId: saved.themeId,
      label: saved.label,
      boutiquePath: `/boutique/${encodeURIComponent(saved.slug)}`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save boutique design failed"
    console.log("[save-boutique-design]", { result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
