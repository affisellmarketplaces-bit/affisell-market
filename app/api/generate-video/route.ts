import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { uploadVideoToVercelBlob } from "@/lib/video-storage"
import { videoLog } from "@/lib/video-logger"
import {
  downloadGcsUri,
  extractVideoBytesFromVeoResponse,
  getVeoConfig,
  pollVeoOperation,
  VeoGenerationError,
  veoPredictLongRunning,
} from "@/lib/veo-video"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const FORMAT = "9:16" as const
const DURATION_SECONDS = 4

function veoErrorStatus(code: VeoGenerationError["code"]): number {
  if (code === "QUOTA_EXCEEDED") return 429
  if (code === "INVALID_PROMPT") return 400
  if (code === "TIMEOUT") return 504
  if (code === "UPLOAD_FAILED") return 503
  return 502
}

function buildPrompt(productName: string, style: string): string {
  return `${style.trim()} product video ad for ${productName.trim()}, vertical 9:16, ${DURATION_SECONDS} seconds, cinematic lighting, no watermark text.`
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const productName =
    body && typeof body === "object" && "productName" in body
      ? String((body as { productName?: unknown }).productName ?? "").trim()
      : ""
  const style =
    body && typeof body === "object" && "style" in body
      ? String((body as { style?: unknown }).style ?? "").trim()
      : ""

  if (!productName) {
    return NextResponse.json({ error: "productName is required." }, { status: 400 })
  }
  if (!style) {
    return NextResponse.json({ error: "style is required." }, { status: 400 })
  }

  const prompt = buildPrompt(productName, style)
  const config = getVeoConfig()

  videoLog.info("generate-video.start", { productName, style, promptLength: prompt.length })

  try {
    const { operationName } = await veoPredictLongRunning(config, {
      instances: [{ prompt }],
      parameters: {
        aspectRatio: FORMAT,
        durationSeconds: DURATION_SECONDS,
        sampleCount: 1,
        generateAudio: false,
      },
    })

    videoLog.info("generate-video.poll", { operationName })

    const donePayload = await pollVeoOperation(operationName, {
      timeoutMs: Number(process.env.VEO_POLL_TIMEOUT_MS ?? 90_000),
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
    const videoUrl = await uploadVideoToVercelBlob(bytes, operationId)

    videoLog.info("generate-video.done", { operationId, videoUrl })

    return NextResponse.json({
      status: "success",
      jobId: operationId,
      videoUrl,
    })
  } catch (e) {
    videoLog.error("generate-video.failed", {
      productName,
      style,
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
