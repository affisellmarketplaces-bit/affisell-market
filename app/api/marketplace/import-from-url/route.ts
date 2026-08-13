import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { importMarketplaceFromUrl } from "@/lib/marketplace/import-from-url.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** POST { url: string } — admin 1-clic AliExpress → DRAFT marketplace listing. */
export async function POST(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const limited = await rateLimitResponseAsync(
    rateLimitClientKey(req, auth.session.user.id),
    {
      limit: 10,
      windowMs: 60 * 60 * 1000,
      prefix: "marketplace-import-url",
    }
  )
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as { url?: string }
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) {
    return NextResponse.json({ error: "URL requise" }, { status: 400 })
  }

  const result = await importMarketplaceFromUrl(url)
  if (!result.ok) {
    console.log("[marketplace-import]", {
      stage: "api",
      result: "error",
      status: result.status,
      error: result.error.slice(0, 160),
    })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
