import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { requireSupplierOrAdminApi } from "@/lib/supplier-or-admin-session"

const SUPPLIER_AI_LIMIT = { limit: 30, windowMs: 60_000 } as const

/** Live OpenAI analyze — separate bucket; cache hits skip this limit in route. */
export const INSTANTSCAN_LIVE_LIMIT = { limit: 20, windowMs: 60_000 } as const

/** Smart Margin Cortex — 100 req/h per supplier. */
export const SMART_MARGIN_LIMIT = { limit: 100, windowMs: 60 * 60_000 } as const

type AiRouteGuardFail = { ok: false; response: NextResponse<never> }

/** Auth only — use before cache check on analyze-product. */
export async function guardSupplierAiSession(): Promise<
  { ok: true; userId: string } | AiRouteGuardFail
> {
  const gate = await requireSupplierOrAdminApi()
  if (!gate.ok) return { ok: false, response: gate.response as NextResponse<never> }
  return { ok: true, userId: gate.session.user.id }
}

/** Supplier/admin session + per-user AI rate limit. */
export async function guardSupplierAiRoute(
  req: Request,
  prefix: string
): Promise<{ ok: true; userId: string } | AiRouteGuardFail> {
  const gate = await requireSupplierOrAdminApi()
  if (!gate.ok) return { ok: false, response: gate.response as NextResponse<never> }

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, gate.session.user.id), {
    ...SUPPLIER_AI_LIMIT,
    prefix,
  })
  if (limited) return { ok: false, response: limited as NextResponse<never> }

  return { ok: true, userId: gate.session.user.id }
}
