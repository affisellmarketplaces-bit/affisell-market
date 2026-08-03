import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { affiliateCatalogProductDetailSelect } from "@/lib/affiliate-dashboard-data"
import {
  normalizeProductDescriptionFields,
} from "@/lib/html-description-extract"
import { mergeColorImagesForProduct } from "@/lib/product-color-images"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ productId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (String(session.user.role ?? "").toUpperCase() !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { productId } = await ctx.params

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, active: true, isDraft: false },
      select: affiliateCatalogProductDetailSelect(session.user.id),
    })
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    let description = product.description
    let descriptionIllustrationImages = product.descriptionIllustrationImages ?? []

    const normalized = normalizeProductDescriptionFields({
      description,
      descriptionIllustrationImages,
    })
    if (normalized.changed) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          description: normalized.description,
          descriptionIllustrationImages: normalized.descriptionIllustrationImages,
        },
      })
      description = normalized.description
      descriptionIllustrationImages = normalized.descriptionIllustrationImages
      console.log("[affiliate/catalog-product]", {
        result: "description_normalized",
        productId: product.id,
        imageCount: descriptionIllustrationImages.length,
      })
    }

    const colors = product.colors ?? []
    return NextResponse.json({
      product: {
        ...product,
        description,
        descriptionIllustrationImages,
        colorImages: mergeColorImagesForProduct(colors, product.colorImages, product.variants),
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load product"
    console.error("[affiliate/catalog-product]", e)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
