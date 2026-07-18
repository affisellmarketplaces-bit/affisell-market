import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { decryptString } from "@/lib/crypto"
import { getRadarDb } from "@/lib/prisma-radar"
import {
  getGoogleMerchantProducts,
  refreshGoogleAccessToken,
} from "@/lib/radar/connectors/google-merchant"
import { hasRadarAccess, resolveRadarFeatures } from "@/lib/radar/features"
import { gate } from "@/lib/radar/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lists Merchant Center products for the connected Google account. */
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
        connectorId: "google_merchant",
        status: "active",
      },
      orderBy: { updatedAt: "desc" },
    })

    if (!conn) {
      return NextResponse.json(
        { error: "Google Merchant not connected", products: [] },
        { status: 404 }
      )
    }

    const merchantId = conn.merchantId?.trim() || conn.shopId
    let accessToken = decryptString(conn.accessToken)

    if (conn.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(decryptString(conn.refreshToken))
      if (refreshed.access_token) {
        accessToken = refreshed.access_token
      }
    }

    const products = await getGoogleMerchantProducts(accessToken, { merchantId })

    console.log("[radar/google/merchant/products]", {
      userId: session.user.id,
      merchantId,
      count: products.length,
      result: "ok",
    })

    return NextResponse.json({ products, count: products.length, merchantId })
  } catch (err) {
    console.error("[radar/google/merchant/products]", {
      userId: session.user.id,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}
