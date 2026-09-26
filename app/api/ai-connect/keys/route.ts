import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitResponse } from "@/lib/api-rate-limit"
import {
  createAiConnectionKey,
  listAiConnectionKeys,
  MAX_ACTIVE_KEYS_PER_USER,
  revokeAiConnectionKey,
} from "@/lib/ai-connect/keys"
import { effectiveToolRole } from "@/lib/ai-connect/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireOwner() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId || !effectiveToolRole(session.user.role ?? "")) return null
  return userId
}

export async function GET() {
  const userId = await requireOwner()
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ keys: await listAiConnectionKeys(userId), max: MAX_ACTIVE_KEYS_PER_USER })
}

export async function POST(req: Request) {
  const userId = await requireOwner()
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const limited = rateLimitResponse(userId, { limit: 10, windowMs: 60_000, prefix: "ai-key-create" })
  if (limited) return limited

  const body = (await req.json().catch(() => ({}))) as { label?: unknown }
  const created = await createAiConnectionKey({
    userId,
    label: typeof body.label === "string" ? body.label : undefined,
  })
  if (!created) {
    return NextResponse.json({ error: "max_keys", max: MAX_ACTIVE_KEYS_PER_USER }, { status: 409 })
  }
  return NextResponse.json({
    id: created.id,
    key: created.key,
    label: created.label,
    prefix: created.prefix,
    createdAt: created.createdAt,
  })
}

export async function DELETE(req: Request) {
  const userId = await requireOwner()
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { id?: unknown }
  const keyId = typeof body.id === "string" ? body.id.trim() : ""
  if (!keyId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const revoked = await revokeAiConnectionKey({ userId, keyId })
  return NextResponse.json({ ok: revoked }, { status: revoked ? 200 : 404 })
}
