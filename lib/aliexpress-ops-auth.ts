import { createHmac, timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function unauthorizedHint(): NextResponse {
  return NextResponse.json(
    {
      error: "Unauthorized",
      hint: "Pass Authorization: Bearer $CRON_SECRET, header x-cron-secret, ?secret=, or JSON secret field",
    },
    { status: 401 }
  )
}

/**
 * Shared ops auth for AliExpress create / fulfill / refresh.
 * Accepts (any one):
 * - Authorization: Bearer ${CRON_SECRET}
 * - x-cron-secret: ${CRON_SECRET}
 * - ?secret=${CRON_SECRET}
 * - JSON body `{ "secret": "..." }` (stripped by caller after auth)
 * - x-affisell-signature: HMAC-SHA256(rawBody, CRON_SECRET)
 */
export function authorizeAliExpressOps(
  req: Request,
  opts?: { rawBody?: string; bodySecret?: string | null }
): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? ""

  if (!cronSecret) {
    if (mustEnforceProductionSecrets()) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
    }
    return null
  }

  const url = new URL(req.url)
  const querySecret = url.searchParams.get("secret")?.trim() ?? ""
  if (querySecret && safeEqual(querySecret, cronSecret)) return null

  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? ""
  if (headerSecret && safeEqual(headerSecret, cronSecret)) return null

  const bodySecret = opts?.bodySecret?.trim() ?? ""
  if (bodySecret && safeEqual(bodySecret, cronSecret)) return null

  const cronDenied = authorizeCronRequest(req)
  if (cronDenied === null) return null

  const rawBody = opts?.rawBody ?? ""
  const sig =
    req.headers.get("x-affisell-signature")?.trim() ||
    req.headers.get("x-hub-signature-256")?.trim() ||
    ""
  if (sig && rawBody) {
    const hex = createHmac("sha256", cronSecret).update(rawBody, "utf8").digest("hex")
    const provided = sig.replace(/^sha256=/i, "").trim()
    if (provided.length === hex.length && safeEqual(provided, hex)) return null
  }

  return unauthorizedHint()
}

/** Pull optional `secret` from a parsed JSON body without mutating business validation. */
export function extractBodySecret(json: unknown): string | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null
  const secret = (json as Record<string, unknown>).secret
  return typeof secret === "string" ? secret : null
}

/** Remove `secret` before Zod parse so it is not treated as a business field. */
export function stripBodySecret(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json
  const clone = { ...(json as Record<string, unknown>) }
  delete clone.secret
  return clone
}
