import { prisma } from "@/lib/prisma"

export type ListingAdClip = {
  id: string
  videoUrl: string
  thumbnailUrl: string | null
  format: string
}

/** Supplier/affiliate download clips: ProductVideo first, then legacy jobs (deduped by URL). */
export async function fetchListingAdClips(productId: string): Promise<ListingAdClip[]> {
  const [productVideo, legacyJobs] = await Promise.all([
    prisma.productVideo.findUnique({
      where: { productId },
      select: { id: true, videoUrl: true },
    }),
    prisma.videoGenerationJob.findMany({
      where: {
        productId,
        status: "DONE",
        videoUrl: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        videoUrl: true,
        thumbnailUrl: true,
        format: true,
      },
    }),
  ])

  const seen = new Set<string>()
  const clips: ListingAdClip[] = []

  const primaryUrl = productVideo?.videoUrl?.trim()
  if (primaryUrl) {
    seen.add(primaryUrl)
    clips.push({
      id: productVideo!.id,
      videoUrl: primaryUrl,
      thumbnailUrl: null,
      format: "9:16",
    })
  }

  for (const job of legacyJobs) {
    const url = job.videoUrl?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    clips.push({
      id: job.id,
      videoUrl: url,
      thumbnailUrl: job.thumbnailUrl,
      format: job.format,
    })
  }

  return clips.slice(0, 5)
}
