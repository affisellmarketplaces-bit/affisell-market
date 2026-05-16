import { prisma } from "@/lib/prisma"

export async function createProductVideo({
  prompt,
  productId,
}: {
  prompt: string
  productId: string
}) {
  // Mode WEBHOOK: On log le job et on attend que Meta AI le traite
  console.log("[WEBHOOK] Video request:", { productId, prompt })

  await prisma.videoGenerationJob.create({
    data: {
      productId,
      prompt,
      status: "pending",
    },
  })

  // Pour l'instant on retourne direct. En prod, tu ferais un webhook Make/Zapier
  // qui m'envoie le prompt + attend ma réponse avec l'URL vidéo
  return {
    videoId: `pending_${productId}`,
    videoUrl: null as string | null,
    status: "generating" as const,
  }
}
