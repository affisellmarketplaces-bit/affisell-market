import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { verifyMetaWebhookSignature } from "@/lib/meta-ai-webhook"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type WebhookBody = {
  jobId?: string
  productId?: string
  videoUrl?: string
  thumbnailUrl?: string
  status?: string
  error?: string
  secret?: string
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let body: WebhookBody
  try {
    body = JSON.parse(rawBody) as WebhookBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const secret = process.env.META_WEBHOOK_SECRET?.trim()
  const signature =
    req.headers.get("x-meta-signature") ?? req.headers.get("x-hub-signature-256")

  if (secret) {
    const sigOk = verifyMetaWebhookSignature(rawBody, signature, secret)
    const legacyOk = body.secret === secret
    if (!sigOk && !legacyOk) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
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

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const resolvedProductId = productId || job.productId

  if (failed || !videoUrl) {
    await prisma.$transaction([
      prisma.videoGenerationJob.update({
        where: { id: job.id },
        data: { status: "FAILED" },
      }),
      prisma.product.update({
        where: { id: resolvedProductId },
        data: { videoAdStatus: "failed" },
      }),
    ])
    return NextResponse.json({ success: true, status: "FAILED" })
  }

  const product = await prisma.product.findUnique({
    where: { id: resolvedProductId },
    select: { id: true, supplierId: true, name: true },
  })

  await prisma.videoGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "DONE",
      videoUrl,
      thumbnailUrl: thumbnailUrl ?? undefined,
    },
  })
  await prisma.product.update({
    where: { id: resolvedProductId },
    data: {
      videoAdUrl: videoUrl,
      videoAdStatus: "ready",
    },
  })
  if (product) {
    await prisma.notification.create({
      data: {
        userId: product.supplierId,
        type: "VIDEO_AD_READY",
        message: `Ta pub vidéo est prête pour « ${product.name.slice(0, 80)} ».`,
        imageUrl: thumbnailUrl ?? null,
      },
    })
  }

  return NextResponse.json({ success: true, status: "DONE" })
}
