import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { hintImportFieldMap } from "@/lib/import-csv-field-hint"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const raw = body.headers
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "headers array required" }, { status: 400 })
  }

  const headers = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 80)

  const suggested = hintImportFieldMap(headers)

  return NextResponse.json({
    suggested,
    note: "Heuristic suggestion — confirm column mapping before importing.",
  })
}
