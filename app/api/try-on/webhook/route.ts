import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import {
  deleteSelfieBlob,
  extractOutputUrl,
} from "@/lib/try-on/cloth2body-api.server"
import { finalizeTryOnJobWithOutput } from "@/lib/try-on/try-on-service.server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReplicateWebhookBody = {
  id?: string
  status?: string
  output?: unknown
  error?: string | null
}

export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    const secret = process.env.REPLICATE_WEBHOOK_SECRET?.trim()
    if (secret) {
      const provided =
        req.headers.get("webhook-id") ??
        req.headers.get("x-replicate-signature") ??
        req.headers.get("authorization")
      if (!provided) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    let body: ReplicateWebhookBody
    try {
      body = (await req.json()) as ReplicateWebhookBody
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const predictionId = body.id?.trim()
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

    const latencyMs =
      job.createdAt != null ? Date.now() - job.createdAt.getTime() : null

    if (body.status === "succeeded") {
      const outputUrl = extractOutputUrl(body.output)
      if (!outputUrl) {
        await finalizeTryOnJobWithOutput({
          jobId: job.id,
          outputUrl: "",
          latencyMs,
          failed: true,
          errorMessage: "Webhook succeeded without output URL",
        })
      } else {
        await finalizeTryOnJobWithOutput({
          jobId: job.id,
          outputUrl,
          latencyMs,
        })
      }

      await deleteSelfieBlob(job.inputUrl)
      console.log("[try-on]", { result: "webhook_done", jobId: job.id, predictionId, latencyMs })
      return NextResponse.json({ ok: true })
    }

    if (body.status === "failed" || body.status === "canceled") {
      const errMsg =
        typeof body.error === "string" ? body.error : "Replicate prediction failed"

      await finalizeTryOnJobWithOutput({
        jobId: job.id,
        outputUrl: "",
        latencyMs,
        failed: true,
        errorMessage: errMsg,
      })

      await deleteSelfieBlob(job.inputUrl)
      console.log("[try-on]", { result: "webhook_failed", jobId: job.id, predictionId, errMsg })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, status: body.status ?? "processing" })
  })
}
