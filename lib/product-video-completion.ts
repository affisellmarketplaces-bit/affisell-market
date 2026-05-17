import { prisma } from "@/lib/prisma"
import { videoLog } from "@/lib/video-logger"

export async function completeProductVideoJob(args: {
  productId: string
  jobId?: string | null
  videoUrl: string
  thumbnailUrl?: string | null
  notifySupplier?: boolean
}) {
  const { productId, jobId, videoUrl, thumbnailUrl, notifySupplier = true } = args

  const job = jobId
    ? await prisma.videoGenerationJob.findFirst({ where: { jobId } })
    : await prisma.videoGenerationJob.findFirst({
        where: { productId, status: "PROCESSING" },
        orderBy: { createdAt: "desc" },
      })

  if (job) {
    await prisma.videoGenerationJob.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        videoUrl,
        thumbnailUrl: thumbnailUrl ?? undefined,
      },
    })
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      videoAdUrl: videoUrl,
      videoAdStatus: "ready",
    },
    select: { id: true, supplierId: true, name: true },
  })

  if (notifySupplier) {
    await prisma.notification.create({
      data: {
        userId: product.supplierId,
        type: "VIDEO_AD_READY",
        message: `Ta pub vidéo est prête pour « ${product.name.slice(0, 80)} ».`,
        imageUrl: thumbnailUrl ?? null,
      },
    })
  }

  videoLog.info("video.job.completed", { productId, jobId: job?.jobId ?? jobId })
}

export async function failProductVideoJob(productId: string, jobId?: string | null) {
  if (jobId) {
    await prisma.videoGenerationJob.updateMany({
      where: { jobId },
      data: { status: "FAILED" },
    })
  } else {
    await prisma.videoGenerationJob.updateMany({
      where: { productId, status: "PROCESSING" },
      data: { status: "FAILED" },
    })
  }
  await prisma.product.update({
    where: { id: productId },
    data: { videoAdStatus: "failed" },
  })
}
