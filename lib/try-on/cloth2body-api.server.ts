import "server-only"

import { del, head, put } from "@vercel/blob"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import Replicate from "replicate"
import sharp from "sharp"

import { clientIpFromRequest } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

const CLOTH2BODY_MODEL =
  process.env.REPLICATE_CLOTH2BODY_MODEL?.trim() || "idanloo/cloth2body"
const CLOTH2BODY_VERSION = process.env.REPLICATE_CLOTH2BODY_VERSION?.trim()

export function isTryOnFeatureEnabledStrict(): boolean {
  return process.env.TRY_ON_ENABLED === "1"
}

let ipLimiter: Ratelimit | null = null

function getIpLimiter(): Ratelimit {
  if (!ipLimiter) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    if (!url || !token) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required")
    }
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
  const ip = clientIpFromRequest(req)
  const result = await getIpLimiter().limit(`ip:${ip}`)
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

  const blob = await put(`try-on/selfies/selfie.jpg`, bytes, {
    access: "private",
    addRandomSuffix: true,
    contentType: contentType || "image/jpeg",
    token,
  })

  const meta = await head(blob.url, { token })
  return {
    url: blob.url,
    pathname: blob.pathname,
    downloadUrl: meta.downloadUrl,
  }
}

export async function presignedSelfieUrlForReplicate(blobUrl: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured")
  }
  const meta = await head(blobUrl, { token })
  return meta.downloadUrl
}

export function mapReplicateError(err: unknown): { status: number; message: string } {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err)
  const msg = raw.toLowerCase()

  if (
    msg.includes("insufficient credit") ||
    msg.includes("payment required") ||
    msg.includes("billing") ||
    msg.includes("out of credits") ||
    msg.includes("402")
  ) {
    return { status: 402, message: "Replicate credits exhausted. Please top up your account." }
  }

  if (
    msg.includes("face") ||
    msg.includes("no person") ||
    msg.includes("landmark") ||
    (msg.includes("human") && msg.includes("detect"))
  ) {
    return { status: 400, message: "No face or body detected — face the camera with arms visible." }
  }

  return { status: 502, message: "Try-on provider error" }
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
  productId: string | null
  ipHash: string
}): Promise<{ predictionId: string; jobId: string }> {
  const token = process.env.REPLICATE_API_TOKEN?.trim()
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN is not configured")
  }

  const replicate = new Replicate({ auth: token })
  const webhookUrl = `${appOrigin(input.req)}/api/try-on/webhook`

  const job = await prisma.tryOnJob.create({
    data: {
      status: "PROCESSING",
      productId: input.productId ?? (await resolveFallbackProductId()),
      inputUrl: input.selfieBlobUrl,
      garmentUrl: input.garmentUrlStored,
      ipHash: input.ipHash,
      modelVersion: CLOTH2BODY_MODEL,
      gdprConsentAt: new Date(),
    },
  })

  let prediction: { id?: string | null }
  try {
    if (CLOTH2BODY_VERSION) {
      prediction = await replicate.predictions.create({
        version: CLOTH2BODY_VERSION,
        input: {
          human_img: input.humanImgUrl,
          garment_img: input.garmentUrl,
        },
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      })
    } else {
      prediction = await replicate.predictions.create({
        model: CLOTH2BODY_MODEL,
        input: {
          human_img: input.humanImgUrl,
          garment_img: input.garmentUrl,
        },
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      })
    }
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

  const predictionId = prediction.id?.trim()
  if (!predictionId) {
    await prisma.tryOnJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: "Missing prediction id", completedAt: new Date() },
    })
    await deleteSelfieBlob(input.selfieBlobUrl).catch(() => undefined)
    throw new Error("Replicate did not return a prediction id")
  }

  await prisma.tryOnJob.update({
    where: { id: job.id },
    data: { replicatePredictionId: predictionId },
  })

  console.log("[try-on]", {
    result: "cloth2body_started",
    jobId: job.id,
    predictionId,
    model: CLOTH2BODY_MODEL,
  })

  return { predictionId, jobId: job.id }
}

async function resolveFallbackProductId(): Promise<string> {
  const row = await prisma.product.findFirst({
    where: { tryOnEnabled: true, active: true, isDraft: false },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  })
  if (!row) {
    throw new Error("No try-on enabled product found for job persistence")
  }
  return row.id
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
    select: { id: true, tryOnGarmentUrl: true },
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
