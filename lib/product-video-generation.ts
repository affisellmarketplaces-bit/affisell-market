import {
  createProductVideoJob,
  metaAiWebhookUrl,
  requestMetaAiVideoGeneration,
  type MetaProductPayload,
  type MetaVideoFormat,
} from "@/lib/meta-ai"
import { completeProductVideoJob, failProductVideoJob } from "@/lib/product-video-completion"
import { prisma } from "@/lib/prisma"
import { generateVeoProductVideo } from "@/lib/veo-video"
import { videoLog } from "@/lib/video-logger"

export type VideoApiProvider = "veo" | "meta" | "mock"

export function getVideoApiProvider(): VideoApiProvider {
  const raw = (process.env.VIDEO_API_PROVIDER ?? "veo").trim().toLowerCase()
  if (raw === "meta") return "meta"
  if (raw === "mock") return "mock"
  return "veo"
}

export type GenerateProductVideoInput = {
  productId: string
  prompt: string
  format: MetaVideoFormat
  productData: MetaProductPayload
  images: string[]
}

export type GenerateProductVideoResult =
  | {
      mode: "async"
      jobId: string
      status: "PROCESSING"
    }
  | {
      mode: "sync"
      jobId: string
      status: "success"
      videoUrl: string
      thumbnailUrl: string | null
    }

export async function generateProductAdVideo(
  input: GenerateProductVideoInput
): Promise<GenerateProductVideoResult> {
  const provider = getVideoApiProvider()
  videoLog.info("video.generate.start", { provider, productId: input.productId })

  if (provider === "veo") {
    const thumbnailUrl = input.images[0] ?? null
    const job = await createProductVideoJob({
      productId: input.productId,
      prompt: input.prompt,
      format: input.format,
      jobId: `veo_pending_${Date.now()}`,
    })

    try {
      const result = await generateVeoProductVideo({
        productId: input.productId,
        userPrompt: input.prompt,
        format: input.format,
        product: {
          name: input.productData.name,
          description: input.productData.description,
          attributes: input.productData.attributes,
        },
        thumbnailUrl,
        timeoutMs: Number(process.env.VEO_TIMEOUT_MS ?? 60_000),
      })

      await prisma.videoGenerationJob.update({
        where: { id: job.id },
        data: { jobId: result.jobId, status: "PROCESSING" },
      })

      await completeProductVideoJob({
        productId: input.productId,
        jobId: result.jobId,
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
      })

      return {
        mode: "sync",
        jobId: result.jobId,
        status: "success",
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
      }
    } catch (e) {
      await failProductVideoJob(input.productId, job.jobId)
      throw e
    }
  }

  const { jobId } = await requestMetaAiVideoGeneration({
    productData: input.productData,
    images: input.images,
    userPrompt: input.prompt,
    format: input.format,
    webhookUrl: metaAiWebhookUrl(),
  })

  await createProductVideoJob({
    productId: input.productId,
    prompt: input.prompt,
    format: input.format,
    jobId,
  })

  return { mode: "async", jobId, status: "PROCESSING" }
}
