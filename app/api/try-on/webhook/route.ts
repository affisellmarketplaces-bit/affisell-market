import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import { deleteSelfieBlob } from "@/lib/try-on/cloth2body-api.server"
import { getTryOnJobStatus } from "@/lib/try-on/try-on-service.server"
import { prisma } from "@/lib/prisma"
import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"
import { verifyReplicateWebhook } from "@/lib/try-on/replicate-webhook-verify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Replicate "a prediction changed" notification.
 *
 * THE BODY IS NOT TRUSTED. This route used to check only that some header existed (never its value — and not even
 * that when `REPLICATE_WEBHOOK_SECRET` was empty), then finalised the job with the `status` and `output` URL taken
 * from the body, and the server downloaded that URL and published it on the public blob store: a forged webhook was a
 * full-read SSRF. Now the only thing taken from the body is the prediction id, which finds our job; the status and
 * the output URL are read back from Replicate with OUR token (`getTryOnJobStatus` → `fetchPrediction`), so a forged
 * call can at worst make us ask Replicate a question whose answer we would have asked anyway.
 */
export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    // Defence in depth on top of "the body is not trusted": when a signing secret is configured, the Replicate
    // (Standard Webhooks) signature over the RAW body is required. Without a secret the route keeps working (the body is
    // never trusted anyway) but warns in production: set REPLICATE_WEBHOOK_SECRET (finalisation master doc, O-8).
    const rawBody = await req.text()
    const secret = process.env.REPLICATE_WEBHOOK_SECRET?.trim()
    if (secret) {
      const valid = verifyReplicateWebhook({
        secret,
        id: req.headers.get("webhook-id"),
        timestamp: req.headers.get("webhook-timestamp"),
        signature: req.headers.get("webhook-signature"),
        body: rawBody,
      })
      if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    } else if (mustEnforceProductionSecrets()) {
      console.warn("[try-on]", { result: "webhook_unsigned_no_secret_configured" })
    }

    let body: { id?: unknown }
    try {
      body = JSON.parse(rawBody) as { id?: unknown }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const predictionId = typeof body.id === "string" ? body.id.trim() : ""
    if (!predictionId) {
      return NextResponse.json({ error: "Missing prediction id" }, { status: 400 })
    }

    const job = await prisma.tryOnJob.findUnique({
      where: { replicatePredictionId: predictionId },
    })
    if (!job) {
      console.warn("[try-on]", { result: "webhook_unknown_job", predictionId })
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (job.status === "DONE" || job.status === "FAILED") {
      await deleteSelfieBlob(job.inputUrl).catch(() => undefined)
      return NextResponse.json({ ok: true, idempotent: true })
    }

    const status = await getTryOnJobStatus(job.id)

    if (status && (status.status === "done" || status.status === "failed")) {
      await deleteSelfieBlob(job.inputUrl).catch(() => undefined)
    }

    console.log("[try-on]", {
      result: "webhook_refetched",
      jobId: job.id,
      predictionId,
      status: status?.status ?? "unknown",
    })
    return NextResponse.json({ ok: true, status: status?.status ?? "processing" })
  })
}
