import * as Sentry from "@sentry/nextjs"
import { NextResponse } from "next/server"

import {
  enforceTryOnIpRateLimit,
  findProductForGarmentUrl,
  isTryOnFeatureEnabledStrict,
  mapReplicateError,
  presignedSelfieUrlForReplicate,
  resolveGarmentUrlForReplicate,
  startCloth2BodyPrediction,
  uploadPrivateSelfie,
  validateSelfieHasFace,
} from "@/lib/try-on/cloth2body-api.server"
import { inferIdmVtonCategory } from "@/lib/try-on/infer-idm-vton-category"
import { hashClientIp } from "@/lib/try-on/result-hash"
import { getTryOnJobStatus } from "@/lib/try-on/try-on-service.server"
import { clientIpFromRequest } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 10

const MAX_SELFIE_BYTES = 8 * 1024 * 1024

function disabledResponse() {
  return NextResponse.json({ error: "Feature disabled" }, { status: 503 })
}

/** Poll async job by Replicate prediction id or internal job id. */
export async function GET(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    if (!isTryOnFeatureEnabledStrict()) {
      return disabledResponse()
    }

    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")?.trim()
    const predictionId = url.searchParams.get("prediction_id")?.trim()

    if (!jobId && !predictionId) {
      return NextResponse.json({ error: "jobId or prediction_id required" }, { status: 400 })
    }

    if (jobId) {
      const status = await getTryOnJobStatus(jobId)
      if (!status) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 })
      }
      return NextResponse.json(status)
    }

    const { prisma } = await import("@/lib/prisma")
    const job = await prisma.tryOnJob.findUnique({
      where: { replicatePredictionId: predictionId },
      include: { tryOn: true },
    })
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    const status = await getTryOnJobStatus(job.id)
    return NextResponse.json(
      status ?? {
        prediction_id: predictionId,
        jobId: job.id,
        status: job.status === "DONE" ? "done" : job.status === "FAILED" ? "failed" : "processing",
        outputUrl: job.outputUrl ?? undefined,
      }
    )
  })
}

/**
 * POST multipart/form-data
 * - selfie: File (shopper photo)
 * - garment_url: string (transparent PNG flat-lay URL)
 */
export async function POST(req: Request) {
  return Sentry.withScope(async (scope) => {
    scope.setTag("feature", "tryon")
    scope.setTag("model", "idm-vton")

    if (!isTryOnFeatureEnabledStrict()) {
      return disabledResponse()
    }

    const limited = await enforceTryOnIpRateLimit(req)
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      )
    }

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 })
    }

    const selfie = form.get("selfie")
    const garmentUrl = String(form.get("garment_url") ?? "").trim()

    if (!(selfie instanceof File) || selfie.size === 0) {
      return NextResponse.json({ error: "selfie file is required" }, { status: 400 })
    }
    if (!garmentUrl || !garmentUrl.startsWith("http")) {
      return NextResponse.json({ error: "garment_url must be a valid HTTPS URL" }, { status: 400 })
    }
    if (!selfie.type.startsWith("image/")) {
      return NextResponse.json({ error: "selfie must be an image" }, { status: 400 })
    }
    if (selfie.size > MAX_SELFIE_BYTES) {
      return NextResponse.json({ error: "selfie must be under 8 MB" }, { status: 400 })
    }

    const product = await findProductForGarmentUrl(garmentUrl)
    if (!product) {
      return NextResponse.json(
        { error: "No active try-on listing matches this garment_url" },
        { status: 400 }
      )
    }

    const bytes = Buffer.from(await selfie.arrayBuffer())
    const faceCheck = await validateSelfieHasFace(bytes)
    if (!faceCheck.ok) {
      return NextResponse.json({ error: faceCheck.message }, { status: 400 })
    }

    let selfieBlob: Awaited<ReturnType<typeof uploadPrivateSelfie>>
    try {
      selfieBlob = await uploadPrivateSelfie(bytes, selfie.type)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[try-on]", {
        result: "selfie_upload_failed",
        message,
      })
      if (message.includes("BLOB_READ_WRITE_TOKEN")) {
        return NextResponse.json({ error: "Try-on storage is not configured" }, { status: 503 })
      }
      return NextResponse.json({ error: "Failed to store selfie" }, { status: 500 })
    }

    let humanImgForReplicate: string
    try {
      humanImgForReplicate = await presignedSelfieUrlForReplicate(selfieBlob.url)
    } catch {
      humanImgForReplicate = selfieBlob.downloadUrl
    }

    const ipHash = hashClientIp(clientIpFromRequest(req))

    let garmentForReplicate: string
    try {
      garmentForReplicate = await resolveGarmentUrlForReplicate(garmentUrl, product.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[try-on]", { result: "garment_resolve_failed", message })
      return NextResponse.json(
        { error: mapReplicateError(err).message },
        { status: mapReplicateError(err).status }
      )
    }

    try {
      const { predictionId, jobId } = await startCloth2BodyPrediction({
        req,
        humanImgUrl: humanImgForReplicate,
        garmentUrl: garmentForReplicate,
        selfieBlobUrl: selfieBlob.url,
        garmentUrlStored: garmentUrl,
        productId: product.id,
        productName: product.name,
        garmentCategory: inferIdmVtonCategory({
          productName: product.name,
          legacyCategories: product.categories,
          categoryFullPath: product.category?.fullPath,
        }),
        ipHash,
      })

      return NextResponse.json({
        prediction_id: predictionId,
        jobId,
        status: "processing" as const,
      })
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err)
      const mapped = mapReplicateError(err)
      console.error("[try-on]", {
        result: "idm_vton_start_failed",
        status: mapped.status,
        message: mapped.message,
        rawMessage,
      })
      return NextResponse.json(
        { error: mapped.message },
        {
          status: mapped.status,
          ...(mapped.retryAfterSec
            ? { headers: { "Retry-After": String(mapped.retryAfterSec) } }
            : {}),
        }
      )
    }
  })
}