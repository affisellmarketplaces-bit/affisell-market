import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { serializeProductVideo, type MetaVideoFormat } from "@/lib/meta-ai"
import { generateProductAdVideo } from "@/lib/product-video-generation"
import { prisma } from "@/lib/prisma"
import { videoLog } from "@/lib/video-logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const FORMATS = new Set<MetaVideoFormat>(["9:16", "1:1", "16:9"])

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: productId } = await context.params
  const body = (await req.json()) as { prompt?: string; format?: string }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const formatRaw = typeof body.format === "string" ? body.format.trim() : "9:16"
  const format = FORMATS.has(formatRaw as MetaVideoFormat) ? (formatRaw as MetaVideoFormat) : "9:16"

  if (prompt.length < 8) {
    return NextResponse.json({ error: "Prompt must be at least 8 characters." }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId: session.user.id },
    include: {
      attributes: { orderBy: { label: "asc" } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!product.images?.length) {
    return NextResponse.json({ error: "Add at least one product image before generating a video." }, { status: 400 })
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
    videoLog.error("generate-video.failed", {
      productId,
      error: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Video generation failed" },
      { status: 502 }
    )
  }
}
