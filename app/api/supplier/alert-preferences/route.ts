import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { isAppLocale } from "@/lib/i18n-locale"
import { loadSupplierAlertPreference, saveSupplierAlertPreference } from "@/lib/supplier-demand-alerts/blocked-demand.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function supplier(): Promise<{ error: NextResponse } | { userId: string }> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  if (session?.user?.role !== "SUPPLIER") return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { userId }
}

/** GET / PUT /api/supplier/alert-preferences — the caller's own blocked-demand bell preference and language. */
export async function GET() {
  const r = await supplier()
  if ("error" in r) return r.error
  return NextResponse.json(await loadSupplierAlertPreference(r.userId))
}

export async function PUT(req: Request) {
  const r = await supplier()
  if ("error" in r) return r.error
  const origin = req.headers.get("origin")
  const host = req.headers.get("host")
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "cross_site" }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { blockedDemandInApp?: unknown; locale?: unknown } | null
  if (!body || typeof body.blockedDemandInApp !== "boolean" || typeof body.locale !== "string" || !isAppLocale(body.locale)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  try {
    return NextResponse.json(await saveSupplierAlertPreference(r.userId, { blockedDemandInApp: body.blockedDemandInApp, locale: body.locale }))
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 })
  }
}
