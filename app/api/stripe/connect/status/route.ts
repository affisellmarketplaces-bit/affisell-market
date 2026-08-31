import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { clientIpFromRequest, errorMessage, flushLogs, logger } from "@/lib/logger"
import { loadStripeConnectStatusForUser } from "@/lib/stripe-connect-status.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROUTE = "stripe/connect/status"

export async function GET(req: Request) {
  const ip = clientIpFromRequest(req)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role
    if (role !== "SUPPLIER" && role !== "AFFILIATE" && role !== "AGENT") {
      return NextResponse.json({ error: "Role not eligible" }, { status: 403 })
    }

    const status = await loadStripeConnectStatusForUser(session.user.id)
    console.log("[stripe-connect-status]", {
      userId: session.user.id,
      role,
      transfersActive: status.transfersActive,
      payoutsEnabled: status.payoutsEnabled,
      result: "ok",
    })
    await logger.info("Connect status", { route: ROUTE, ip, userId: session.user.id, role })
    return NextResponse.json(status)
  } catch (e: unknown) {
    await logger.error("Connect status failed", {
      route: ROUTE,
      ip,
      error: errorMessage(e),
    })
    return NextResponse.json({ error: "Unable to load Connect status" }, { status: 500 })
  } finally {
    await flushLogs()
  }
}
