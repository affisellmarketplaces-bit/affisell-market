import "server-only"

import { del, head, put } from "@vercel/blob"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import sharp from "sharp"

import { clientIpFromRequest } from "@/lib/logger"
import {
  mirrorExternalImageToTryOnBlob,
  processTryOnUserImage,
} from "@/lib/try-on/image-processing.server"
import { inferIdmVtonCategory, type IdmVtonCategory } from "@/lib/try-on/infer-idm-vton-category"
import { getTryOnProvider } from "@/lib/try-on/provider-types"
import { prisma } from "@/lib/prisma"

export function isTryOnFeatureEnabledStrict(): boolean {
  return process.env.TRY_ON_ENABLED === "1"
}

let ipLimiter: Ratelimit | null = null

function getIpLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    return null
  }
  if (!ipLimiter) {
    ipLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "tryon:ip",
      analytics: true,
    })
  }
  return ipLimiter
}

export async function enforceTryOnIpRateLimit(req: Request): Promise<
  | { ok: true }
  | { ok: false; status: 429; retryAfterSec: number }
> {
  const limiter = getIpLimiter()
  if (!limiter) {
    console.warn("[try-on]", { result: "rate_limit_skipped", reason: "upstash_not_configured" })
    return { ok: true }
  }
  const ip = clientIpFromRequest(req)
  const result = await limiter.limit(`ip:${ip}`)
  if (result.success) return { ok: true }
  return {
    ok: false,
    status: 429,
    retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  }
}

/** Basic decode + dimension guard before Replicate (face errors mapped from provider). */
export async function validateSelfieHasFace(bytes: Buffer): Promise<
  | { ok: true }
  | { ok: false; message: string }
> {
  try {
    const meta = await sharp(bytes, { failOn: "error" }).metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w < 256 || h < 256) {
      return { ok: false, message: "Photo too small — use a clear upper-body or full-body shot facing the camera." }
    }
    if (w > 8192 || h > 8192) {
      return { ok: false, message: "Image dimensions too large." }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: "Invalid image — could not read selfie file." }
  }
}

export async function uploadPrivateSelfie(bytes: Buffer, contentType: string): Promise<{
  url: string
  pathname: string
  downloadUrl: string
}> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured")
  }

  const processed = await processTryOnUserImage(bytes, contentType)
  const date = new Date().toISOString().slice(0, 10)
  const key = `try-on/selfies/${date}/${Date.now()}.webp`

  const putOpts = {
    addRandomSuffix: true,
    contentType: processed.contentType,
    token,
  } as const

  // Most Affisell Blob stores are public-only; private requires a dedicated private store.
  const preferPrivate = process.env.BLOB_TRYON_PRIVATE === "1"
  let blob: Awaited<ReturnType<typeof put>>

  try {
    blob = await put(key, processed.bytes, {
      ...putOpts,
      access: preferPrivate ? "private" : "public",
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const privateRejected =
      preferPrivate ||
      /private/i.test(message) ||
      /access/i.test(message) ||
      /store/i.test(message)

    if (!privateRejected) {
      throw err
    }

    console.log("[try-on]", {
      result: "selfie_upload_public_fallback",
      message,
    })
    blob = await put(key, processed.bytes, {
      ...putOpts,
      access: "public",
    })
  }

  return {
    url: blob.url,
    pathname: blob.pathname,
    downloadUrl: blob.downloadUrl ?? blob.url,
  }
}

export async function presignedSelfieUrlForReplicate(blobUrl: string): Promise<string> {
  if (blobUrl.includes(".public.blob.vercel-storage.com")) {
    return blobUrl
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured")
  }
  const meta = await head(blobUrl, { token })
  return meta.downloadUrl
}

function replicateErrorText(err: unknown): string {
  const parts: string[] = []
  if (err instanceof Error) {
    parts.push(err.message)
    const extra = err as Error & {
      response?: { status?: number; data?: unknown }
      status?: number
    }
    if (extra.status) parts.push(String(extra.status))
    if (extra.response?.status) parts.push(String(extra.response.status))
    if (extra.response?.data != null) {
      try {
        parts.push(JSON.stringify(extra.response.data))
      } catch {
        /* ignore */
      }
    }
  } else {
    parts.push(String(err))
  }
  return parts.join(" ").toLowerCase()
}

export function mapReplicateError(err: unknown): { status: number; message: string } {
  const msg = replicateErrorText(err)

  if (
    msg.includes("insufficient credit") ||
    msg.includes("payment required") ||
    msg.includes("payment method") ||
    msg.includes("billing") ||
    msg.includes("out of credits") ||
    msg.includes("402")
  ) {
    return {
      status: 402,
      message:
        "Replicate billing required — add credits or a payment method at replicate.com/account/billing.",
    }
  }

  if (
    msg.includes("rate limit") ||
    msg.includes("throttled") ||
    msg.includes("too many requests") ||
    msg.includes('"status":429') ||
    msg.includes(" 429 ")
  ) {
    return {
      status: 429,
      message: "Try-on is busy — wait a few seconds and try again.",
    }
  }

  if (
    msg.includes("face") ||
    msg.includes("no person") ||
    msg.includes("landmark") ||
    (msg.includes("human") && msg.includes("detect"))
  ) {
    return { status: 400, message: "No face or body detected — face the camera with arms visible." }
  }

  if (
    msg.includes("invalid version") ||
    msg.includes("not permitted") ||
    msg.includes("does not exist") ||
    msg.includes("unprocessable entity")
  ) {
    return { status: 502, message: "Try-on model unavailable — contact support." }
  }

  if (
    msg.includes("replicate_api_token") ||
    msg.includes("not configured") ||
    msg.includes("unauthorized") ||
    msg.includes("unauthenticated") ||
    msg.includes(" 401 ")
  ) {
    return { status: 503, message: "Try-on AI is not configured (check REPLICATE_API_TOKEN on Vercel)." }
  }

  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out")) {
    return { status: 504, message: "Try-on provider timed out — please retry." }
  }

  if (msg.includes("failed to fetch image") || msg.includes("failed to fetch")) {
    return { status: 400, message: "Could not load garment image — upload a PNG flat-lay in supplier dashboard." }
  }

  const isPreview =
    process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development"
  if (isPreview && msg.length > 0) {
    const snippet = msg.replace(/\s+/g, " ").slice(0, 140)
    return { status: 502, message: `Try-on provider error (${snippet})` }
  }

  return { status: 502, message: "Try-on provider error" }
}

export async function resolveGarmentUrlForReplicate(
  garmentUrl: string,
  productId: string
): Promise<string> {
  try {
    const mirrored = await mirrorExternalImageToTryOnBlob({
      sourceUrl: garmentUrl,
      folder: "garments",
      keySuffix: `garment-${productId}`,
    })
    console.log("[try-on]", {
      result: "garment_mirrored",
      productId,
      sourceHost: new URL(garmentUrl).hostname,
    })
    return mirrored
  } catch (err) {
    console.error("[try-on]", {
      result: "garment_mirror_failed",
      productId,
      message: err instanceof Error ? err.message : String(err),
    })
    throw new Error(
      `Failed to fetch garment image (${err instanceof Error ? err.message : "unknown error"})`
    )
  }
}

export function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : "https://affisell.com"
}

export async function startCloth2BodyPrediction(input: {
  req: Request
  humanImgUrl: string
  garmentUrl: string
  selfieBlobUrl: string
  garmentUrlStored: string
  productId: string
  productName: string
  garmentCategory: IdmVtonCategory
  ipHash: string
}): Promise<{ predictionId: string; jobId: string }> {
  const provider = await getTryOnProvider()
  const webhookUrl = `${appOrigin(input.req)}/api/try-on/webhook`

  const job = await prisma.tryOnJob.create({
    data: {
      status: "PROCESSING",
      productId: input.productId,
      inputUrl: input.selfieBlobUrl,
      garmentUrl: input.garmentUrlStored,
      ipHash: input.ipHash,
      modelVersion: provider.modelVersion,
      gdprConsentAt: new Date(),
    },
  })

  try {
    const started = await provider.startPrediction(
      {
        humanImageUrl: input.humanImgUrl,
        garmentImageUrl: input.garmentUrl,
        garmentDescription: `front of ${input.productName}`,
        angle: "front",
        category: input.garmentCategory,
      },
      webhookUrl
    )

    await prisma.tryOnJob.update({
      where: { id: job.id },
      data: { replicatePredictionId: started.externalJobId },
    })

    console.log("[try-on]", {
      result: "idm_vton_started",
      jobId: job.id,
      predictionId: started.externalJobId,
      model: started.modelVersion,
      category: input.garmentCategory,
    })

    return { predictionId: started.externalJobId, jobId: job.id }
  } catch (err) {
    await prisma.tryOnJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Replicate start failed",
        completedAt: new Date(),
      },
    })
    await deleteSelfieBlob(input.selfieBlobUrl).catch(() => undefined)
    throw err
  }
}

export async function deleteSelfieBlob(url: string): Promise<void> {
  if (!url.includes("blob.vercel-storage.com")) return
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  await del(url, token ? { token } : undefined)
  console.log("[try-on]", { result: "selfie_deleted", url: url.split("?")[0] })
}

export async function findProductForGarmentUrl(garmentUrl: string) {
  return prisma.product.findFirst({
    where: {
      tryOnEnabled: true,
      tryOnGarmentUrl: garmentUrl.trim(),
      active: true,
      isDraft: false,
    },
    select: {
      id: true,
      name: true,
      tryOnGarmentUrl: true,
      categories: true,
      category: { select: { fullPath: true } },
    },
  })
}

export function extractOutputUrl(output: unknown): string | null {
  if (typeof output === "string" && output.startsWith("http")) return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === "string" && item.startsWith("http")) return item
    }
  }
  return null
}
