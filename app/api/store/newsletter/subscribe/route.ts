import { NextResponse } from "next/server"
import { z } from "zod"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { subscribeStoreNewsletter } from "@/lib/store-newsletter-subscribe"
import { normalizeStoreNewsletterEmail } from "@/lib/store-newsletter-subscribe.shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  storeSlug: z.string().trim().min(1).max(120),
  email: z.string().trim().max(254),
  locale: z.string().trim().max(8).optional(),
  website: z.string().max(0).optional(),
})

/**
 * Public storefront newsletter opt-in.
 * Idempotent on (storeId, email).
 */
export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "store-newsletter",
    limit: 6,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const { storeSlug, email, locale, website } = parsed.data
  if (website && website.length > 0) {
    console.log("[store-newsletter]", { storeSlug, result: "blocked", reason: "honeypot" })
    return NextResponse.json({ ok: true, created: false })
  }

  if (!normalizeStoreNewsletterEmail(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 })
  }

  const result = await subscribeStoreNewsletter({ storeSlug, email, locale })
  if (!result.ok) {
    const status = result.error === "store_not_found" ? 404 : 400
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    storeName: result.storeName,
  })
}
