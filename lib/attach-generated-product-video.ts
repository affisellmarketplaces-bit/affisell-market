import { prisma } from "@/lib/prisma"

export type AttachVideoPlacement = "description" | "afterGallery"

const MAX_DESCRIPTION_VIDEOS = 2

export function isAffisellHostedVideoUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== "https:" && u.protocol !== "http:") return false
    const host = u.hostname.toLowerCase()
    if (host.endsWith(".public.blob.vercel-storage.com")) return true
    if (host.endsWith(".blob.vercel-storage.com")) return true
    return /\.mp4(\?|#|$)/i.test(`${u.pathname}${u.search}`)
  } catch {
    return false
  }
}

function mergeDescriptionVideos(existing: string[], videoUrl: string): string[] {
  const without = existing.filter((u) => u !== videoUrl)
  return [videoUrl, ...without].slice(0, MAX_DESCRIPTION_VIDEOS)
}

export async function resolveGeneratedVideoUrl(productId: string): Promise<string | null> {
  const row = await prisma.productVideo.findUnique({
    where: { productId },
    select: { videoUrl: true },
  })
  return row?.videoUrl?.trim() || null
}

export async function attachGeneratedVideoToProduct(args: {
  productId: string
  supplierId: string
  placement: AttachVideoPlacement
  videoUrl?: string
}) {
  const { productId, supplierId, placement } = args
  const videoUrl = (args.videoUrl?.trim() || (await resolveGeneratedVideoUrl(productId))) ?? ""
  if (!videoUrl) {
    return { ok: false as const, error: "Aucune vidéo générée pour ce produit." }
  }
  if (!isAffisellHostedVideoUrl(videoUrl)) {
    return { ok: false as const, error: "URL vidéo invalide." }
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, supplierId },
    select: {
      id: true,
      descriptionIllustrationVideos: true,
      videoAdUrl: true,
    },
  })
  if (!product) {
    return { ok: false as const, error: "Produit introuvable." }
  }

  const clearingGallery =
    placement === "description" && product.videoAdUrl === videoUrl

  const data =
    placement === "description"
      ? {
          descriptionIllustrationVideos: mergeDescriptionVideos(
            product.descriptionIllustrationVideos,
            videoUrl
          ),
          ...(clearingGallery ? { videoAdUrl: null, videoAdStatus: "none" } : {}),
        }
      : {
          descriptionIllustrationVideos: product.descriptionIllustrationVideos.filter(
            (u) => u !== videoUrl
          ),
          videoAdUrl: videoUrl,
          videoAdStatus: "ready" as const,
        }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data,
    select: {
      descriptionIllustrationVideos: true,
      videoAdUrl: true,
      videoAdStatus: true,
    },
  })

  return {
    ok: true as const,
    placement,
    videoUrl,
    descriptionIllustrationVideos: updated.descriptionIllustrationVideos,
    videoAdUrl: updated.videoAdUrl,
    inDescription: updated.descriptionIllustrationVideos.includes(videoUrl),
    onGallery: updated.videoAdUrl === videoUrl,
  }
}

export async function getAttachVideoStatus(productId: string, supplierId: string) {
  const [product, generatedUrl] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, supplierId },
      select: {
        descriptionIllustrationVideos: true,
        videoAdUrl: true,
      },
    }),
    resolveGeneratedVideoUrl(productId),
  ])

  if (!product) return null

  const url = generatedUrl ?? ""
  const inDescription = url
    ? product.descriptionIllustrationVideos.includes(url)
    : product.descriptionIllustrationVideos.length > 0
  const onGallery = url ? product.videoAdUrl === url : Boolean(product.videoAdUrl?.trim())

  return {
    generatedVideoUrl: generatedUrl,
    inDescription,
    onGallery,
    activePlacement: inDescription ? ("description" as const) : onGallery ? ("afterGallery" as const) : null,
    descriptionIllustrationVideos: product.descriptionIllustrationVideos,
    videoAdUrl: product.videoAdUrl,
  }
}
