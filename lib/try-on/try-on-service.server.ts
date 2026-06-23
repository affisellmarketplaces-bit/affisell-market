import "server-only"

import * as Sentry from "@sentry/nextjs"
import { del } from "@vercel/blob"

import { prisma } from "@/lib/prisma"
import { inferIdmVtonCategory } from "@/lib/try-on/infer-idm-vton-category"
import { isApparelProduct } from "@/lib/try-on/is-apparel-product"
import { moderateTryOnUserImage } from "@/lib/try-on/moderation.server"
import { getTryOnProvider } from "@/lib/try-on/provider-types"
import { buildTryOnResultHash, hashClientIp } from "@/lib/try-on/result-hash"
import { uploadTryOnBlob, fetchImageBytes } from "@/lib/try-on/image-processing.server"
import type { TryOnCreateBody } from "@/lib/try-on/schemas"
import { TRYON_CONSENT_VERSION } from "@/lib/try-on/try-on-shared"
import { clientIpFromRequest } from "@/lib/logger"

const OUTPUT_RETENTION_DAYS = 30
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function tryOnPlaceholderOutputUrl(): string {
  return (
    process.env.TRY_ON_PLACEHOLDER_URL?.trim() ||
    "https://affisell.com/placeholder-tryon.webp"
  )
}

function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") ?? "https"
  return host ? `${proto}://${host}` : "https://affisell.com"
}

export async function loadTryOnProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      tryOnEnabled: true,
      tryOnGarmentUrl: true,
      active: true,
      isDraft: true,
      categories: true,
      category: { select: { fullPath: true } },
    },
  })
}

export function validateTryOnProduct(product: Awaited<ReturnType<typeof loadTryOnProduct>>) {
  if (!product || !product.active || product.isDraft) {
    return { ok: false as const, error: "Product not found", status: 404 }
  }
  if (!product.tryOnEnabled || !product.tryOnGarmentUrl?.trim()) {
    return { ok: false as const, error: "Try-on is not enabled for this product", status: 403 }
  }
  if (
    !isApparelProduct({
      categoryFullPath: product.category?.fullPath,
      legacyCategories: product.categories,
    })
  ) {
    return { ok: false as const, error: "Try-on is only available for apparel products", status: 400 }
  }
  return { ok: true as const, product }
}

export async function findCachedTryOn(body: TryOnCreateBody) {
  const resultHash = buildTryOnResultHash({
    inputUrl: body.inputUrl,
    productId: body.productId,
    angle: body.angle,
  })
  const cached = await prisma.tryOn.findUnique({
    where: { resultHash },
    include: { job: true },
  })
  if (!cached) return null
  if (cached.createdAt.getTime() + CACHE_TTL_MS < Date.now()) return null
  if (cached.outputExpiresAt.getTime() < Date.now()) return null
  return cached
}

export async function createTryOnJob(input: {
  req: Request
  body: TryOnCreateBody
  userId: string | null
  anonId: string | null
}) {
  if (input.body.consentVersion !== TRYON_CONSENT_VERSION) {
    return { ok: false as const, error: "Consent version mismatch", status: 400 }
  }

  const productCheck = validateTryOnProduct(await loadTryOnProduct(input.body.productId))
  if (!productCheck.ok) {
    return { ok: false as const, error: productCheck.error, status: productCheck.status }
  }
  const product = productCheck.product

  const cached = await findCachedTryOn(input.body)
  if (cached) {
    console.log("[try-on]", { result: "cache_hit", productId: product.id, tryOnId: cached.id })
    return {
      ok: true as const,
      jobId: cached.jobId,
      status: "done" as const,
      outputUrl: cached.outputUrl,
      cached: true,
      latencyMs: cached.latencyMs ?? undefined,
    }
  }

  const moderation = await Sentry.startSpan(
    { name: "try-on.moderation", attributes: { feature: "tryon", model: "idm-vton" } },
    () => moderateTryOnUserImage(input.body.inputUrl)
  )
  if (!moderation.safe) {
    console.log("[try-on]", { result: "moderation_blocked", productId: product.id })
    return { ok: false as const, error: moderation.reason, status: 422 }
  }

  const ipHash = hashClientIp(clientIpFromRequest(input.req))
  const gdprConsentAt = new Date()

  const job = await prisma.tryOnJob.create({
    data: {
      status: "PENDING",
      productId: product.id,
      affiliateProductId: input.body.affiliateProductId ?? null,
      inputUrl: input.body.inputUrl,
      garmentUrl: product.tryOnGarmentUrl!.trim(),
      userId: input.userId,
      anonId: input.anonId,
      ipHash,
      gdprConsentAt,
    },
  })

  const webhookUrl = `${appOrigin(input.req)}/api/try-on/webhook`
  const provider = await getTryOnProvider()

  try {
    const started = await Sentry.startSpan(
      {
        name: "try-on.replicate.start",
        attributes: { feature: "tryon", model: "idm-vton", jobId: job.id },
      },
      () =>
        provider.startPrediction(
          {
            humanImageUrl: input.body.inputUrl,
            garmentImageUrl: product.tryOnGarmentUrl!.trim(),
            garmentDescription: `front of ${product.name}`,
            angle: input.body.angle,
            category: inferIdmVtonCategory({
              productName: product.name,
              legacyCategories: product.categories,
              categoryFullPath: product.category?.fullPath,
            }),
          },
          webhookUrl
        )
    )

    await prisma.tryOnJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING",
        replicatePredictionId: started.externalJobId,
        modelVersion: started.modelVersion,
      },
    })

    console.log("[try-on]", {
      result: "job_started",
      jobId: job.id,
      productId: product.id,
      predictionId: started.externalJobId,
    })

    return {
      ok: true as const,
      jobId: job.id,
      status: "processing" as const,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Try-on provider error"
    console.error("[try-on]", { result: "provider_start_failed", jobId: job.id, message })

    const placeholder = tryOnPlaceholderOutputUrl()
    await finalizeTryOnJobWithOutput({
      jobId: job.id,
      outputUrl: placeholder,
      latencyMs: null,
      failed: true,
      errorMessage: message,
    })

    return {
      ok: true as const,
      jobId: job.id,
      status: "done" as const,
      outputUrl: placeholder,
      fallback: true,
    }
  }
}

export async function finalizeTryOnJobWithOutput(input: {
  jobId: string
  outputUrl: string
  latencyMs: number | null
  failed?: boolean
  errorMessage?: string
}) {
  const job = await prisma.tryOnJob.findUnique({
    where: { id: input.jobId },
    include: { tryOn: true },
  })
  if (!job) return null
  if (job.status === "DONE" && job.tryOn) {
    return job.tryOn
  }

  const resultHash = buildTryOnResultHash({
    inputUrl: job.inputUrl,
    productId: job.productId,
    angle: "front",
  })

  const outputExpiresAt = new Date(Date.now() + OUTPUT_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  let persistedOutputUrl = input.outputUrl
  if (!persistedOutputUrl?.startsWith("http")) {
    persistedOutputUrl = tryOnPlaceholderOutputUrl()
  } else if (!input.failed) {
    try {
      const bytes = await fetchImageBytes(input.outputUrl)
      persistedOutputUrl = await uploadTryOnBlob({
        bytes,
        contentType: "image/webp",
        folder: "outputs",
        keySuffix: input.jobId,
      })
    } catch (err) {
      console.warn("[try-on]", {
        result: "output_mirror_failed",
        jobId: input.jobId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.tryOnJob.update({
      where: { id: input.jobId },
      data: {
        status: input.failed ? "FAILED" : "DONE",
        outputUrl: persistedOutputUrl,
        latencyMs: input.latencyMs,
        errorMessage: input.errorMessage ?? null,
        completedAt: new Date(),
      },
    })

    const existing = await tx.tryOn.findUnique({ where: { resultHash } })
    if (existing) return existing

    return tx.tryOn.create({
      data: {
        jobId: input.jobId,
        userId: job.userId,
        anonId: job.anonId,
        productId: job.productId,
        affiliateProductId: job.affiliateProductId,
        inputUrl: job.inputUrl,
        outputUrl: persistedOutputUrl,
        modelVersion: job.modelVersion,
        latencyMs: input.latencyMs,
        angle: "front",
        resultHash,
        outputExpiresAt,
      },
    })
  })

  console.log("[try-on]", {
    result: input.failed ? "job_failed" : "job_done",
    jobId: input.jobId,
    latencyMs: input.latencyMs,
    tryOnId: updated.id,
  })

  return updated
}

export async function getTryOnJobStatus(jobId: string) {
  const job = await prisma.tryOnJob.findUnique({
    where: { id: jobId },
    include: { tryOn: true },
  })
  if (!job) return null

  if (job.status === "DONE" && job.outputUrl) {
    return {
      jobId: job.id,
      status: "done" as const,
      outputUrl: job.outputUrl,
      latencyMs: job.latencyMs ?? undefined,
      error: job.errorMessage ?? undefined,
    }
  }

  if (job.status === "FAILED") {
    return {
      jobId: job.id,
      status: "failed" as const,
      outputUrl: job.outputUrl ?? tryOnPlaceholderOutputUrl(),
      error: job.errorMessage ?? "Try-on failed",
    }
  }

  if (job.replicatePredictionId) {
    try {
      const provider = await getTryOnProvider()
      const poll = await provider.fetchPrediction(job.replicatePredictionId)
      if (poll.status === "done") {
        await finalizeTryOnJobWithOutput({
          jobId: job.id,
          outputUrl: poll.outputUrl,
          latencyMs: poll.latencyMs ?? null,
        })
        return {
          jobId: job.id,
          status: "done" as const,
          outputUrl: poll.outputUrl,
          latencyMs: poll.latencyMs,
        }
      }
      if (poll.status === "failed") {
        const placeholder = tryOnPlaceholderOutputUrl()
        await finalizeTryOnJobWithOutput({
          jobId: job.id,
          outputUrl: placeholder,
          latencyMs: null,
          failed: true,
          errorMessage: poll.error,
        })
        return {
          jobId: job.id,
          status: "failed" as const,
          outputUrl: placeholder,
          error: poll.error,
        }
      }
    } catch (err) {
      console.warn("[try-on]", {
        result: "poll_error",
        jobId: job.id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    jobId: job.id,
    status: job.status === "PENDING" ? ("pending" as const) : ("processing" as const),
  }
}

export async function runTryOnRetentionCleanup() {
  const now = new Date()
  const inputCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const staleInputs = await prisma.tryOn.findMany({
    where: {
      inputDeletedAt: null,
      createdAt: { lt: inputCutoff },
    },
    select: { id: true, inputUrl: true },
    take: 100,
  })

  let inputsDeleted = 0
  for (const row of staleInputs) {
    try {
      if (row.inputUrl.includes("blob.vercel-storage.com")) {
        await del(row.inputUrl)
      }
      await prisma.tryOn.update({
        where: { id: row.id },
        data: { inputDeletedAt: now },
      })
      inputsDeleted += 1
    } catch (err) {
      console.warn("[try-on]", {
        result: "input_delete_failed",
        tryOnId: row.id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const expiredOutputs = await prisma.tryOn.findMany({
    where: { outputExpiresAt: { lt: now } },
    select: { id: true, outputUrl: true, jobId: true },
    take: 100,
  })

  let outputsDeleted = 0
  for (const row of expiredOutputs) {
    try {
      if (row.outputUrl.includes("blob.vercel-storage.com")) {
        await del(row.outputUrl)
      }
      await prisma.$transaction([
        prisma.tryOn.delete({ where: { id: row.id } }),
        prisma.tryOnJob.delete({ where: { id: row.jobId } }),
      ])
      outputsDeleted += 1
    } catch (err) {
      console.warn("[try-on]", {
        result: "output_delete_failed",
        tryOnId: row.id,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  console.log("[try-on]", { result: "retention_cleanup", inputsDeleted, outputsDeleted })
  return { inputsDeleted, outputsDeleted }
}
