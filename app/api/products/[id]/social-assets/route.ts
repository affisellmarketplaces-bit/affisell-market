import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"
import { socialKeysForPlatforms } from "@/lib/social/platform-keys"
import {
  generateSocialAssets,
  SOCIAL_ASSET_PRIORITY_KEYS,
} from "@/lib/social/social-asset-generator"

type RouteCtx = { params: Promise<{ id: string }> }

export const runtime = "nodejs"
/** Social PNG pack — allow enough time for ImageResponse batch. */
export const maxDuration = 60

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireAffiliateSession()
    const { id } = await ctx.params
    const product = await loadBubbleProductView(id)
    if (!product) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }

    const url = new URL(request.url)
    const priorityOnly = url.searchParams.get("priority") === "1"

    const bundle = await generateSocialAssets(product, {
      persist: true,
      keys: priorityOnly ? SOCIAL_ASSET_PRIORITY_KEYS : undefined,
      concurrency: 3,
    })

    console.log("[social-assets]", {
      productId: id,
      okCount: bundle.okCount,
      failedKeys: bundle.failedKeys,
      priorityOnly,
    })

    return NextResponse.json(bundle)
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : "generate_failed"
    console.error("[social-assets]", { error: message })
    return NextResponse.json(
      { error: "generate_failed", message: message.slice(0, 240) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, ctx: RouteCtx) {
  try {
    await requireAffiliateSession()
    const { id } = await ctx.params
    const product = await loadBubbleProductView(id)
    if (!product) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }

    let platforms: string[] = []
    try {
      const body = (await request.json()) as { platforms?: string[] }
      platforms = Array.isArray(body.platforms) ? body.platforms : []
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 })
    }

    const keys = socialKeysForPlatforms(platforms)
    if (keys.length === 0) {
      return NextResponse.json({ error: "no_platforms" }, { status: 400 })
    }

    const bundle = await generateSocialAssets(product, {
      keys,
      persist: true,
      force: true,
      concurrency: 3,
    })
    return NextResponse.json(bundle)
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : "generate_failed"
    console.error("[social-assets]", { error: message, method: "POST" })
    return NextResponse.json(
      { error: "generate_failed", message: message.slice(0, 240) },
      { status: 500 }
    )
  }
}
