import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { completeProductVideoJob, failProductVideoJob } from "@/lib/product-video-completion"
import { authorizeMetaWebhookRequest } from "@/lib/meta-ai-webhook"
import { prisma } from "@/lib/prisma"
import { videoLog } from "@/lib/video-logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type WebhookBody = {
  jobId?: string
  productId?: string
  videoUrl?: string
  thumbnailUrl?: string
  status?: string
  error?: string
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature =
    req.headers.get("x-meta-signature") ?? req.headers.get("x-hub-signature-256")

  const authResult = authorizeMetaWebhookRequest(rawBody, signature)
  if (authResult === "missing_prod") {
    videoLog.warn("meta.webhook.secret_not_configured")
    return NextResponse.json({ error: "webhook_secret_not_configured" }, { status: 503 })
  }
  if (authResult === "unauthorized") {
    videoLog.warn("meta.webhook.unauthorized")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = JSON.parse(rawBody) as WebhookBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const jobId = body.jobId?.trim()
  const productId = body.productId?.trim()
  const videoUrl = body.videoUrl?.trim()
  const thumbnailUrl = body.thumbnailUrl?.trim()
  const failed = body.status === "failed" || Boolean(body.error)

  const job = jobId
    ? await prisma.videoGenerationJob.findFirst({ where: { jobId } })
    : productId
      ? await prisma.videoGenerationJob.findFirst({
          where: { productId, status: "PROCESSING" },
          orderBy: { createdAt: "desc" },
        })
      : null

  if (!job && !productId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const resolvedProductId = productId || job?.productId
  if (!resolvedProductId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (failed || !videoUrl) {
    await failProductVideoJob(resolvedProductId, jobId ?? job?.jobId)
    return NextResponse.json({ success: true, status: "FAILED" })
  }

  await completeProductVideoJob({
    productId: resolvedProductId,
    jobId: jobId ?? job?.jobId,
    videoUrl,
    thumbnailUrl: thumbnailUrl ?? null,
  })

  return NextResponse.json({ success: true, status: "DONE" })
}
