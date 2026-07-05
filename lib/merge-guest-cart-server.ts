import { normalizeCartVariantSignature } from "@/lib/cart-variant"
import { resetCartAbandonmentOnActivity } from "@/lib/cart-abandonment-touch"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma } from "@/lib/prisma"

export type GuestCartMergeLine = {
  productId: string
  qty?: number
  selectedColor?: string | null
  selectedSize?: string | null
}

function sanitizeQty(input: number) {
  return Math.max(1, Math.min(99, Math.round(Number(input)) || 1))
}

/** Idempotent: merge guest lines into the authenticated user's cart. */
export async function mergeGuestCartLinesForUser(
  userId: string,
  lines: GuestCartMergeLine[]
): Promise<{ merged: number; skipped: number }> {
  let merged = 0
  let skipped = 0

  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  for (const row of lines) {
    const affiliateProductId = typeof row.productId === "string" ? row.productId.trim() : ""
    if (!affiliateProductId) {
      skipped += 1
      continue
    }

    const listing = await prisma.affiliateProduct.findFirst({
      where: {
        id: affiliateProductId,
        ...buyerListedAffiliateProductWhere,
      },
      select: { id: true },
    })
    if (!listing) {
      skipped += 1
      continue
    }

    const qty = sanitizeQty(Number(row.qty))
    const colorRaw = typeof row.selectedColor === "string" ? row.selectedColor.trim() : ""
    const sizeRaw = typeof row.selectedSize === "string" ? row.selectedSize.trim() : ""
    const variantSignature = normalizeCartVariantSignature(colorRaw || null, sizeRaw || null)
    const selectedColor = colorRaw ? colorRaw.slice(0, 48) : null
    const selectedSize = sizeRaw ? sizeRaw.slice(0, 40) : null

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
    merged += 1
  }

  if (merged > 0) {
    await resetCartAbandonmentOnActivity(cart.id)
  }

  return { merged, skipped }
}

export function parseGuestCartMergeBody(raw: unknown): GuestCartMergeLine[] {
  if (!Array.isArray(raw)) return []
  const out: GuestCartMergeLine[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const item = row as GuestCartMergeLine
    const productId = typeof item.productId === "string" ? item.productId.trim() : ""
    if (!productId) continue
    out.push({
      productId,
      qty: sanitizeQty(Number(item.qty)),
      selectedColor: item.selectedColor ?? null,
      selectedSize: item.selectedSize ?? null,
    })
  }
  return out
}
