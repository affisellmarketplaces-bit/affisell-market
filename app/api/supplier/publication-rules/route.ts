import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { assertProductCreationAllowed } from "@/lib/growth/catalog-cap.server"
import { readListingReadinessMode } from "@/lib/listing-compliance/mode"
import { merchantVerificationGate } from "@/lib/merchant-legal/require-merchant-verified"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * SUPPLIER, read-only: the three facts a publication depends on that only the server knows — the product-safety mode
 * (`LISTING_READINESS_MODE`), the merchant verification gate and the live-catalogue cap — evaluated with the SAME
 * functions `POST /api/supplier/products` uses, for the commercial-readiness panel. Each fact is `null` when it can not
 * be read: the panel then does not judge it (an unknown rule is never shown as a blocker). Changes nothing.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (session.user.role !== "SUPPLIER") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, session.user.id), { prefix: "publication-rules", limit: 20, windowMs: 60_000 })
  if (limited) return limited
  const userId = session.user.id
  const [merchant, cap] = await Promise.all([
    merchantVerificationGate(userId).then((g) => g.allowed).catch(() => null),
    assertProductCreationAllowed(userId).then((c) => !c.allowed).catch(() => null),
  ])
  return NextResponse.json(
    { listingReadinessMode: readListingReadinessMode(), merchantVerified: merchant, catalogCapReached: cap },
    { headers: { "Cache-Control": "no-store" } },
  )
}
