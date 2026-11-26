import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { isAppLocale } from "@/lib/i18n-locale"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { readRestockWatchMode } from "@/lib/restock-watch/restock-watch"
import {
  cancelRestockWatch,
  createRestockWatch,
  listRestockWatches,
  restockWatchStatus,
} from "@/lib/restock-watch/restock-watch.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function str(v: unknown, max = 120): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null
}

/**
 * GET /api/restock-watch?listingId=&color=&size=&storage= — is the signed-in buyer watching this exact variant?
 * GET /api/restock-watch (no listingId) — the buyer's own requests. Anonymous callers only learn the mode.
 */
export async function GET(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), { prefix: "restock-watch-get", limit: 60, windowMs: 60_000 })
  if (limited) return limited
  const mode = readRestockWatchMode()
  if (mode === "off") return NextResponse.json({ mode, watching: false })
  const userId = (await auth())?.user?.id ?? null
  const url = new URL(req.url)
  const listingId = str(url.searchParams.get("listingId"), 64)
  try {
    if (!listingId) {
      if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
      return NextResponse.json({ mode, watches: await listRestockWatches(userId) })
    }
    const choice = { color: str(url.searchParams.get("color")), size: str(url.searchParams.get("size")), storage: str(url.searchParams.get("storage")) }
    return NextResponse.json({ ...(await restockWatchStatus(userId, listingId, choice)), signedIn: Boolean(userId) })
  } catch {
    return NextResponse.json({ mode, watching: false, unknown: true })
  }
}

/** POST {listingId, color?, size?, storage?, locale} — an explicit request from a signed-in buyer, for one sold-out variant. */
export async function POST(req: Request) {
  const crossSite = assertSameSiteRequestOrigin(req)
  if (crossSite) return crossSite
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), { prefix: "restock-watch-post", limit: 20, windowMs: 60_000 })
  if (limited) return limited
  const userId = (await auth())?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const listingId = str(body?.listingId, 64)
  if (!body || !listingId) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  const locale = typeof body.locale === "string" && isAppLocale(body.locale) ? body.locale : "fr"
  try {
    const r = await createRestockWatch({
      userId,
      listingId,
      choice: { color: str(body.color), size: str(body.size), storage: str(body.storage) },
      locale,
    })
    if (r.ok) return NextResponse.json(r)
    const status = r.error === "listing_not_found" ? 404 : r.error === "mode_off" ? 409 : r.error === "too_many" ? 429 : 409
    return NextResponse.json({ error: r.error }, { status })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}

/** DELETE {watchId} — the buyer cancels their own request (unsubscribe). */
export async function DELETE(req: Request) {
  const crossSite = assertSameSiteRequestOrigin(req)
  if (crossSite) return crossSite
  const userId = (await auth())?.user?.id
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const watchId = str(body?.watchId, 300)
  if (!watchId) return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  try {
    return (await cancelRestockWatch(userId, watchId)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 })
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
