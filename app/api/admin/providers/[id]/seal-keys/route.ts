import { type NextRequest, NextResponse } from "next/server"

import { sealKeysSchema } from "@/lib/admin/providers/schemas"
import { sealProviderCredentials } from "@/lib/admin/providers/seal"
import { toProviderListRow } from "@/lib/admin/providers/serialize"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { id } = await ctx.params
  const parsed = sealKeysSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const provider = await prisma.fulfillmentProvider.findUnique({ where: { id } })
  if (!provider) return NextResponse.json({ error: "not_found" }, { status: 404 })

  let credentialsEncrypted: string
  try {
    const sealed = sealProviderCredentials(parsed.data)
    if (!sealed) {
      return NextResponse.json({ error: "empty_credentials" }, { status: 400 })
    }
    credentialsEncrypted = sealed
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "seal_failed", message: msg }, { status: 500 })
  }

  const updated = await prisma.fulfillmentProvider.update({
    where: { id },
    data: { credentialsEncrypted },
  })

  return NextResponse.json({
    ok: true,
    row: toProviderListRow(updated),
  })
}
