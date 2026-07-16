import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getConnectorById, isConnectorLive } from "@/lib/radar/connectors/registry"
import { gate } from "@/lib/radar/gate"

/** Stub Google OAuth start — connectors not live yet. */
export async function GET(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const url = new URL(req.url)
  const connectorId = url.searchParams.get("connectorId")?.trim() || "google_merchant"
  const connector = getConnectorById(connectorId)

  if (!connector || connector.category !== "google") {
    return NextResponse.redirect(new URL("/radar/connect?error=unknown_connector", req.url))
  }

  if (!isConnectorLive(connectorId)) {
    return NextResponse.redirect(
      new URL(
        `/radar/connect?error=coming_soon&connectorId=${encodeURIComponent(connectorId)}`,
        req.url
      )
    )
  }

  if (connectorId === "google_merchant") {
    return NextResponse.redirect(new URL("/api/radar/google/merchant/start", req.url))
  }

  return NextResponse.redirect(new URL(connector.getAuthUrl(session.user.id), req.url))
}
