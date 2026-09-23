import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  csvFeedFieldMapIsComplete,
  CSV_FEED_FIELD_KEYS,
  type CsvFeedFieldKey,
  type CsvFeedFieldMap,
} from "@/lib/integrations/csv-feed-config"
import { triggerIntegrationSyncBackground } from "@/lib/integrations/orchestrator"
import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url"
import { maskIntegrationConfig, normalizeIntegrationName } from "@/lib/supplier-integration-config"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseFieldMap(raw: unknown): CsvFeedFieldMap {
  const out: CsvFeedFieldMap = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  for (const key of CSV_FEED_FIELD_KEYS) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === "string" && v.trim()) out[key as CsvFeedFieldKey] = v.trim()
  }
  return out
}

/** Saves a CSV/Google-Sheet feed connection and kicks off its first sync in the background. */
export async function POST(req: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { feedUrl?: string; fieldMap?: unknown; name?: string }
  try {
    body = (await req.json()) as { feedUrl?: string; fieldMap?: unknown; name?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const safe = assertSafeOutboundUrl(body.feedUrl ?? "")
  if (!safe.ok) {
    return NextResponse.json({ error: `Invalid feed URL (${safe.code})` }, { status: 400 })
  }

  const fieldMap = parseFieldMap(body.fieldMap)
  if (!csvFeedFieldMapIsComplete(fieldMap)) {
    return NextResponse.json(
      { error: "Map at least the title and price columns before connecting" },
      { status: 400 }
    )
  }

  const feedUrl = safe.url.toString()
  const name = normalizeIntegrationName(body.name)

  try {
    const row = await prisma.supplierIntegration.create({
      data: {
        userId: session.user.id,
        platform: "csv-feed",
        provider: "CSV_FEED",
        name,
        /** Full URL (not just hostname) — two feeds on the same host must stay distinct. */
        shopDomain: feedUrl,
        status: "CONNECTED",
        config: { feedUrl, fieldMap },
      },
      select: { id: true, platform: true, name: true, enabled: true, config: true, shopDomain: true },
    })

    triggerIntegrationSyncBackground(row.id, session.user.id)

    return NextResponse.json({
      integration: { ...row, config: maskIntegrationConfig(row.config) },
    })
  } catch (e) {
    console.error("[integrations/csv-feed/connect]", {
      supplierId: session.user.id,
      result: "error",
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: "An integration with this name already exists for this feed" },
      { status: 409 }
    )
  }
}
