/**
 * @deprecated Legacy Meta / multi-format video path. New generations use POST /api/generate-video.
 * Kept for reference and optional VIDEO_API_PROVIDER=meta reinstatement.
 */
import { NextResponse } from "next/server"

import { serializeProductVideo, type MetaVideoFormat } from "@/lib/meta-ai"
import { generateProductAdVideo } from "@/lib/product-video-generation"
import { prisma } from "@/lib/prisma"
import {
  fetchUserVideoQuota,
  incrementVideoCount,
  isQuotaExceeded,
  paywallResponse,
} from "@/lib/video-quota"
import { VeoGenerationError } from "@/lib/veo-video"
import { videoLog } from "@/lib/video-logger"

const FORMATS = new Set<MetaVideoFormat>(["9:16", "1:1", "16:9"])

function veoErrorStatus(code: VeoGenerationError["code"]): number {
  if (code === "QUOTA_EXCEEDED") return 429
  if (code === "INVALID_PROMPT") return 400
  if (code === "TIMEOUT") return 504
  if (code === "UPLOAD_FAILED") return 503
  return 502
}

export async function handleProductVideoGenerate(args: {
  supplierId: string
  productId: string
  prompt: string
  format: MetaVideoFormat
}) {
  const { supplierId, productId, prompt, format } = args

  if (prompt.length < 8) {
    return NextResponse.json({ error: "Prompt must be at least 8 characters." }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    include: { attributes: { orderBy: { label: "asc" } } },
  })

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!product.images?.length) {
    return NextResponse.json(
      { error: "Add at least one product image before generating a video." },
      { status: 400 }
    )
  }

  const quotaRow = await fetchUserVideoQuota(supplierId)
  if (!quotaRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (isQuotaExceeded(quotaRow.user)) {
    videoLog.warn("video.generate.quota", { supplierId, videoCount: quotaRow.user.videoCount })
    return paywallResponse()
  }

  const images = product.images.filter((u) => typeof u === "string" && u.trim()).slice(0, 8)
  const productData = {
    id: product.id,
    name: product.name,
    description: product.description,
    images,
    attributes: product.attributes.map((a) => ({
      key: a.key,
      label: a.label,
      value: a.value,
    })),
    base_price_cents: product.basePriceCents,
    format,
  }

  try {
    await prisma.product.update({
      where: { id: product.id },
      data: { videoAdStatus: "generating", videoAdPrompt: prompt },
    })

    const result = await generateProductAdVideo({
      productId: product.id,
      prompt,
      format,
      productData,
      images,
    })

    if (result.mode === "sync") {
      await incrementVideoCount(supplierId)

      const job = await prisma.videoGenerationJob.findFirst({
        where: { productId: product.id, jobId: result.jobId },
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({
        jobId: result.jobId,
        status: "success",
        videoUrl: result.videoUrl,
        video: job ? serializeProductVideo(job) : null,
      })
    }

    const job = await prisma.videoGenerationJob.findFirst({
      where: { productId: product.id, jobId: result.jobId },
    })

    return NextResponse.json({
      jobId: result.jobId,
      status: "PROCESSING",
      video: job ? serializeProductVideo(job) : null,
    })
  } catch (e) {
    videoLog.error("video.generate.failed", {
      productId,
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

export function parseVideoGenerateBody(body: unknown): {
  productId: string
  prompt: string
  format: MetaVideoFormat
} | null {
  if (!body || typeof body !== "object") return null
  const b = body as { productId?: string; prompt?: string; format?: string }
  const productId = typeof b.productId === "string" ? b.productId.trim() : ""
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : ""
  const formatRaw = typeof b.format === "string" ? b.format.trim() : "9:16"
  const format = FORMATS.has(formatRaw as MetaVideoFormat) ? (formatRaw as MetaVideoFormat) : "9:16"
  if (!productId) return null
  return { productId, prompt, format }
}
