import { loadShopCategoriesResponse } from "@/lib/shop-categories-response-cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lazy category drawer data — avoids blocking cart / storefront layouts. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  const { groups, totalProducts } = await loadShopCategoriesResponse(slug)
  return Response.json({
    groups,
    totalProducts,
  })
}
