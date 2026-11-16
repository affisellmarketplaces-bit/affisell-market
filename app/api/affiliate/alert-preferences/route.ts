import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isAppLocale } from "@/lib/i18n-locale"
import { loadAlertPreference, saveAlertPreference } from "@/lib/intelligence/profit-alerts.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Explicit union: with the inferred type TS normalises the two literals to `{ error; userId?: undefined } | { userId;
 * error?: undefined }`, so `"error" in r` no longer narrows, `r.error` is `NextResponse | undefined` and the handlers'
 * return type becomes `Response | undefined` (the production build's type check rejects the route tests on it).
 */
async function reseller(): Promise<{ error: NextResponse } | { userId: string }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (session?.user?.role !== "AFFILIATE") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { userId }
}

/** GET / PUT /api/affiliate/alert-preferences — the caller's own alert channels (in-app, e-mail) and language. */
export async function GET() {
  const r = await reseller()
  if ("error" in r) return r.error
  return NextResponse.json(await loadAlertPreference(r.userId))
}

export async function PUT(req: Request) {
  const r = await reseller()
  if ("error" in r) return r.error
  const body = (await req.json().catch(() => null)) as { inApp?: unknown; email?: unknown; locale?: unknown } | null
  if (!body || typeof body.inApp !== "boolean" || typeof body.email !== "boolean" || typeof body.locale !== "string" || !isAppLocale(body.locale)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  try {
    return NextResponse.json(await saveAlertPreference(r.userId, { inApp: body.inApp, email: body.email, locale: body.locale }))
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
