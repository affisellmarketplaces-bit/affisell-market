import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import { buildViralMedias } from "@/lib/social/build-viral-medias"
import { loadBubbleProductView } from "@/lib/social/load-bubble-product.server"
import {
  generateSocialAssets,
  SOCIAL_ASSET_PRIORITY_KEYS,
} from "@/lib/social/social-asset-generator"
import { getFallbackSocialAssetsBundle } from "@/lib/social/social-assets-fallback"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

type Body = {
  productId?: string
  /** `png` = social pack (default). `video` = medias + Reel export spec for client MediaRecorder. */
  mode?: "png" | "video" | "both"
  priority?: boolean
}

/**
 * Viral Assets V2 generate endpoint.
 * - PNG pack via existing Satori pipeline
 * - Video = return medias + 1080×1920 export spec (client records Ken Burns MP4)
 */
export async function POST(request: Request) {
  try {
    const session = await requireAffiliateSession()
    const body = (await request.json().catch(() => null)) as Body | null
    const productId = body?.productId?.trim()
    if (!productId) {
      return NextResponse.json({ error: "missing_product_id" }, { status: 400 })
    }

    const mode = body?.mode ?? "both"
    const product = await loadBubbleProductView(productId, session.user.id)
    if (!product) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }

    const medias = product.medias ?? []

    const videoExport =
      mode === "video" || mode === "both"
        ? {
            width: 1080,
            height: 1920,
            fps: 30,
            imageHoldMs: 1400,
            medias,
            note: "Client records via canvas MediaRecorder (lib/social/generate-video.ts)",
          }
        : undefined

    let bundle: Awaited<ReturnType<typeof generateSocialAssets>> | null = null
    if (mode === "png" || mode === "both") {
      try {
        bundle = await generateSocialAssets(product, {
          persist: true,
          keys: body?.priority ? SOCIAL_ASSET_PRIORITY_KEYS : undefined,
          concurrency: 3,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : "generate_failed"
        console.error("[social-generate]", { productId, error: message })
        bundle = getFallbackSocialAssetsBundle(product)
      }
    }

    console.log("[social-generate]", {
      productId,
      mode,
      mediaCount: medias.length,
      hasVideo: medias.some((m) => m.type === "video"),
      okCount: bundle && "okCount" in bundle ? bundle.okCount : undefined,
    })

    return NextResponse.json({
      productId,
      generatedAt: new Date().toISOString(),
      medias,
      videoExport,
      ...(bundle ?? {}),
    })
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : "generate_failed"
    console.error("[social-generate]", { error: message })
    return NextResponse.json(
      { error: "generate_failed", message: message.slice(0, 240) },
      { status: 500 }
    )
  }
}

/** Lightweight medias lookup for carousel / Reel export. */
export async function GET(request: Request) {
  try {
    await requireAffiliateSession()
    const url = new URL(request.url)
    const productId = url.searchParams.get("productId")?.trim()
    if (!productId) {
      return NextResponse.json({ error: "missing_product_id" }, { status: 400 })
    }

    const row = await prisma.product.findFirst({
      where: { id: productId, active: true },
      select: {
        id: true,
        images: true,
        videoAdUrl: true,
        descriptionIllustrationVideos: true,
        videos: { select: { videoUrl: true } },
      },
    })
    if (!row) {
      return NextResponse.json({ error: "product_not_found" }, { status: 404 })
    }

    const listing = await prisma.affiliateProduct.findFirst({
      where: { productId: row.id, isListed: true },
      select: { customImages: true },
      orderBy: { conversions: "desc" },
    })

    const medias = buildViralMedias({
      images: row.images,
      customImages: listing?.customImages,
      videoUrl: row.videos[0]?.videoUrl ?? null,
      videoAdUrl: row.videoAdUrl,
      illustrationVideos: row.descriptionIllustrationVideos,
    })

    console.log("[social-generate]", {
      event: "medias",
      productId,
      mediaCount: medias.length,
      hasVideo: medias.some((m) => m.type === "video"),
    })

    return NextResponse.json({
      productId,
      medias,
      videoExport: {
        width: 1080,
        height: 1920,
        fps: 30,
        imageHoldMs: 1400,
        medias,
      },
    })
  } catch (err) {
    if (
      typeof err === "object" &&
      err &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      String((err as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : "medias_failed"
    console.error("[social-generate]", { error: message })
    return NextResponse.json(
      { error: "medias_failed", message: message.slice(0, 240) },
      { status: 500 }
    )
  }
}
