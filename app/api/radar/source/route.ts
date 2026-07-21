import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { gate } from "@/lib/radar/gate"
import {
  createRadarImportJob,
  resolveRadarWinnersForImport,
} from "@/lib/radar/radar-import-bridge.server"
import type { RadarImportDestination } from "@/lib/radar/radar-import-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SourceBody = {
  winnerIds?: unknown
  country?: unknown
  destination?: unknown
}

function parseDestination(raw: unknown): RadarImportDestination | null {
  if (raw === "affisell_catalog" || raw === "supplier_draft") return raw
  return null
}

/**
 * POST /api/radar/source
 * Bulk import Radar winners → ImportJob (+ affiliate drafts when destination=affisell_catalog).
 */
export async function POST(req: Request) {
  const blocked = gate()
  if (blocked) return blocked

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as SourceBody
  const winnerIds = Array.isArray(body.winnerIds)
    ? body.winnerIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : []
  const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : ""
  const destination = parseDestination(body.destination)

  if (winnerIds.length === 0) {
    return NextResponse.json({ error: "missing_winner_ids" }, { status: 400 })
  }
  if (!country || country.length !== 2) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 })
  }
  if (!destination) {
    return NextResponse.json({ error: "invalid_destination" }, { status: 400 })
  }

  if (destination === "affisell_catalog" && session.user.role !== "AFFILIATE") {
    return NextResponse.json({ error: "affiliate_role_required" }, { status: 403 })
  }
  if (destination === "supplier_draft" && session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "supplier_role_required" }, { status: 403 })
  }

  const products = await resolveRadarWinnersForImport({ winnerIds, country })
  if (products.length === 0) {
    return NextResponse.json({ error: "winners_not_found" }, { status: 404 })
  }

  try {
    const result = await createRadarImportJob({
      userId: session.user.id,
      country,
      destination,
      products,
    })

    console.log("[api/radar/source]", {
      userId: session.user.id,
      jobId: result.jobId,
      country,
      destination,
      count: result.count,
      importedCount: result.importedCount,
    })

    return NextResponse.json({
      jobId: result.jobId,
      count: result.count,
      importedCount: result.importedCount,
      redirectUrl: result.redirectUrl,
    })
  } catch (err) {
    console.error("[api/radar/source]", {
      userId: session.user.id,
      country,
      destination,
      result: "error",
      message: err instanceof Error ? err.message : "unknown",
    })
    return NextResponse.json({ error: "import_failed" }, { status: 500 })
  }
}
