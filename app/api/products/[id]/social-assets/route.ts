import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"
import { socialKeysForPlatforms } from "@/lib/social/platform-keys"
import { generateSocialAssets } from "@/lib/social/social-asset-generator"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: RouteCtx) {
  await requireAffiliateSession()
  const { id } = await ctx.params
  const product = await loadBubbleProductView(id)
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  const bundle = await generateSocialAssets(product, { persist: true })
  return NextResponse.json(bundle)
}

export async function POST(request: Request, ctx: RouteCtx) {
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

  const bundle = await generateSocialAssets(product, { keys, persist: true, force: true })
  return NextResponse.json(bundle)
}
