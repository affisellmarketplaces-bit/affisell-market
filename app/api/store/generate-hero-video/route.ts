import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { buildStoreHeroVeoPrompt } from "@/lib/storefront-hero-video-shared"
import { uploadVideoToVercelBlob } from "@/lib/video-storage"
import { videoLog } from "@/lib/video-logger"
import { fetchUserVideoQuota, isQuotaExceeded, paywallResponse, quotaSnapshot } from "@/lib/video-quota"
import { fetchImageAsVeoReference } from "@/lib/veo-reference-image"
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

const HERO_FORMAT = "16:9" as const
const HERO_DURATION_SECONDS = 4

function veoErrorStatus(code: VeoGenerationError["code"]): number {
  if (code === "QUOTA_EXCEEDED") return 429
  if (code === "INVALID_PROMPT") return 400
  if (code === "TIMEOUT") return 504
  if (code === "UPLOAD_FAILED") return 503
  return 502
}

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userId = session.user.id
  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  const quotaRow = await fetchUserVideoQuota(userId)
  if (!quotaRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (isQuotaExceeded(quotaRow.user)) {
    videoLog.warn("generate-hero-video.quota", { userId, videoCount: quotaRow.user.videoCount })
    return paywallResponse()
  }

  const theme = parseStorefrontTheme(store.storefrontTheme)
  const prompt = buildStoreHeroVeoPrompt({
    storeName: store.name,
    description: store.description,
    primary: theme.primary,
    accent: theme.accent,
  })

  videoLog.info("generate-hero-video.start", {
    userId,
    storeSlug: store.slug,
    videoCount: quotaRow.user.videoCount,
  })

  try {
    const config = getVeoConfig()
    const instance: {
      prompt: string
      image?: { bytesBase64Encoded: string; mimeType: string }
    } = { prompt }

    const bannerRef = store.bannerUrl?.trim()
    if (bannerRef && bannerRef.startsWith("https://")) {
      try {
        const refImage = await fetchImageAsVeoReference(bannerRef)
        instance.image = {
          bytesBase64Encoded: refImage.bytesBase64Encoded,
          mimeType: refImage.mimeType,
        }
      } catch (refErr) {
        videoLog.warn("generate-hero-video.reference-image", {
          userId,
          url: bannerRef,
          error: refErr instanceof Error ? refErr.message : String(refErr),
        })
      }
    }

    const { operationName } = await veoPredictLongRunning(config, {
      instances: [instance],
      parameters: {
        aspectRatio: HERO_FORMAT,
        durationSeconds: HERO_DURATION_SECONDS,
        sampleCount: 1,
        generateAudio: false,
      },
    })

    const donePayload = await pollVeoOperation(operationName, {
      timeoutMs: Number(process.env.VEO_POLL_TIMEOUT_MS ?? 90_000),
      intervalMs: 3_000,
    })

    const extracted = extractVideoBytesFromVeoResponse(donePayload)
    let bytes = extracted.bytes
    const gcsUri = extracted.gcsUri
    if (bytes.length === 0 && gcsUri) {
      bytes = await downloadGcsUri(gcsUri)
    }
    if (bytes.length === 0) {
      throw new VeoGenerationError("Veo returned an empty video payload", "VERTEX_ERROR")
    }

    const jobId = operationName.split("/").pop() ?? operationName
    const videoUrl = await uploadVideoToVercelBlob(bytes, `hero_${jobId}`)

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { videoCount: { increment: 1 } },
      select: { videoCount: true, isPro: true },
    })

    console.log("[generate-hero-video]", {
      userId,
      storeSlug: store.slug,
      jobId,
      result: "success",
    })

    return NextResponse.json({
      status: "success",
      videoUrl,
      jobId,
      ...quotaSnapshot(updatedUser),
    })
  } catch (e) {
    if (e instanceof VeoGenerationError) {
      videoLog.error("generate-hero-video.failed", {
        userId,
        code: e.code,
        message: e.message,
      })
      return NextResponse.json({ error: e.message, code: e.code }, { status: veoErrorStatus(e.code) })
    }
    const message = e instanceof Error ? e.message : "Hero video generation failed"
    videoLog.error("generate-hero-video.failed", { userId, message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
