import { BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { AffiliateBanner } from "@/components/home/AffiliateBanner"
import { Hero } from "@/components/home/Hero"
import { HomeFooter } from "@/components/home/HomeFooter"
import { HomeHighlights } from "@/components/home/HomeHighlights"
import { HomePickedForYou } from "@/components/home/HomePickedForYou"
import { SalesBarometer } from "@/components/trends/SalesBarometer"
import {
  loadHomeBarometer,
  loadHomeHighlights,
  loadHomeMarketplaceStats,
} from "@/lib/home-marketplace-data"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [stats, highlights, barometer] = await Promise.all([
    loadHomeMarketplaceStats(),
    loadHomeHighlights(),
    loadHomeBarometer(),
  ])

  return (
    <BentoShell>
      <BentoContainer maxWidth="7xl" className="space-y-12 py-8 md:space-y-14 md:py-10">
        <AffiliateBanner />
        <Hero stats={stats} />
        <HomeHighlights data={highlights} showBusinessData />
        <HomePickedForYou />
        <SalesBarometer initialData={barometer} />
      </BentoContainer>
      <HomeFooter />
    </BentoShell>
  )
}
