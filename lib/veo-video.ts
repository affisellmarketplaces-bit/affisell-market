import { acquireVeoRateLimit } from "@/lib/veo-rate-limit"
import { getVeoAccessToken, veoAuthorizedFetch } from "@/lib/veo-auth"
import { uploadVideoToVercelBlob } from "@/lib/video-storage"
import { videoLog } from "@/lib/video-logger"
import type { MetaVideoFormat } from "@/lib/meta-ai"

export { getVeoAccessToken } from "@/lib/veo-auth"

export type VeoGenerateSuccess = {
  status: "success"
  jobId: string
  videoUrl: string
  thumbnailUrl: string | null
}

export type VeoConfig = {
  project: string
  location: string
  modelId: string
}

export type VeoErrorCode =
  | "QUOTA_EXCEEDED"
  | "INVALID_PROMPT"
  | "VERTEX_ERROR"
  | "TIMEOUT"
  | "UPLOAD_FAILED"

export class VeoGenerationError extends Error {
  constructor(
    message: string,
    readonly code: VeoErrorCode,
    readonly status?: number,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "VeoGenerationError"
  }
}

export class VeoHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown
  ) {
    super(message)
    this.name = "VeoHttpError"
  }
}

export function getVeoConfig(): VeoConfig {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim()
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1"
  const modelId = process.env.VEO_MODEL_ID?.trim() || "veo-3.1-generate-001"

  if (!project) throw new Error("Missing GOOGLE_CLOUD_PROJECT")

  return { project, location, modelId }
}

export function veoApiBase(location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1`
}

export function formatToVeoAspectRatio(format: MetaVideoFormat): "9:16" | "16:9" {
  if (format === "9:16") return "9:16"
  if (format === "16:9") return "16:9"
  return "9:16"
}

/** Default 4s; TikTok (9:16) capped at 8s. */
export function resolveVeoDurationSeconds(format: MetaVideoFormat): number {
  const env = Number(process.env.VEO_DURATION_SECONDS ?? 4)
  const base = Number.isFinite(env) ? env : 4
  if (format === "9:16") return Math.min(Math.max(base, 1), 8)
  return Math.min(Math.max(base, 1), 4)
}

export function veoOperationPollUrl(operationName: string): string {
  const name = operationName.replace(/^\//, "").trim()
  return `https://us-central1-aiplatform.googleapis.com/v1/${name}`
}

function veoFetchPredictOperationUrl(config: VeoConfig): string {
  return `${veoApiBase(config.location)}/projects/${config.project}/locations/${config.location}/publishers/google/models/${config.modelId}:fetchPredictOperation`
}

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const err = "error" in body ? (body as { error?: unknown }).error : body
  if (!err || typeof err !== "object") return ""
  const msg = "message" in err ? String((err as { message?: string }).message) : ""
  return msg
}

function classifyVertexFailure(status: number, message: string, body: unknown): VeoGenerationError {
  const lower = message.toLowerCase()
  if (
    status === 429 ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource exhausted")
  ) {
    return new VeoGenerationError(
      "Vertex AI quota exceeded. Try again later or request a quota increase.",
      "QUOTA_EXCEEDED",
      status,
      body
    )
  }
  if (
    (lower.includes("invalid") && lower.includes("prompt")) ||
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("policy")
  ) {
    return new VeoGenerationError(
      "Prompt rejected by Vertex AI. Revise the description and try again.",
      "INVALID_PROMPT",
      status,
      body
    )
  }
  return new VeoGenerationError(message || `Vertex AI error (${status})`, "VERTEX_ERROR", status, body)
}

function classifyOperationError(error: unknown): VeoGenerationError {
  let msg = ""
  if (error && typeof error === "object" && "message" in error) {
    msg = String((error as { message?: string }).message)
  } else {
    msg = JSON.stringify(error).slice(0, 400)
  }
  return classifyVertexFailure(0, msg || "Veo operation failed", error)
}

type VeoPredictBody = {
  instances: Array<{ prompt: string; image?: { gcsUri?: string; bytesBase64Encoded?: string } }>
  parameters: Record<string, unknown>
}

export async function veoPredictLongRunning(
  config: VeoConfig,
  body: VeoPredictBody
): Promise<{ operationName: string; raw: unknown }> {
  await acquireVeoRateLimit()

  const base = veoApiBase(config.location)
  const url = `${base}/projects/${config.project}/locations/${config.location}/publishers/google/models/${config.modelId}:predictLongRunning`

  const res = await veoAuthorizedFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  })

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    const msg = extractErrorMessage(raw) || JSON.stringify(raw).slice(0, 400)
    throw classifyVertexFailure(res.status, msg, raw)
  }

  const operationName =
    typeof raw.name === "string"
      ? raw.name
      : typeof (raw as { operation?: { name?: string } }).operation?.name === "string"
        ? (raw as { operation: { name: string } }).operation.name
        : ""

  if (!operationName) {
    throw new VeoGenerationError("Veo did not return an operation name", "VERTEX_ERROR")
  }

  return { operationName, raw }
}

/** Poll a long-running Veo operation until done (default 90s, every 3s). */
export async function pollVeoOperation(
  operationName: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<unknown> {
  const config = getVeoConfig()
  const timeoutMs = opts.timeoutMs ?? Number(process.env.VEO_POLL_TIMEOUT_MS ?? 90_000)
  const intervalMs = opts.intervalMs ?? 3_000
  const pollUrl = veoOperationPollUrl(operationName)
  const fetchUrl = veoFetchPredictOperationUrl(config)
  const started = Date.now()

  videoLog.info("veo.poll.start", { operationName, pollUrl, fetchUrl })

  while (Date.now() - started < timeoutMs) {
    await acquireVeoRateLimit()

    let res = await veoAuthorizedFetch(pollUrl, { method: "GET", cache: "no-store" })
    let raw = (await res.json().catch(() => ({}))) as Record<string, unknown>

    if (res.status === 404) {
      res = await veoAuthorizedFetch(fetchUrl, {
        method: "POST",
        body: JSON.stringify({ operationName }),
      })
      raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
    }

    if (!res.ok) {
      const msg = extractErrorMessage(raw) || `poll failed (${res.status})`
      throw classifyVertexFailure(res.status, msg, raw)
    }

    if (raw.done === true || raw.done === "true") {
      if (raw.error) {
        throw classifyOperationError(raw.error)
      }
      return raw
    }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new VeoGenerationError(
    `Veo generation timed out after ${timeoutMs / 1000}s`,
    "TIMEOUT"
  )
}

export function extractVideoBytesFromVeoResponse(donePayload: unknown): {
  bytes: Buffer
  gcsUri: string | null
} {
  const root = donePayload as Record<string, unknown>
  const response = (root.response ?? root.result ?? root) as Record<string, unknown>

  const videos =
    (response.generatedVideos as unknown[]) ??
    (response.videos as unknown[]) ??
    []

  const first = videos[0]
  if (!first || typeof first !== "object") {
    throw new VeoGenerationError("Veo response contained no video", "VERTEX_ERROR")
  }

  const row = first as Record<string, unknown>
  const video = (row.video ?? row) as Record<string, unknown>

  const b64 =
    (typeof video.bytesBase64Encoded === "string" && video.bytesBase64Encoded) ||
    (typeof row.bytesBase64Encoded === "string" && row.bytesBase64Encoded) ||
    null

  if (b64) {
    return { bytes: Buffer.from(b64, "base64"), gcsUri: null }
  }

  const uri =
    (typeof video.uri === "string" && video.uri) ||
    (typeof video.gcsUri === "string" && video.gcsUri) ||
    (typeof row.gcsUri === "string" && row.gcsUri) ||
    null

  if (uri?.startsWith("gs://")) {
    return { bytes: Buffer.alloc(0), gcsUri: uri }
  }

  throw new VeoGenerationError("Veo response had no gcsUri or bytesBase64Encoded", "VERTEX_ERROR")
}

export async function downloadGcsUri(gcsUri: string): Promise<Buffer> {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(gcsUri)
  if (!match) throw new Error(`Invalid GCS URI: ${gcsUri}`)

  const [, bucket, objectPath] = match
  const encodedObject = objectPath
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/")

  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedObject}?alt=media`
  const token = await getVeoAccessToken()

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new VeoGenerationError(`Failed to download GCS video (${res.status})`, "VERTEX_ERROR", res.status)
  }

  return Buffer.from(await res.arrayBuffer())
}

export function buildVeoPrompt(userPrompt: string, product: {
  name: string
  description: string
  attributes: Array<{ label: string; value: string }>
}): string {
  const specs = product.attributes
    .slice(0, 12)
    .map((a) => `${a.label}: ${a.value}`)
    .join(", ")
  const desc = product.description.trim().slice(0, 600)
  return [
    userPrompt.trim(),
    `Product: ${product.name.trim()}.`,
    desc ? `Description: ${desc}` : "",
    specs ? `Specs: ${specs}.` : "",
    "Cinematic product ad, professional lighting, no watermark text.",
  ]
    .filter(Boolean)
    .join(" ")
}

export async function generateVeoProductVideo(args: {
  productId: string
  userPrompt: string
  format: MetaVideoFormat
  product: { name: string; description: string; attributes: Array<{ label: string; value: string }> }
  thumbnailUrl?: string | null
  pollTimeoutMs?: number
}): Promise<VeoGenerateSuccess> {
  const config = getVeoConfig()
  const prompt = buildVeoPrompt(args.userPrompt, args.product)
  const aspectRatio = formatToVeoAspectRatio(args.format)
  const durationSeconds = resolveVeoDurationSeconds(args.format)

  videoLog.info("veo.predict.start", {
    productId: args.productId,
    aspectRatio,
    durationSeconds,
  })

  const { operationName } = await veoPredictLongRunning(config, {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      durationSeconds,
      sampleCount: 1,
      generateAudio: false,
    },
  })

  const donePayload = await pollVeoOperation(operationName, {
    timeoutMs: args.pollTimeoutMs ?? Number(process.env.VEO_POLL_TIMEOUT_MS ?? 90_000),
    intervalMs: 3_000,
  })

  let { bytes, gcsUri } = extractVideoBytesFromVeoResponse(donePayload)

  if (bytes.length === 0 && gcsUri) {
    bytes = await downloadGcsUri(gcsUri)
  }

  if (bytes.length === 0) {
    throw new VeoGenerationError("Veo returned an empty video payload", "VERTEX_ERROR")
  }

  const operationId = operationName.split("/").pop() ?? operationName

  let videoUrl: string
  try {
    videoUrl = await uploadVideoToVercelBlob(bytes, operationId)
  } catch (e) {
    throw new VeoGenerationError(
      e instanceof Error ? e.message : "Video upload failed",
      "UPLOAD_FAILED"
    )
  }

  videoLog.info("veo.predict.done", { productId: args.productId, operationName, videoUrl })

  return {
    status: "success",
    jobId: operationId,
    videoUrl,
    thumbnailUrl: args.thumbnailUrl ?? null,
  }
}
