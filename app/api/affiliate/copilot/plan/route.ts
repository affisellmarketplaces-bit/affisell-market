import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadResellerActionPlan } from "@/lib/reseller-action-plan.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** The signed-in reseller's action plan (read-only). Every euro figure is an estimate. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return NextResponse.json(await loadResellerActionPlan(session.user.id))
}
