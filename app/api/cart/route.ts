import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type CartLineJson = {
  id: string
  qty: number
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
    return Response.json([] satisfies CartLineJson[])
  }

  const cart = await prisma.cart.findFirst({
    where: { userId: session.user.id },
    include: {
      items: {
        include: {
          affiliateProduct: {
            include: { product: true },
          },
        },
      },
    },
  })

  if (!cart?.items.length) {
    return Response.json([] satisfies CartLineJson[])
  }

  const lines: CartLineJson[] = cart.items.map((row) => {
    const listing = row.affiliateProduct
    const p = listing.product
    return {
      id: row.id,
      qty: row.quantity,
      product: {
        id: listing.id,
        title: p.name,
        price: listing.sellingPriceCents / 100,
        imageUrl: p.image || "",
      },
    }
  })

  return Response.json(lines)
}
