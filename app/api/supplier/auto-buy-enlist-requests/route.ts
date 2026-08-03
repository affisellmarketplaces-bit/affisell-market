import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import {
  createAutoBuyEnlistRequest,
  listSupplierAutoBuyEnlistRequests,
} from "@/lib/auto-buy-enlist-request"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z.object({
  aeUrl: z.string().min(8).max(2000),
  nameHint: z.string().min(2).max(200).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  wholesalePriceCents: z.number().int().min(1).max(50_000_000).optional().nullable(),
})

async function requireSupplier() {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, status: 401 as const, error: "unauthorized" }
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return { ok: false as const, status: 403 as const, error: "forbidden" }
  }
  return { ok: true as const, supplierId: session.user.id }
}

/**
 * GET /api/supplier/auto-buy-enlist-requests
 * Liste des demandes Instant Enlist du fournisseur connecté.
 */
export async function GET() {
  const gate = await requireSupplier()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const requests = await listSupplierAutoBuyEnlistRequests(gate.supplierId)
  return NextResponse.json({ ok: true, requests })
}

/**
 * POST /api/supplier/auto-buy-enlist-requests
 * Demande d’ajout auto-buy AliExpress → file admin Affisell.
 * Idempotent sur (supplierId, aeProductId) si déjà PENDING_REVIEW.
 */
export async function POST(req: Request) {
  const gate = await requireSupplier()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = postSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const result = await createAutoBuyEnlistRequest({
    supplierId: gate.supplierId,
    aeUrl: parsed.data.aeUrl,
    nameHint: parsed.data.nameHint,
    note: parsed.data.note,
    wholesalePriceCents: parsed.data.wholesalePriceCents,
  })

  if (!result.ok) {
    const status =
      result.error === "invalid_aliexpress_url"
        ? 400
        : result.error === "already_approved"
          ? 409
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(
    { ok: true, request: result.request, created: result.created },
    { status: result.created ? 201 : 200 }
  )
}
