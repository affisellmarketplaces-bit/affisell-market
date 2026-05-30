import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resolveSupplierLinkFromAeInput } from "@/lib/fulfillment/supplier-link-resolve"
import { AliExpressApiError } from "@/lib/aliexpress-open-api"

const bodySchema = z.object({ aeUrl: z.string().min(4) })

export async function POST(
  req: Request,
  _ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { aeUrl } = bodySchema.parse(await req.json())

  try {
    const resolved = await resolveSupplierLinkFromAeInput(aeUrl)
    return NextResponse.json({
      ok: true,
      resolved: {
        ...resolved,
        aeSkus: resolved.aeSkus ?? [],
      },
    })
  } catch (e) {
    const message = e instanceof AliExpressApiError ? e.message : e instanceof Error ? e.message : "resolve_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
