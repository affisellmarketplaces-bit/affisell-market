import { revalidatePath, revalidateTag } from "next/cache"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  buildBrandStudioGeneration,
  loadBrandStudioCatalogTitles,
  persistBrandStudioSnapshot,
} from "@/lib/boutique/haute-gamme-themes.server"
import { matchVibeToDesign } from "@/lib/boutique/haute-gamme-themes-shared"
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

    let storeSlug = ""
    let vibe = ""
    let catalog: string[] = []

    try {
      const body = (await req.json()) as {
        storeSlug?: string
        vibe?: string
        catalog?: string[]
      }
      storeSlug = typeof body.storeSlug === "string" ? body.storeSlug.trim() : ""
      vibe = typeof body.vibe === "string" ? body.vibe.trim().slice(0, 400) : ""
      catalog = Array.isArray(body.catalog)
        ? body.catalog
            .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
            .map((t) => t.trim().slice(0, 120))
            .slice(0, 12)
        : []
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!vibe) {
      return NextResponse.json({ error: "Vibe is required" }, { status: 400 })
    }

    const store = await prisma.store.findUnique({
      where: { userId },
      select: { slug: true },
    })
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 })
    }

    const resolvedSlug = storeSlug || store.slug
    if (resolvedSlug !== store.slug) {
      return NextResponse.json({ error: "Store slug mismatch" }, { status: 403 })
    }

    if (catalog.length === 0) {
      catalog = await loadBrandStudioCatalogTitles(userId)
    }

    const vibeBlob = `${vibe} ${catalog.join(" ")}`.trim()
    const design = matchVibeToDesign(vibeBlob)
    const snapshot = buildBrandStudioGeneration({
      storeSlug: resolvedSlug,
      vibe,
      design,
    })

    await persistBrandStudioSnapshot({
      userId,
      storeSlug: resolvedSlug,
      snapshot,
    })

    revalidatePath(`/boutique/${encodeURIComponent(resolvedSlug)}`)
    revalidatePath(`/dashboard/affiliate/brand-studio`)
    revalidateTag(shopTag(resolvedSlug), "max")

    console.log("[brand-studio-generate]", {
      userId,
      storeSlug: resolvedSlug,
      designId: design.id,
      catalogCount: catalog.length,
      result: "ok",
    })

    return NextResponse.json({
      success: true,
      design: {
        id: design.id,
        name: design.name,
        palette: snapshot.palette,
        typography: snapshot.typography,
        heroTitle: snapshot.heroTitle,
        designIndex: snapshot.designIndex,
      },
      tagline: snapshot.tagline,
      boutiquePath: `/boutique/${encodeURIComponent(resolvedSlug)}`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Brand studio generation failed"
    console.log("[brand-studio-generate]", { result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
