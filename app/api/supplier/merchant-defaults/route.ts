import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { getMerchantDefaults, resolveWizardDefaults, upsertMerchantDefaults } from "@/lib/merchant-defaults"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z.object({
  countryCode: z.string().length(2).optional().nullable(),
  warehouseType: z.enum(["local", "regional", "international"]).optional().nullable(),
  offerMode: z.string().min(1).optional().nullable(),
  defaultCommissionPct: z.number().int().min(1).max(50).optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const defaults = await resolveWizardDefaults(session.user.id)
  const saved = await getMerchantDefaults(session.user.id)

  return NextResponse.json({ defaults, hasSavedProfile: Boolean(saved) })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 })
  }

  const row = await upsertMerchantDefaults(session.user.id, parsed.data)
  return NextResponse.json({ defaults: row })
}
