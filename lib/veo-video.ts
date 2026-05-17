import { acquireVeoRateLimit } from "@/lib/veo-rate-limit"
import { getVeoAccessToken, veoAuthorizedFetch } from "@/lib/veo-auth"
import { uploadGeneratedVideo } from "@/lib/video-storage"
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

function operationPollUrl(base: string, operationName: string): string {
  const name = operationName.startsWith("projects/") ? operationName : operationName.replace(/^\//, "")
  return `${base}/${name}`
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
    const msg =
      typeof raw.error === "object" && raw.error && "message" in raw.error
        ? String((raw.error as { message?: string }).message)
        : JSON.stringify(raw).slice(0, 400)
    throw new VeoHttpError(res.status, msg, raw)
  }

  const operationName =
    typeof raw.name === "string"
      ? raw.name
      : typeof (raw as { operation?: { name?: string } }).operation?.name === "string"
        ? (raw as { operation: { name: string } }).operation.name
        : ""

  if (!operationName) {
    throw new Error("Veo did not return an operation name")
  }

  return { operationName, raw }
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

export async function pollVeoOperation(
  config: VeoConfig,
  operationName: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const intervalMs = opts.intervalMs ?? 3_000
  const base = veoApiBase(config.location)
  const url = operationPollUrl(base, operationName)
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    await acquireVeoRateLimit()

    const res = await veoAuthorizedFetch(url, { cache: "no-store" })

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>

    if (!res.ok) {
      const msg =
        typeof raw.error === "object" && raw.error && "message" in raw.error
          ? String((raw.error as { message?: string }).message)
          : `poll failed (${res.status})`
      throw new VeoHttpError(res.status, msg, raw)
    }

    if (raw.done === true || raw.done === "true") {
      if (raw.error) {
        throw new Error(`Veo operation failed: ${JSON.stringify(raw.error).slice(0, 500)}`)
      }
      return raw
    }

    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error(`Veo generation timed out after ${timeoutMs / 1000}s`)
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

  for (const item of videos) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
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
  }

  throw new Error("Veo response contained no video bytes or gcsUri")
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
    throw new Error(`Failed to download GCS video (${res.status})`)
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
  timeoutMs?: number
}): Promise<VeoGenerateSuccess> {
  const config = getVeoConfig()
  const prompt = buildVeoPrompt(args.userPrompt, args.product)
  const aspectRatio = formatToVeoAspectRatio(args.format)
  const durationSeconds = Number(process.env.VEO_DURATION_SECONDS ?? 4)

  videoLog.info("veo.predict.start", {
    productId: args.productId,
    aspectRatio,
    durationSeconds,
  })

  const { operationName } = await veoPredictLongRunning(config, {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 4,
      sampleCount: 1,
      generateAudio: false,
    },
  })

  const donePayload = await pollVeoOperation(config, operationName, {
    timeoutMs: args.timeoutMs ?? 60_000,
    intervalMs: 3_000,
  })

  let { bytes, gcsUri } = extractVideoBytesFromVeoResponse(donePayload)

  if (bytes.length === 0 && gcsUri) {
    bytes = await downloadGcsUri(gcsUri)
  }

  if (bytes.length === 0) {
    throw new Error("Veo returned an empty video payload")
  }

  const operationId = operationName.split("/").pop() ?? operationName
  const videoUrl = await uploadGeneratedVideo(bytes, {
    productId: args.productId,
    jobId: operationId,
  })

  videoLog.info("veo.predict.done", { productId: args.productId, operationName, videoUrl })

  return {
    status: "success",
    jobId: operationId,
    videoUrl,
    thumbnailUrl: args.thumbnailUrl ?? null,
  }
}
