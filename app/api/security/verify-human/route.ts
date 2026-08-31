import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  createHumanPassToken,
  HUMAN_PASS_COOKIE,
  humanPassCookieMaxAgeSec,
  sanitizeShieldReturnTo,
} from "@/lib/security/human-pass"
import { HumanoidShield } from "@/lib/security/humanoid-shield"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MIN_CLAIM_MS = 750
const MAX_CLAIM_MS = 10 * 60 * 1000

type VerifyBody = {
  startedAt?: unknown
  returnTo?: unknown
  website?: unknown
}

export async function POST(req: Request) {
  const callerIp = HumanoidShield.extractIp(req as NextRequest)
  let body: VerifyBody = {}

  try {
    body = (await req.json()) as VerifyBody
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (typeof body.website === "string" && body.website.trim()) {
    console.log("[shield-verify]", { step: "honeypot_trip", ip: callerIp })
    return NextResponse.json({ error: "verification_failed" }, { status: 403 })
  }

  const startedAt =
    typeof body.startedAt === "number" && Number.isFinite(body.startedAt) ? body.startedAt : 0
  const elapsed = Date.now() - startedAt
  if (startedAt <= 0 || elapsed < MIN_CLAIM_MS || elapsed > MAX_CLAIM_MS) {
    console.log("[shield-verify]", { step: "timing_reject", ip: callerIp, elapsed })
    return NextResponse.json({ error: "verification_failed" }, { status: 403 })
  }

  HumanoidShield.unbanIp(callerIp)
  const token = createHumanPassToken(callerIp)
  const redirectTo = sanitizeShieldReturnTo(
    typeof body.returnTo === "string" ? body.returnTo : undefined
  )

  console.log("[shield-verify]", { step: "human_pass_granted", ip: callerIp, redirectTo })

  const res = NextResponse.json({ ok: true, redirectTo })
  res.cookies.set(HUMAN_PASS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: humanPassCookieMaxAgeSec(),
  })
  return res
}
