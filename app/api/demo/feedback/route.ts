import { NextResponse } from "next/server"
import { z } from "zod"

import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { logBusiness } from "@/lib/business-log"
import { demoPersonaToPrisma, type DemoPersonaKey } from "@/lib/demo/demo-shared"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const personaSchema = z.enum(["supplier", "affiliate", "buyer"])

const schema = z.object({
  persona: personaSchema,
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  stepId: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(8).optional(),
  website: z.string().max(0).optional(),
})

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "demo-feedback",
    limit: 12,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  const { persona, score, comment, email, stepId, locale, website } = parsed.data
  if (website && website.length > 0) {
    logBusiness("demo-feedback", { result: "blocked", reason: "honeypot" })
    return NextResponse.json({ ok: true })
  }

  try {
    await prisma.demoFeedback.create({
      data: {
        persona: demoPersonaToPrisma(persona as DemoPersonaKey),
        score,
        comment: comment?.trim() || null,
        email: email?.trim() || null,
        stepId: stepId?.trim() || null,
        locale: locale?.trim() || null,
      },
    })
    console.log("[demo-feedback]", { persona, score, stepId: stepId ?? null, result: "saved" })
    logBusiness("demo-feedback", { result: "saved", persona, score })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[demo-feedback]", { persona, result: "db_error", error })
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 })
  }
}
