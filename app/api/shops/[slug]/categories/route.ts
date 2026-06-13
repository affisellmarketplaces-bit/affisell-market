import { loadAffiliateShopCategoryGroupsForSlug } from "@/lib/shop-storefront-data"
import { totalProductsInCategoryGroups } from "@/lib/shop-storefront-categories"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Lazy category drawer data — avoids blocking cart / storefront layouts. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params
  const groups = await loadAffiliateShopCategoryGroupsForSlug(slug)
  return Response.json({
    groups,
    totalProducts: totalProductsInCategoryGroups(groups),
  })
}
