import { NextResponse } from "next/server"
import { z } from "zod"

import { runExpansionPilot } from "@/lib/admin/expansion-pilot"
import { requireAdminSession } from "@/lib/admin/require-admin-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z.object({
  rank: z.number().int().min(1).max(10).optional(),
  notify: z.boolean().optional(),
})

/** One-click: enable next waitlist country + send launch emails. */
export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status })
  }

  let body: unknown = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const result = await runExpansionPilot({
    notify: parsed.data.notify ?? true,
    rank: parsed.data.rank,
  })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, detail: result.detail }, { status: 400 })
  }

  return NextResponse.json(result)
}
