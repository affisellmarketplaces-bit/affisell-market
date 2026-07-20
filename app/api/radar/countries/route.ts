import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { gate } from "@/lib/radar/gate"
import { getWorldRadarCountriesPayload } from "@/lib/radar/world-radar-store.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 3600

/** GET /api/radar/countries — 30 markets grouped by region. */
export async function GET() {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  try {
    const payload = await getWorldRadarCountriesPayload()
    return NextResponse.json(payload)
  } catch (err) {
    console.error("[api/radar/countries]", {
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "COUNTRIES_FETCH_FAILED" }, { status: 500 })
  }
}
