import { NextResponse } from "next/server"
import { z } from "zod"

import { enlistAeProductForAutoBuy } from "@/lib/admin/auto-fulfill/enlist-ae-product"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const bodySchema = z.object({
  aeUrl: z.string().min(8).max(2000),
  name: z.string().min(2).max(200).optional(),
  supplierId: z.string().min(1).optional(),
  wholesalePriceCents: z.number().int().min(1).max(50_000_000).optional(),
  autoBuyEnabled: z.boolean().optional(),
  publish: z.boolean().optional(),
})

/**
 * POST /api/admin/auto-fulfill/enlist
 * Instant Enlist: AE URL → Product + SupplierLink without supplier dashboard.
 */
export async function POST(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const result = await enlistAeProductForAutoBuy(parsed.data)
  if (!result.ok) {
    const status =
      result.error === "invalid_aliexpress_url" || result.error === "supplier_not_found"
        ? 400
        : 502
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}
