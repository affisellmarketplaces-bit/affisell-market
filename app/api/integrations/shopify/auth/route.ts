import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { normalizeShopifyAdminHost } from "@/lib/shopify-sync-map"
import { buildShopifyAuthUrl, signShopifyOAuthState } from "@/lib/supplier-sync/shopify/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(req.url)
  const shopRaw = url.searchParams.get("shop") ?? url.searchParams.get("shopDomain") ?? ""
  const shop = normalizeShopifyAdminHost(shopRaw)
  if (!shop) {
    return NextResponse.json({ error: "shop must be a valid myshopify.com domain" }, { status: 400 })
  }

  const supplierId = url.searchParams.get("supplierId")
  if (supplierId && supplierId !== session.user.id) {
    return NextResponse.json({ error: "supplierId mismatch" }, { status: 403 })
  }

  try {
    const state = signShopifyOAuthState({ userId: session.user.id, shop, ts: Date.now() })
    const redirectUrl = buildShopifyAuthUrl({ shop, state })
    return NextResponse.redirect(redirectUrl, 302)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth init failed"
    console.error("[integrations/shopify/auth]", { supplierId: session.user.id, shop, result: "error", error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
