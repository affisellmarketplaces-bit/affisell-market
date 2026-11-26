import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { loadSupplierNextActions } from "@/lib/next-best-action/next-best-action.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** SUPPLIER only, read-only: one to three next actions built from the account's own data (potential impact, never a promise). */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), {
    prefix: "supplier-next-actions",
    limit: 30,
    windowMs: 60_000,
  })
  if (limited) return limited
  try {
    return NextResponse.json({ actions: await loadSupplierNextActions(session.user.id) })
  } catch (error) {
    console.error("[next-actions] load_failed", { role: "SUPPLIER", error: error instanceof Error ? error.message : "unknown" })
    return NextResponse.json({ error: "next_actions_unavailable" }, { status: 503 })
  }
}
