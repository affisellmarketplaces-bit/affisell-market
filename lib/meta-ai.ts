import { prisma } from "@/lib/prisma"
import { signMetaWebhookPayload } from "@/lib/meta-ai-webhook"

export type MetaVideoFormat = "9:16" | "1:1" | "16:9"

export type MetaProductPayload = {
  id: string
  name: string
  description: string
  images: string[]
  attributes: Array<{ key: string; label: string; value: string }>
  base_price_cents: number
  format: MetaVideoFormat
}

export type MetaVideoCreateResult = {
  jobId: string
  videoJobId: string
}

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel}`
  return "http://localhost:3000"
}

export function metaAiWebhookUrl(): string {
  return `${appBaseUrl()}/api/webhooks/meta-ai-complete`
}

/** Call Meta AI video API (or dev mock when `META_AI_API_KEY` is unset). */
export async function requestMetaAiVideoGeneration(args: {
  productData: MetaProductPayload
  images: string[]
  userPrompt: string
  format: MetaVideoFormat
  webhookUrl: string
}): Promise<{ jobId: string }> {
  const apiKey = process.env.META_AI_API_KEY?.trim()
  const baseUrl = (process.env.META_AI_API_BASE_URL ?? "https://api.meta.ai/v1").replace(/\/$/, "")

  if (!apiKey) {
    const jobId = `mock_${cryptoRandomId()}`
    void scheduleMockMetaCompletion({
      jobId,
      productId: args.productData.id,
      images: args.images,
      webhookUrl: args.webhookUrl,
    })
    return { jobId }
  }

  const res = await fetch(`${baseUrl}/video`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_data: args.productData,
      images: args.images,
      user_prompt: args.userPrompt,
      format: args.format,
      webhook_url: args.webhookUrl,
    }),
  })

  const json = (await res.json().catch(() => ({}))) as { job_id?: string; jobId?: string; error?: string }
  if (!res.ok) {
    throw new Error(json.error ?? `Meta AI video request failed (${res.status})`)
  }

  const jobId = (json.jobId ?? json.job_id)?.trim()
  if (!jobId) throw new Error("Meta AI did not return a job id")
  return { jobId }
}

function cryptoRandomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

async function scheduleMockMetaCompletion(args: {
  jobId: string
  productId: string
  images: string[]
  webhookUrl: string
}) {
  const delayMs = Number(process.env.META_AI_MOCK_DELAY_MS ?? 8_000)
  await new Promise((r) => setTimeout(r, Number.isFinite(delayMs) ? delayMs : 8_000))

  const videoUrl =
    process.env.META_AI_MOCK_VIDEO_URL?.trim() ||
    "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  const thumbnailUrl = args.images[0] ?? null

  const body = JSON.stringify({
    jobId: args.jobId,
    productId: args.productId,
    videoUrl,
    thumbnailUrl,
    status: "completed",
  })

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const secret = process.env.META_WEBHOOK_SECRET?.trim()
  if (secret) {
    headers["x-meta-signature"] = signMetaWebhookPayload(body, secret)
  } else {
    const parsed = JSON.parse(body) as Record<string, unknown>
    parsed.secret = "dev"
    await fetch(args.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    })
    return
  }

  await fetch(args.webhookUrl, { method: "POST", headers, body })
}

export async function createProductVideoJob(args: {
  productId: string
  prompt: string
  format: MetaVideoFormat
  jobId: string
}) {
  return prisma.videoGenerationJob.create({
    data: {
      productId: args.productId,
      prompt: args.prompt,
      format: args.format,
      jobId: args.jobId,
      status: "PROCESSING",
    },
  })
}

export function serializeProductVideo(job: {
  id: string
  jobId: string | null
  productId: string
  prompt: string
  format: string
  status: string
  videoUrl: string | null
  thumbnailUrl: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: job.id,
    jobId: job.jobId,
    productId: job.productId,
    prompt: job.prompt,
    format: job.format,
    status: job.status,
    videoUrl: job.videoUrl,
    thumbnailUrl: job.thumbnailUrl,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  }
}
