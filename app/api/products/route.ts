import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import type { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const listingMarketplaceInclude = {
  product: {
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      compareAt: true,
      basePriceCents: true,
      stock: true,
      categoryId: true,
    },
  },
  affiliate: {
    select: {
      email: true,
      name: true,
      store: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.AffiliateProductInclude

type MarketplaceListingRow = Prisma.AffiliateProductGetPayload<{ include: typeof listingMarketplaceInclude }>

function serializeMarketplaceListing(row: MarketplaceListingRow) {
  const p = row.product
  const compareNum = p.compareAt != null ? Number(p.compareAt) : null
  const gallery = listingGalleryUrls(row.customImages ?? [], p.images ?? [])
  const title = listingDisplayTitle(row.customTitle, p.name)
  const store =
    row.affiliate.store?.name?.trim() ||
    row.affiliate.name?.trim() ||
    row.affiliate.email?.split("@")[0] ||
    "Seller"

  return {
    id: row.id,
    listingId: row.id,
    productId: p.id,
    name: title,
    title,
    price: row.sellingPriceCents / 100,
    sellingPriceCents: row.sellingPriceCents,
    basePriceCents: p.basePriceCents,
    compareAt:
      compareNum != null && Number.isFinite(compareNum) ? compareNum : null,
    image: gallery[0] ?? null,
    images: gallery,
    stock: p.stock,
    store,
    isBestSeller: row.isFeatured,
    storeSlug: row.affiliate.store?.slug ?? null,
  }
}

async function marketplaceListingWhere(
  categoryId: string | null,
  subcategoryId: string | null,
  q: string
): Promise<Prisma.AffiliateProductWhereInput> {
  const productFilters: Prisma.ProductWhereInput = {
    active: true,
    isDraft: false,
  }

  if (subcategoryId) {
    productFilters.categoryId = subcategoryId
  } else if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { subcategories: { select: { id: true } } },
    })
    if (category) {
      productFilters.categoryId = {
        in: [category.id, ...category.subcategories.map((s) => s.id)],
      }
    }
  }

  const andParts: Prisma.AffiliateProductWhereInput[] = [
    { isListed: true },
    { product: productFilters },
  ]

  const needle = q.trim()
  if (needle) {
    andParts.push({
      OR: [
        { customTitle: { contains: needle, mode: "insensitive" } },
        { product: { name: { contains: needle, mode: "insensitive" } } },
        { product: { description: { contains: needle, mode: "insensitive" } } },
      ],
    })
  }

  return { AND: andParts }
}

export async function GET(request: NextRequest) {
  const session = await auth()

  if (session?.user?.role === "SUPPLIER") {
    const products = await prisma.product.findMany({
      where: { supplierId: session.user.id },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(products)
  }

  const url = request.nextUrl
  const categoryId = url.searchParams.get("categoryId") ?? url.searchParams.get("category")
  const subcategoryId =
    url.searchParams.get("subcategoryId") ?? url.searchParams.get("subcategory")
  const q = url.searchParams.get("q") ?? ""

  const where = await marketplaceListingWhere(categoryId, subcategoryId, q)

  const rows = await prisma.affiliateProduct.findMany({
    where,
    include: listingMarketplaceInclude,
    orderBy: [{ isFeatured: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
    take: 120,
  })

  return NextResponse.json({
    products: rows.map(serializeMarketplaceListing),
  })
}
