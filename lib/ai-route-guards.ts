import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { requireSupplierOrAdminApi } from "@/lib/supplier-or-admin-session"

const SUPPLIER_AI_LIMIT = { limit: 30, windowMs: 60_000 } as const

/** Supplier/admin session + per-user AI rate limit. */
export async function guardSupplierAiRoute(
  req: Request,
  prefix: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const gate = await requireSupplierOrAdminApi()
  if (!gate.ok) return gate

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, gate.session.user.id), {
    ...SUPPLIER_AI_LIMIT,
    prefix,
  })
  if (limited) return { ok: false, response: limited }

  return { ok: true, userId: gate.session.user.id }
}
