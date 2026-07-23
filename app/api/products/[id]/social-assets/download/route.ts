import { readFile } from "node:fs/promises"

import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"
import { parseSocialAssetKey } from "@/lib/social/platform-keys"
import {
  renderSocialAssetPng,
  socialAssetAbsolutePath,
  socialAssetFileExists,
} from "@/lib/social/render-social-asset.server"

type RouteCtx = { params: Promise<{ id: string }> }

export const runtime = "nodejs"
export const maxDuration = 30

function isNextNavigationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    String((err as { digest: string }).digest).startsWith("NEXT_")
  )
}

export async function GET(request: Request, ctx: RouteCtx) {
  try {
    await requireAffiliateSession()
    const { id } = await ctx.params
    const format = new URL(request.url).searchParams.get("format") ?? ""
    const key = parseSocialAssetKey(format)
    if (!key) {
      return NextResponse.json({ error: "invalid_format" }, { status: 400 })
    }

    const product = await loadBubbleProductView(id)
    if (!product) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }

    const exists = await socialAssetFileExists(id, key)
    if (!exists) {
      await renderSocialAssetPng(product, key)
    }

    const filePath = socialAssetAbsolutePath(id, key)
    const buffer = await readFile(filePath)
    console.log("[social-assets-download]", { productId: id, key, bytes: buffer.length })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${id}-${key}.png"`,
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (err) {
    if (isNextNavigationError(err)) throw err
    const message = err instanceof Error ? err.message : "download_failed"
    console.error("[social-assets-download]", { err: message })
    return NextResponse.json({ error: "download_failed", message: message.slice(0, 240) }, { status: 500 })
  }
}
