import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import {
  listPlatformFlags,
  setPlatformFlag,
  PLATFORM_FLAG_KEYS,
  type PlatformFlagKey,
} from "@/lib/admin/platform-flags.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_KEYS = new Set<string>(Object.values(PLATFORM_FLAG_KEYS))

export async function GET() {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const flags = await listPlatformFlags()
  return NextResponse.json({ flags })
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await req.json().catch(() => ({}))) as { key?: unknown; enabled?: unknown }
  const key = typeof body.key === "string" ? body.key : ""
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: "unknown_flag" }, { status: 400 })
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 })
  }

  await setPlatformFlag(key as PlatformFlagKey, body.enabled, auth.session.user.id)

  console.log("[platform-flags]", {
    key,
    enabled: body.enabled,
    updatedBy: auth.session.user.id,
  })

  const flags = await listPlatformFlags()
  return NextResponse.json({ flags })
}
