import { prisma } from "./prisma"

export async function createProductVideo({
  prompt,
  productId,
}: {
  prompt: string
  productId: string
}) {
  console.log("[WEBHOOK] Video request:", { productId, prompt })

  await prisma.videoGenerationJob.create({
    data: { productId, prompt, status: "pending" },
  })

  return {
    videoId: `pending_${productId}`,
    videoUrl: null,
    status: "generating",
  }
}
