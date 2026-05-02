import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { primaryProductImage } from "@/lib/product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CartLineJson = {
  id: string
  qty: number
  sellerName: string | null
  product: {
    id: string
    title: string
    price: number
    imageUrl: string
  }
}

/** Returns a JSON array of cart lines (empty when unauthenticated or empty cart). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json([] as CartLineJson[])
  }

  const cart = await prisma.cart.findFirst({
    where: { userId: session.user.id },
    include: {
      items: {
        include: {
          affiliateProduct: {
            include: {
              product: true,
              affiliate: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!cart?.items.length) {
    return Response.json([] as CartLineJson[])
  }

  const lines: CartLineJson[] = cart.items.map((row) => {
    const listing = row.affiliateProduct
    const p = listing.product
    return {
      id: row.id,
      qty: row.quantity,
      sellerName: listing.affiliate.name?.trim() || null,
      product: {
        id: listing.id,
        title: p.name,
        price: listing.sellingPriceCents / 100,
        imageUrl: primaryProductImage(p.images) || "",
      },
    }
  })

  return Response.json(lines)
}
