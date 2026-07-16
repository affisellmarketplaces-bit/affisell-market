import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getConnectorById, isConnectorLive } from "@/lib/radar/connectors/registry"
import { gate } from "@/lib/radar/gate"

type RouteContext = { params: Promise<{ connectorId: string }> }

export async function GET(req: Request, context: RouteContext) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const { connectorId } = await context.params
  const id = connectorId?.trim()
  if (!id) {
    return NextResponse.redirect(new URL("/radar/connect?error=missing_connector", req.url))
  }

  if (id === "tiktok" || id === "tiktok_shop") {
    return NextResponse.redirect(new URL("/api/radar/tiktok/start", req.url))
  }

  const connector = getConnectorById(id)
  if (!connector) {
    return NextResponse.redirect(new URL("/radar/connect?error=unknown_connector", req.url))
  }

  if (!isConnectorLive(id)) {
    return NextResponse.redirect(
      new URL(`/radar/connect?error=coming_soon&connectorId=${encodeURIComponent(id)}`, req.url)
    )
  }

  try {
    const authUrl = connector.getAuthUrl(session.user.id)
    console.log("[radar/connector/start]", { connectorId: id, userId: session.user.id, result: "redirect" })
    return NextResponse.redirect(new URL(authUrl, req.url))
  } catch (err) {
    console.error("[radar/connector/start]", {
      connectorId: id,
      result: "error",
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.redirect(new URL("/radar/connect?error=oauth_start", req.url))
  }
}
