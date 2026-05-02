import { prisma } from "@/lib/prisma"

/** Auto post when supplier adds a product (community feed). */
export async function createNewDropCommunityPost(opts: { storeId: string; productId: string; productName: string }) {
  const { storeId, productId, productName } = opts
  await prisma.communityPost.create({
    data: {
      storeId,
      content: `New drop: ${productName.slice(0, 280)}`,
      images: [],
      productId,
    },
  })
}
