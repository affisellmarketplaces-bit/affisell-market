import { revalidatePath, revalidateTag } from "next/cache"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  affiliateBoutiquePublicPath,
  isAffiliateBoutiqueApiRole,
} from "@/lib/boutique/reseller-boutique-access.server"
import {
  boutiqueTitleTypographyToStoreFields,
  parseBoutiqueTitleTypography,
  sanitizeBoutiqueTitleDisplay,
  type BoutiqueTitleFontId,
  type BoutiqueTitleLayoutId,
  type BoutiqueTitleOrnamentId,
} from "@/lib/boutique/boutique-title-typography-shared"
import { prisma } from "@/lib/prisma"
import { shopTag } from "@/lib/shop-storefront-cache"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  fontId?: BoutiqueTitleFontId
  ornamentId?: BoutiqueTitleOrnamentId
  layoutId?: BoutiqueTitleLayoutId
  displayOverride?: string | null
}

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

    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true, slug: true, storefrontTheme: true },
    })
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 })
    }

    const existing = parseStorefrontTheme(store.storefrontTheme)
    const current = parseBoutiqueTitleTypography(existing)
    const next = parseBoutiqueTitleTypography({
      boutiqueTitleFont: body.fontId ?? current.fontId,
      boutiqueTitleOrnament: body.ornamentId ?? current.ornamentId,
      boutiqueTitleLayout: body.layoutId ?? current.layoutId,
      boutiqueTitleDisplay:
        body.displayOverride !== undefined
          ? sanitizeBoutiqueTitleDisplay(body.displayOverride)
          : current.displayOverride,
    })

    await prisma.store.update({
      where: { id: store.id },
      data: {
        storefrontTheme: {
          ...existing,
          ...boutiqueTitleTypographyToStoreFields(next),
        },
      },
    })

    revalidatePath(`/boutique/${encodeURIComponent(store.slug)}`)
    revalidateTag(shopTag(store.slug), "max")

    console.log("[update-boutique-title]", {
      userId,
      storeId: store.id,
      fontId: next.fontId,
      ornamentId: next.ornamentId,
      result: "ok",
    })

    return NextResponse.json({
      typography: next,
      boutiquePath: affiliateBoutiquePublicPath(store.slug),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Boutique title update failed"
    console.log("[update-boutique-title]", { result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
