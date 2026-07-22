import { readFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"
import { parseSocialAssetKey } from "@/lib/social/platform-keys"
import { generateSocialAssets } from "@/lib/social/social-asset-generator"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: RouteCtx) {
  await requireAffiliateSession()
  const { id } = await ctx.params
  const format = new URL(request.url).searchParams.get("format") ?? "story"
  const key = parseSocialAssetKey(format)
  if (!key) {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 })
  }

  const product = await loadBubbleProductView(id)
  if (!product) {
    return NextResponse.json({ error: "product_not_found" }, { status: 404 })
  }

  await generateSocialAssets(product, { keys: [key], persist: true })

  const filePath = path.join(process.cwd(), "public", "generated", "social", id, `${key}.png`)
  let buffer: Buffer
  try {
    buffer = await readFile(filePath)
  } catch (err) {
    console.error("[social-assets-download]", { productId: id, key, err })
    return NextResponse.json({ error: "file_missing" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${id}-${key}.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
