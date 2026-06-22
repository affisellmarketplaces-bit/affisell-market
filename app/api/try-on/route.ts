import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { resolveTryOnFeatureEnabled } from "@/lib/flags/try-on"
import {
  ensureTryOnAnonId,
  readTryOnAnonId,
  tryOnAnonSetCookieHeader,
} from "@/lib/try-on/anon-cookie.server"
import { enforceTryOnRateLimit } from "@/lib/try-on/rate-limit"
import { tryOnCreateBodySchema, tryOnStatusQuerySchema } from "@/lib/try-on/schemas"
import { createTryOnJob, getTryOnJobStatus } from "@/lib/try-on/try-on-service.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 10

function featureDisabled() {
  return NextResponse.json({ error: "Try-on feature is disabled" }, { status: 404 })
}

export async function GET(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    const url = new URL(req.url)
    if (!resolveTryOnFeatureEnabled(url.searchParams)) {
      return featureDisabled()
    }

    const parsed = tryOnStatusQuerySchema.safeParse({
      jobId: url.searchParams.get("jobId"),
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 })
    }

    const status = await getTryOnJobStatus(parsed.data.jobId)
    if (!status) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json(status)
  })
}

export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    const url = new URL(req.url)
    if (!resolveTryOnFeatureEnabled(url.searchParams)) {
      return featureDisabled()
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = tryOnCreateBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const session = await auth()
    const user = session?.user?.id
      ? {
          id: session.user.id,
          role: (session.user as { role?: string }).role,
          isPro: (session.user as { isPro?: boolean }).isPro,
          stripeSubscriptionId: (session.user as { stripeSubscriptionId?: string | null })
            .stripeSubscriptionId,
        }
      : null

    const cookieAnon = readTryOnAnonId(req.headers.get("cookie"))
    const anonId = user ? null : ensureTryOnAnonId(cookieAnon)

    const limited = await enforceTryOnRateLimit({ req, user, anonId })
    if (!limited.ok) {
      return NextResponse.json(
        { error: limited.message },
        {
          status: limited.status,
          headers: limited.retryAfterSec
            ? { "Retry-After": String(limited.retryAfterSec) }
            : undefined,
        }
      )
    }

    const result = await createTryOnJob({
      req,
      body: parsed.data,
      userId: user?.id ?? null,
      anonId,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const headers: Record<string, string> = {}
    if (!user && anonId && anonId !== cookieAnon) {
      headers["Set-Cookie"] = tryOnAnonSetCookieHeader(anonId)
    }

    return NextResponse.json(result, { headers })
  })
}
