import { BuyerDiscoveryHub } from "@/components/home/BuyerDiscoveryHub"
import { PublicHero } from "@/components/home/PublicHero"
import {
  loadBuyerCategoryChipsSafe,
  loadBuyerHomeProductsSafe,
} from "@/lib/buyer-discovery-data"
import { loadFeaturedShopsSafe, loadPublicHomeStatsSafe } from "@/lib/public-home-data"

export async function PublicHome() {
  const [stats, shops, products, categories] = await Promise.all([
    loadPublicHomeStatsSafe(),
    loadFeaturedShopsSafe(24),
    loadBuyerHomeProductsSafe(32),
    loadBuyerCategoryChipsSafe(12),
  ])

  return (
    <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
      <PublicHero stats={stats} />
      <BuyerDiscoveryHub shops={shops} products={products} categories={categories} />
    </main>
  )
}
