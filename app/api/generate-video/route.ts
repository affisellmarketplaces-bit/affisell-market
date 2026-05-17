import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { uploadVideoToVercelBlob } from "@/lib/video-storage"
import { videoLog } from "@/lib/video-logger"
import {
  fetchUserVideoQuota,
  incrementVideoCount,
  isQuotaExceeded,
  paywallResponse,
  quotaSnapshot,
} from "@/lib/video-quota"
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

function quotaJson(snapshot: ReturnType<typeof quotaSnapshot>) {
  return {
    videoCount: snapshot.videoCount,
    videoLimit: snapshot.videoLimit,
    remaining: snapshot.remaining,
    isPro: snapshot.isPro,
    // legacy fields for existing UI
    videoQuota: snapshot.isPro ? snapshot.videoLimit : snapshot.videoLimit,
    videoUsed: snapshot.videoCount,
  }
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

  const quotaRow = await fetchUserVideoQuota(session.user.id)
  if (!quotaRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId: session.user.id },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  // 1. Quota gate before any Veo work (including regenerate)
  if (isQuotaExceeded(quotaRow.user)) {
    videoLog.warn("generate-video.quota", { userId: session.user.id, videoCount: quotaRow.user.videoCount })
    return paywallResponse()
  }

  const prompt = buildPrompt(productName, style)

  if (regenerate) {
    await prisma.productVideo.deleteMany({ where: { productId } })
    videoLog.info("generate-video.regenerate", { productId, userId: session.user.id })
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
        ...quotaJson(quotaRow.snapshot),
      })
    }
  }

  const config = getVeoConfig()
  videoLog.info("generate-video.start", {
    productId,
    productName,
    style,
    regenerate,
    userId: session.user.id,
    videoCount: quotaRow.user.videoCount,
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

    // 3. Persist video then increment count only after successful generation
    await prisma.productVideo.create({
      data: {
        productId,
        videoUrl,
        jobId,
        prompt,
        style,
      },
    })

    const snapshot = await incrementVideoCount(session.user.id)

    videoLog.info("generate-video.done", {
      productId,
      jobId,
      videoUrl,
      videoCount: snapshot.videoCount,
    })

    return NextResponse.json({
      status: "success",
      videoUrl,
      jobId,
      style,
      cached: false,
      ...quotaJson(snapshot),
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
