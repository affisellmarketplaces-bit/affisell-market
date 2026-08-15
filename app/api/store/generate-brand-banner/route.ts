import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  buildGradientBannerSvg,
  buildStoreBrandBannerPrompt,
  generateStoreBrandBannerImage,
} from "@/lib/storefront-brand-banner.server"
import { persistBrandStudioMedia } from "@/lib/storefront-brand-media-storage.server"
import { prisma } from "@/lib/prisma"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const store = await prisma.store.findUnique({ where: { userId } })
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 })
    }

    let niche: string | undefined
    try {
      const body = (await req.json()) as { niche?: string }
      niche = body.niche
    } catch {
      /* empty body ok */
    }

    const theme = parseStorefrontTheme(store.storefrontTheme)
    const primary = theme.primary ?? "#18181b"
    const accent = theme.accent ?? "#8b5cf6"

    const prompt = buildStoreBrandBannerPrompt({
      storeName: store.name,
      description: store.description ?? undefined,
      primary,
      accent,
      niche,
    })

    let imageBuf = await generateStoreBrandBannerImage(prompt)
    let source: "hf" | "gradient" = "hf"

    if (!imageBuf) {
      imageBuf = buildGradientBannerSvg({ storeName: store.name, primary, accent })
      source = "gradient"
      console.log("[generate-brand-banner]", { userId, result: "gradient_fallback" })
    }

    const ext = source === "hf" ? "png" : "svg"
    const uploaded = await persistBrandStudioMedia({
      userId,
      kind: "banner",
      ext,
      bytes: imageBuf,
    })

    console.log("[generate-brand-banner]", {
      userId,
      result: "ok",
      bannerUrl: uploaded.url,
      source,
      storage: uploaded.storage,
    })
    return NextResponse.json({ bannerUrl: uploaded.url, source })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Banner generation failed"
    console.log("[generate-brand-banner]", { result: "error", error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
