import { revalidatePath, revalidateTag } from "next/cache"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateBoutiqueVisualTheme, persistBoutiqueVisualTheme } from "@/lib/boutique/boutique-ai-theme.server"
import { getStorefrontThemeById } from "@/lib/boutique/storefront-theme-engine"
import { parseStorefrontThemeRef } from "@/lib/boutique/storefront-themes"
import { prisma } from "@/lib/prisma"
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
    if (role !== "AFFILIATE" && role !== "SUPPLIER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const store = await prisma.store.findUnique({
      where: { userId },
      select: { name: true, slug: true },
    })
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 })
    }

    let vibe = ""
    let locale: string | undefined
    let themeId: string | undefined
    let persist = true
    try {
      const body = (await req.json()) as {
        vibe?: string
        locale?: string
        themeId?: string
        persist?: boolean
      }
      vibe = typeof body.vibe === "string" ? body.vibe.trim() : ""
      locale = body.locale
      themeId = typeof body.themeId === "string" ? body.themeId.trim() : undefined
      persist = body.persist !== false
    } catch {
      /* empty body ok for auto-generate */
    }

    const manualThemeId = themeId && parseStorefrontThemeRef(themeId) ? themeId : null

    const result = await generateBoutiqueVisualTheme({
      userId,
      role,
      storeName: store.name,
      vibe,
      locale,
      manualThemeId: vibe ? null : manualThemeId,
    })

    if (persist) {
      await persistBoutiqueVisualTheme({
        userId,
        payload: result,
        vibe,
        locale,
      })
      revalidatePath(`/boutique/${encodeURIComponent(store.slug)}`)
      revalidatePath(`/shops/${encodeURIComponent(store.slug)}`)
      revalidateTag(shopTag(store.slug), "max")
    }

    const themeMeta = getStorefrontThemeById(result.themeId)

    return NextResponse.json({
      themeId: result.themeId,
      label: themeMeta.label,
      family: themeMeta.family,
      tagline: result.tagline,
      rationale: result.rationale,
      source: result.source,
      persisted: persist,
      boutiquePath: `/boutique/${encodeURIComponent(store.slug)}`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Boutique personalization failed"
    console.log("[personalize-boutique-theme]", { result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
