import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadResellerNextActions } from "@/lib/next-best-action/next-best-action.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** AFFILIATE only, read-only: one to three next actions built from the account's own data (potential impact, never a promise). */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "AFFILIATE") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), {
    prefix: "reseller-next-actions",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited
  try {
    return NextResponse.json({ actions: await loadResellerNextActions(session.user.id) })
  } catch (error) {
    console.error("[next-actions] load_failed", { role: "AFFILIATE", error: error instanceof Error ? error.message : "unknown" })
    return NextResponse.json({ error: "next_actions_unavailable" }, { status: 503 })
  }
}
