import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

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

function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === "string" && item.startsWith("http")) return item
    }
  }
  return null
}

export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    const secret = process.env.REPLICATE_WEBHOOK_SECRET?.trim()
    if (secret) {
      const provided = req.headers.get("webhook-id") ?? req.headers.get("x-replicate-signature")
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
      return NextResponse.json({ ok: true, idempotent: true })
    }

    if (body.status === "succeeded") {
      const outputUrl = extractOutputUrl(body.output)
      if (!outputUrl) {
        await finalizeTryOnJobWithOutput({
          jobId: job.id,
          outputUrl: "",
          latencyMs: null,
          failed: true,
          errorMessage: "Webhook succeeded without output URL",
        })
        return NextResponse.json({ ok: true })
      }

      const latencyMs =
        job.createdAt != null ? Date.now() - job.createdAt.getTime() : null

      await finalizeTryOnJobWithOutput({
        jobId: job.id,
        outputUrl,
        latencyMs,
      })
      return NextResponse.json({ ok: true })
    }

    if (body.status === "failed" || body.status === "canceled") {
      await finalizeTryOnJobWithOutput({
        jobId: job.id,
        outputUrl: "",
        latencyMs: null,
        failed: true,
        errorMessage: typeof body.error === "string" ? body.error : "Replicate prediction failed",
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, status: body.status ?? "processing" })
  })
}
