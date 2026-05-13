import { auth } from "@/auth"
import { normalizeCartVariantSignature } from "@/lib/cart-variant"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Body `productId` is the marketplace listing id (`AffiliateProduct.id`). */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    productId?: string
    qty?: number
    quantity?: number
    selectedColor?: string | null
    selectedSize?: string | null
  }
  const affiliateProductId = typeof body.productId === "string" ? body.productId.trim() : ""
  if (!affiliateProductId) {
    return Response.json({ error: "Missing productId" }, { status: 400 })
  }

  const rawQty = body.qty ?? body.quantity
  const qty = Math.max(1, Math.min(99, Math.round(Number(rawQty)) || 1))

  const colorRaw = typeof body.selectedColor === "string" ? body.selectedColor.trim() : ""
  const sizeRaw = typeof body.selectedSize === "string" ? body.selectedSize.trim() : ""
  const variantSignature = normalizeCartVariantSignature(colorRaw || null, sizeRaw || null)
  const selectedColor = colorRaw ? colorRaw.slice(0, 48) : null
  const selectedSize = sizeRaw ? sizeRaw.slice(0, 40) : null

  const listing = await prisma.affiliateProduct.findFirst({
    where: {
      id: affiliateProductId,
      isListed: true,
      product: { active: true },
      affiliate: { role: "AFFILIATE" },
    },
  })
  if (!listing) {
    return Response.json({ error: "Listing not found" }, { status: 404 })
  }

  const cart = await prisma.cart.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: {},
  })

  await prisma.cartItem.upsert({
    where: {
      cartId_affiliateProductId_variantSignature: {
        cartId: cart.id,
        affiliateProductId,
        variantSignature,
      },
    },
    create: {
      cartId: cart.id,
      affiliateProductId,
      quantity: qty,
      variantSignature,
      selectedColor,
      selectedSize,
    },
    update: {
      quantity: { increment: qty },
    },
  })

  return Response.json({ ok: true })
}
