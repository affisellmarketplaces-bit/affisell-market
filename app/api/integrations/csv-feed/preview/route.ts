import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { CSV_FEED_FIELD_KEYS } from "@/lib/integrations/csv-feed-config"
import { CsvFeedFetchError, fetchCsvFeedRows } from "@/lib/integrations/csv-feed-fetch"
import { hintImportFieldMap } from "@/lib/import-csv-field-hint"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PREVIEW_ROW_COUNT = 5

/** Fetches a candidate feed URL and suggests a column mapping — no write, nothing saved yet. */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { feedUrl?: string }
  try {
    body = (await req.json()) as { feedUrl?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const feedUrl = body.feedUrl?.trim()
  if (!feedUrl) {
    return NextResponse.json({ error: "feedUrl required" }, { status: 400 })
  }

  try {
    const { headers, rows } = await fetchCsvFeedRows(feedUrl)
    const suggested = hintImportFieldMap(headers)
    return NextResponse.json({
      headers,
      fieldKeys: CSV_FEED_FIELD_KEYS,
      suggested,
      previewRows: rows.slice(0, PREVIEW_ROW_COUNT),
      rowCount: rows.length,
    })
  } catch (e) {
    if (e instanceof CsvFeedFetchError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 422 })
    }
    const msg = e instanceof Error ? e.message : "Could not read this feed"
    console.error("[integrations/csv-feed/preview]", {
      supplierId: session.user.id,
      result: "error",
      error: msg,
    })
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
