import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { decryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import {
  getAmazonCatalogProducts,
  refreshAmazonAccessToken,
} from "@/lib/radar/connectors/amazon"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { gate } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Lists Catalog Items for the connected Amazon SP-API shop (EU marketplaces).
 * Criterion: after Seller Central sandbox connect, returns ≥1 product when catalog responds.
 */
export async function GET() {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const features =
    Array.isArray(session.user.features) && session.user.features.length > 0
      ? session.user.features
      : resolveRadarFeatures(session.user.id, session.user.isPro ?? false)
  if (!hasRadarAccess(features, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const conn = await getRadarDb().shopConnection.findFirst({
      where: {
        userId: session.user.id,
        connectorId: "amazon",
        status: "active",
      },
      orderBy: { updatedAt: "desc" },
    })

    if (!conn?.refreshToken) {
      return NextResponse.json(
        { error: "Amazon not connected", products: [] },
        { status: 404 }
      )
    }

    const refreshToken = decryptString(conn.refreshToken)
    const refreshed = await refreshAmazonAccessToken(refreshToken)
    if (!refreshed.access_token) {
      return NextResponse.json({ error: "Token refresh failed", products: [] }, { status: 502 })
    }

    const products = await getAmazonCatalogProducts(refreshed.access_token, {
      keywords: "phone",
    })

    console.log("[radar/amazon/products]", {
      userId: session.user.id,
      shopId: conn.shopId,
      count: products.length,
      result: "ok",
    })

    return NextResponse.json({ products, count: products.length, shopId: conn.shopId })
  } catch (err) {
    console.error("[radar/amazon/products]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}
