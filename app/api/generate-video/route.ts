import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { uploadVideoToVercelBlob } from "@/lib/video-storage"
import { videoLog } from "@/lib/video-logger"
import {
  downloadGcsUri,
  extractVideoBytesFromVeoResponse,
  getVeoConfig,
  pollVeoOperation,
  VeoGenerationError,
  veoPredictLongRunning,
} from "@/lib/veo-video"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const FORMAT = "9:16" as const
const DURATION_SECONDS = 4

function veoErrorStatus(code: VeoGenerationError["code"]): number {
  if (code === "QUOTA_EXCEEDED") return 429
  if (code === "INVALID_PROMPT") return 400
  if (code === "TIMEOUT") return 504
  if (code === "UPLOAD_FAILED") return 503
  return 502
}

function buildPrompt(productName: string, style: string): string {
  return `${style.trim()} product video ad for ${productName.trim()}, vertical 9:16, ${DURATION_SECONDS} seconds, cinematic lighting, no watermark text.`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const productId =
    body && typeof body === "object" && "productId" in body
      ? String((body as { productId?: unknown }).productId ?? "").trim()
      : ""
  const productName =
    body && typeof body === "object" && "productName" in body
      ? String((body as { productName?: unknown }).productName ?? "").trim()
      : ""
  const style =
    body && typeof body === "object" && "style" in body
      ? String((body as { style?: unknown }).style ?? "").trim()
      : ""
  const regenerate =
    body && typeof body === "object" && "regenerate" in body
      ? Boolean((body as { regenerate?: unknown }).regenerate)
      : false

  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 })
  }
  if (!productName) {
    return NextResponse.json({ error: "productName is required." }, { status: 400 })
  }
  if (!style) {
    return NextResponse.json({ error: "style is required." }, { status: 400 })
  }

  const [user, product] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, videoQuota: true, videoUsed: true, isPro: true },
    }),
    prisma.product.findFirst({
      where: { id: productId, supplierId: session.user.id },
      select: { id: true },
    }),
  ])

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  if (!user.isPro && user.videoUsed >= user.videoQuota) {
    return NextResponse.json(
      { error: "Quota atteint. Upgrade Pro." },
      { status: 403 }
    )
  }

  const prompt = buildPrompt(productName, style)

  if (regenerate) {
    await prisma.productVideo.deleteMany({ where: { productId } })
    videoLog.info("generate-video.regenerate", { productId, userId: user.id })
  } else {
    const existing = await prisma.productVideo.findUnique({
      where: { productId },
    })

    if (existing) {
      videoLog.info("generate-video.cached", { productId, jobId: existing.jobId })
      return NextResponse.json({
        status: "cached",
        videoUrl: existing.videoUrl,
        jobId: existing.jobId,
        style: existing.style,
        cached: true,
        videoQuota: user.videoQuota,
        videoUsed: user.videoUsed,
        isPro: user.isPro,
      })
    }
  }

  const config = getVeoConfig()
  videoLog.info("generate-video.start", {
    productId,
    productName,
    style,
    regenerate,
    userId: user.id,
  })

  try {
    const { operationName } = await veoPredictLongRunning(config, {
      instances: [{ prompt }],
      parameters: {
        aspectRatio: FORMAT,
        durationSeconds: DURATION_SECONDS,
        sampleCount: 1,
        generateAudio: false,
      },
    })

    videoLog.info("generate-video.poll", { productId, operationName })

    const donePayload = await pollVeoOperation(operationName, {
      timeoutMs: Number(process.env.VEO_POLL_TIMEOUT_MS ?? 90_000),
      intervalMs: 3_000,
    })

    let { bytes, gcsUri } = extractVideoBytesFromVeoResponse(donePayload)
    if (bytes.length === 0 && gcsUri) {
      bytes = await downloadGcsUri(gcsUri)
    }
    if (bytes.length === 0) {
      throw new VeoGenerationError("Veo returned an empty video payload", "VERTEX_ERROR")
    }

    const jobId = operationName.split("/").pop() ?? operationName
    const videoUrl = await uploadVideoToVercelBlob(bytes, jobId)

    const [, updatedUser] = await prisma.$transaction([
      prisma.productVideo.create({
        data: {
          productId,
          videoUrl,
          jobId,
          prompt,
          style,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { videoUsed: { increment: 1 } },
        select: { videoQuota: true, videoUsed: true, isPro: true },
      }),
    ])

    videoLog.info("generate-video.done", { productId, jobId, videoUrl })

    return NextResponse.json({
      status: "success",
      videoUrl,
      jobId,
      style,
      cached: false,
      videoQuota: updatedUser.videoQuota,
      videoUsed: updatedUser.videoUsed,
      isPro: updatedUser.isPro,
    })
  } catch (e) {
    videoLog.error("generate-video.failed", {
      productId,
      productName,
      style,
      error: e instanceof Error ? e.message : String(e),
    })

    if (e instanceof VeoGenerationError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: veoErrorStatus(e.code) }
      )
    }

    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Video generation failed" },
      { status: 502 }
    )
  }
}
